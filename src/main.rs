use actix_multipart::Multipart;
use actix_web::{
    middleware::{Compress, Logger},
    web, App, HttpRequest, HttpResponse, HttpServer, Result,
};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::env;
use std::path::{Path, PathBuf};
use tokio::io::AsyncWriteExt;
use tokio::sync::broadcast;

const DEFAULT_UPLOAD_DIR: &str = "./uploads";
const DEFAULT_PORT: u16 = 8086;
const DEFAULT_MAX_UPLOAD_BYTES: usize = 1024 * 1024 * 200; // 200 MB
const EDITABLE_EXTENSIONS: &[&str] = &[
    "txt", "csv", "py", "json", "md", "rs", "js", "html", "css", "toml", "yaml", "yml",
];

#[derive(Clone, Serialize, Deserialize)]
struct FileEntry {
    name: String,
    is_dir: bool,
    size: u64,
    modified: u64,
}

#[derive(Clone, Serialize, Deserialize)]
struct WsMessage {
    action: String,
    path: String,
}

type Broadcaster = broadcast::Sender<String>;

#[derive(Clone)]
struct AppState {
    broadcaster: Broadcaster,
    upload_dir: PathBuf,
    max_upload_bytes: usize,
}

struct Settings {
    upload_dir: PathBuf,
    port: u16,
    max_upload_bytes: usize,
}

impl Settings {
    fn from_env() -> Self {
        Self {
            upload_dir: env::var("BOX_UPLOAD_DIR")
                .map(PathBuf::from)
                .unwrap_or_else(|_| PathBuf::from(DEFAULT_UPLOAD_DIR)),
            port: env::var("BOX_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(DEFAULT_PORT),
            max_upload_bytes: env::var("BOX_MAX_UPLOAD_BYTES")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(DEFAULT_MAX_UPLOAD_BYTES),
        }
    }
}

fn broadcast_update(tx: &Broadcaster, action: &str, path: &str) {
    let msg = serde_json::to_string(&WsMessage {
        action: action.to_string(),
        path: path.to_string(),
    })
    .unwrap_or_default();
    let _ = tx.send(msg);
}

async fn ws_handler(
    req: HttpRequest,
    stream: web::Payload,
    state: web::Data<AppState>,
) -> Result<HttpResponse> {
    let (res, mut session, mut msg_stream) = actix_ws::handle(&req, stream)?;
    let mut rx = state.broadcaster.subscribe();

    actix_web::rt::spawn(async move {
        loop {
            tokio::select! {
                msg = rx.recv() => {
                    if let Ok(text) = msg {
                        if session.text(text).await.is_err() {
                            break;
                        }
                    }
                }
                msg = msg_stream.next() => {
                    match msg {
                        Some(Ok(actix_ws::Message::Ping(bytes))) => {
                            let _ = session.pong(&bytes).await;
                        }
                        Some(Ok(actix_ws::Message::Close(_))) | None => break,
                        _ => {}
                    }
                }
            }
        }
        let _ = session.close(None).await;
    });

    Ok(res)
}

#[derive(Deserialize)]
struct PathQuery {
    path: Option<String>,
    download: Option<bool>,
}

fn clean_relative_path(path: &str) -> PathBuf {
    let mut clean = PathBuf::new();
    for segment in path.split('/') {
        if segment.is_empty() || segment == "." || segment == ".." {
            continue;
        }
        clean.push(segment);
    }
    clean
}

fn resolve_path(base: &Path, path: Option<&String>) -> PathBuf {
    path.map(|p| base.join(clean_relative_path(p)))
        .unwrap_or_else(|| base.to_path_buf())
}

/// Safely resolve a path, ensuring it stays within the base directory.
/// Returns None if the resolved path escapes the base directory (e.g., via symlinks).
fn resolve_path_safe(base: &Path, path: Option<&String>) -> Option<PathBuf> {
    let resolved = resolve_path(base, path);

    // If the path doesn't exist yet, we can't canonicalize it.
    // Check the parent directory instead, and verify the final component is safe.
    if !resolved.exists() {
        // For non-existent paths, check that parent is within base
        if let Some(parent) = resolved.parent() {
            if parent.exists() {
                let parent_canonical = parent.canonicalize().ok()?;
                let base_canonical = base.canonicalize().ok()?;
                if parent_canonical.starts_with(&base_canonical) {
                    return Some(resolved);
                }
            } else {
                // Parent doesn't exist either - this is fine for create operations
                // as long as the logical path is within base
                return Some(resolved);
            }
        }
        return None;
    }

    // For existing paths, canonicalize and verify
    let canonical = resolved.canonicalize().ok()?;
    let base_canonical = base.canonicalize().ok()?;

    if canonical.starts_with(&base_canonical) {
        Some(resolved)
    } else {
        None
    }
}

async fn list_files(
    state: web::Data<AppState>,
    query: web::Query<PathQuery>,
) -> Result<HttpResponse> {
    let base_path = resolve_path_safe(&state.upload_dir, query.path.as_ref())
        .ok_or_else(|| actix_web::error::ErrorForbidden("Invalid path"))?;

    if !base_path.exists() {
        return Ok(HttpResponse::Ok().json(Vec::<FileEntry>::new()));
    }

    let mut entries = Vec::new();
    let mut dir = tokio::fs::read_dir(&base_path).await?;

    while let Some(entry) = dir.next_entry().await? {
        let meta = entry.metadata().await?;
        let modified = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        entries.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            is_dir: meta.is_dir(),
            size: meta.len(),
            modified,
        });
    }

    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(HttpResponse::Ok().json(entries))
}

async fn upload_file(
    mut payload: Multipart,
    query: web::Query<PathQuery>,
    state: web::Data<AppState>,
) -> Result<HttpResponse> {
    let base_path = resolve_path_safe(&state.upload_dir, query.path.as_ref())
        .ok_or_else(|| actix_web::error::ErrorForbidden("Invalid path"))?;

    tokio::fs::create_dir_all(&base_path).await?;

    let mut uploaded = Vec::new();
    let mut mtimes: std::collections::HashMap<String, u64> = std::collections::HashMap::new();

    while let Some(item) = payload.next().await {
        let mut field = item?;
        let field_name = field.name().map(|s| s.to_string()).unwrap_or_default();

        // Check if this is the mtimes metadata field
        if field_name == "mtimes" {
            let mut bytes = Vec::new();
            while let Some(chunk) = field.next().await {
                bytes.extend_from_slice(&chunk?);
            }
            if let Ok(parsed) = serde_json::from_slice::<std::collections::HashMap<String, u64>>(&bytes) {
                mtimes = parsed;
            }
            continue;
        }

        let filename = field
            .content_disposition()
            .and_then(|cd| cd.get_filename().map(|s| s.to_string()))
            .unwrap_or_else(|| format!("file_{}", uuid::Uuid::new_v4()));

        // Support nested paths for folder uploads - clean each segment
        let clean_path = clean_relative_path(&filename);
        let filepath = base_path.join(&clean_path);

        // Create parent directories if needed (for folder uploads)
        if let Some(parent) = filepath.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        // Handle filename conflicts
        let filepath = get_unique_filepath(&filepath).await;
        let final_name = clean_path.to_string_lossy().to_string();

        let mut file = tokio::fs::File::create(&filepath).await?;

        while let Some(chunk) = field.next().await {
            let data = chunk?;
            file.write_all(&data).await?;
        }

        // Preserve original modification time if provided
        if let Some(&mtime_ms) = mtimes.get(&filename) {
            let mtime = filetime::FileTime::from_unix_time((mtime_ms / 1000) as i64, ((mtime_ms % 1000) * 1_000_000) as u32);
            let _ = filetime::set_file_mtime(&filepath, mtime);
        }

        let rel_path = query
            .path
            .as_ref()
            .map(|p| format!("{}/{}", p, final_name))
            .unwrap_or(final_name.clone());

        broadcast_update(&state.broadcaster, "upload", &rel_path);
        uploaded.push(final_name);
    }

    Ok(HttpResponse::Ok().json(uploaded))
}

async fn get_unique_filepath(original: &Path) -> PathBuf {
    if !original.exists() {
        return original.to_path_buf();
    }

    let parent = original.parent().unwrap_or(Path::new(""));
    let stem = original
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file");
    let ext = original.extension().and_then(|s| s.to_str());

    let mut counter = 1;
    loop {
        let new_name = match ext {
            Some(e) => format!("{}_{}.{}", stem, counter, e),
            None => format!("{}_{}", stem, counter),
        };
        let filepath = parent.join(&new_name);
        if !filepath.exists() {
            return filepath;
        }
        counter += 1;
    }
}

#[derive(Deserialize)]
struct CreateFolderReq {
    name: String,
    path: Option<String>,
}

async fn create_folder(
    body: web::Json<CreateFolderReq>,
    state: web::Data<AppState>,
) -> Result<HttpResponse> {
    let base = resolve_path_safe(&state.upload_dir, body.path.as_ref())
        .ok_or_else(|| actix_web::error::ErrorForbidden("Invalid path"))?;

    let safe_name = body.name.replace(['/', '\\', '\0'], "_");
    let folder_path = base.join(&safe_name);

    tokio::fs::create_dir_all(&folder_path).await?;

    let rel_path = body
        .path
        .as_ref()
        .map(|p| format!("{}/{}", p, safe_name))
        .unwrap_or(safe_name);

    broadcast_update(&state.broadcaster, "folder", &rel_path);

    Ok(HttpResponse::Ok().json(serde_json::json!({"success": true})))
}

#[derive(Deserialize)]
struct DeleteReq {
    path: String,
}

#[derive(Deserialize)]
struct RenameReq {
    path: String,
    new_name: String,
}

async fn rename_item(
    body: web::Json<RenameReq>,
    state: web::Data<AppState>,
) -> Result<HttpResponse> {
    let old_path = resolve_path_safe(&state.upload_dir, Some(&body.path))
        .ok_or_else(|| actix_web::error::ErrorForbidden("Invalid path"))?;
    let safe_name = body.new_name.replace(['/', '\\', '\0'], "_");

    if !old_path.exists() {
        return Err(actix_web::error::ErrorNotFound("Item not found"));
    }

    let parent = old_path
        .parent()
        .ok_or_else(|| actix_web::error::ErrorBadRequest("Invalid path for rename"))?;
    let new_path = parent.join(&safe_name);

    if new_path.exists() {
        return Err(actix_web::error::ErrorConflict("Name already exists"));
    }

    tokio::fs::rename(&old_path, &new_path).await?;

    broadcast_update(&state.broadcaster, "rename", &body.path);

    Ok(HttpResponse::Ok().json(serde_json::json!({"success": true, "new_name": safe_name})))
}

#[derive(Deserialize)]
struct MoveReq {
    path: String,
    dest_dir: Option<String>,
}

async fn move_item(body: web::Json<MoveReq>, state: web::Data<AppState>) -> Result<HttpResponse> {
    let src_path = resolve_path_safe(&state.upload_dir, Some(&body.path))
        .ok_or_else(|| actix_web::error::ErrorForbidden("Invalid path"))?;
    let dest_base = resolve_path_safe(&state.upload_dir, body.dest_dir.as_ref())
        .ok_or_else(|| actix_web::error::ErrorForbidden("Invalid destination path"))?;

    if !src_path.exists() {
        return Err(actix_web::error::ErrorNotFound("Item not found"));
    }

    let filename = src_path
        .file_name()
        .ok_or_else(|| actix_web::error::ErrorBadRequest("Invalid path"))?;
    let dest_path = dest_base.join(filename);

    if dest_path.exists() {
        return Err(actix_web::error::ErrorConflict(
            "Item already exists in destination",
        ));
    }

    tokio::fs::create_dir_all(&dest_base).await?;
    tokio::fs::rename(&src_path, &dest_path).await?;

    broadcast_update(&state.broadcaster, "move", &body.path);

    Ok(HttpResponse::Ok().json(serde_json::json!({"success": true})))
}

async fn list_all_folders(state: web::Data<AppState>) -> Result<HttpResponse> {
    let mut folders = vec![String::from("/")];
    collect_folders(state.upload_dir.clone(), String::new(), &mut folders).await;
    Ok(HttpResponse::Ok().json(folders))
}

#[async_recursion::async_recursion]
async fn collect_folders(path: PathBuf, prefix: String, folders: &mut Vec<String>) {
    if let Ok(mut dir) = tokio::fs::read_dir(&path).await {
        while let Ok(Some(entry)) = dir.next_entry().await {
            if let Ok(meta) = entry.metadata().await {
                if meta.is_dir() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    let full_path = if prefix.is_empty() {
                        name.clone()
                    } else {
                        format!("{}/{}", prefix, name)
                    };
                    folders.push(full_path.clone());
                    collect_folders(entry.path(), full_path, folders).await;
                }
            }
        }
    }
}

#[derive(Clone, Serialize)]
struct SearchResult {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
    modified: u64,
}

const MAX_SEARCH_RESULTS: usize = 100;

#[derive(Deserialize)]
struct SearchQuery {
    q: String,
}

async fn search_files(
    state: web::Data<AppState>,
    query: web::Query<SearchQuery>,
) -> Result<HttpResponse> {
    let search_term = query.q.to_lowercase();
    if search_term.is_empty() {
        return Ok(HttpResponse::Ok().json(Vec::<SearchResult>::new()));
    }

    let mut results = Vec::new();
    collect_search_results(
        state.upload_dir.clone(),
        String::new(),
        &search_term,
        &mut results,
        MAX_SEARCH_RESULTS,
    )
    .await;

    // Sort: folders first, then by name
    results.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(HttpResponse::Ok().json(results))
}

#[async_recursion::async_recursion]
async fn collect_search_results(
    path: PathBuf,
    prefix: String,
    search_term: &str,
    results: &mut Vec<SearchResult>,
    limit: usize,
) {
    // Early termination if we've hit the limit
    if results.len() >= limit {
        return;
    }

    if let Ok(mut dir) = tokio::fs::read_dir(&path).await {
        while let Ok(Some(entry)) = dir.next_entry().await {
            // Check limit before processing each entry
            if results.len() >= limit {
                return;
            }

            if let Ok(meta) = entry.metadata().await {
                let name = entry.file_name().to_string_lossy().to_string();
                let full_path = if prefix.is_empty() {
                    name.clone()
                } else {
                    format!("{}/{}", prefix, name)
                };

                // Check if name matches search term
                if name.to_lowercase().contains(search_term) {
                    let modified = meta
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);

                    results.push(SearchResult {
                        name,
                        path: full_path.clone(),
                        is_dir: meta.is_dir(),
                        size: meta.len(),
                        modified,
                    });
                }

                // Recurse into directories (check limit again)
                if meta.is_dir() && results.len() < limit {
                    collect_search_results(entry.path(), full_path, search_term, results, limit).await;
                }
            }
        }
    }
}

async fn delete_item(
    body: web::Json<DeleteReq>,
    state: web::Data<AppState>,
) -> Result<HttpResponse> {
    let filepath = resolve_path_safe(&state.upload_dir, Some(&body.path))
        .ok_or_else(|| actix_web::error::ErrorForbidden("Invalid path"))?;

    if filepath.exists() {
        if filepath.is_dir() {
            tokio::fs::remove_dir_all(&filepath).await?;
        } else {
            tokio::fs::remove_file(&filepath).await?;
        }
        broadcast_update(&state.broadcaster, "delete", &body.path);
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({"success": true})))
}

fn is_editable_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| EDITABLE_EXTENSIONS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

async fn get_content(
    state: web::Data<AppState>,
    query: web::Query<PathQuery>,
) -> Result<HttpResponse> {
    let path = query
        .path
        .as_ref()
        .ok_or_else(|| actix_web::error::ErrorBadRequest("path required"))?;

    let filepath = resolve_path_safe(&state.upload_dir, Some(path))
        .ok_or_else(|| actix_web::error::ErrorForbidden("Invalid path"))?;

    if !filepath.exists() || filepath.is_dir() {
        return Err(actix_web::error::ErrorNotFound("File not found"));
    }

    if !is_editable_extension(&filepath) {
        return Err(actix_web::error::ErrorBadRequest("File type not editable"));
    }

    let content = tokio::fs::read_to_string(&filepath).await.map_err(|e| {
        if e.kind() == std::io::ErrorKind::InvalidData {
            actix_web::error::ErrorBadRequest("File is not valid UTF-8 text")
        } else {
            actix_web::error::ErrorInternalServerError(e)
        }
    })?;

    Ok(HttpResponse::Ok()
        .content_type("text/plain; charset=utf-8")
        .body(content))
}

#[derive(Deserialize)]
struct SaveContentReq {
    path: String,
    content: String,
}

async fn save_content(
    body: web::Json<SaveContentReq>,
    state: web::Data<AppState>,
) -> Result<HttpResponse> {
    let filepath = resolve_path_safe(&state.upload_dir, Some(&body.path))
        .ok_or_else(|| actix_web::error::ErrorForbidden("Invalid path"))?;

    if !filepath.exists() || filepath.is_dir() {
        return Err(actix_web::error::ErrorNotFound("File not found"));
    }

    if !is_editable_extension(&filepath) {
        return Err(actix_web::error::ErrorBadRequest("File type not editable"));
    }

    tokio::fs::write(&filepath, &body.content).await?;

    broadcast_update(&state.broadcaster, "edit", &body.path);

    Ok(HttpResponse::Ok().json(serde_json::json!({"success": true})))
}

#[derive(Deserialize)]
struct NewFileReq {
    path: Option<String>,
    filename: String,
}

async fn create_new_file(
    body: web::Json<NewFileReq>,
    state: web::Data<AppState>,
) -> Result<HttpResponse> {
    // Validate filename has an editable extension
    let filename = body.filename.replace(['/', '\\', '\0'], "_");
    let filepath_check = Path::new(&filename);

    if !is_editable_extension(filepath_check) {
        return Err(actix_web::error::ErrorBadRequest("Invalid file extension"));
    }

    let base = resolve_path_safe(&state.upload_dir, body.path.as_ref())
        .ok_or_else(|| actix_web::error::ErrorForbidden("Invalid path"))?;
    let filepath = base.join(&filename);

    // Prevent overwriting existing files
    if filepath.exists() {
        return Err(actix_web::error::ErrorConflict("File already exists"));
    }

    // Ensure parent directory exists
    tokio::fs::create_dir_all(&base).await?;

    // Create empty file
    tokio::fs::write(&filepath, "").await?;

    let rel_path = body
        .path
        .as_ref()
        .map(|p| format!("{}/{}", p, filename))
        .unwrap_or(filename.clone());

    broadcast_update(&state.broadcaster, "upload", &rel_path);

    Ok(HttpResponse::Ok().json(serde_json::json!({"success": true, "path": rel_path})))
}

async fn download_file(
    state: web::Data<AppState>,
    query: web::Query<PathQuery>,
) -> Result<HttpResponse> {
    let path = query
        .path
        .as_ref()
        .ok_or_else(|| actix_web::error::ErrorBadRequest("path required"))?;

    let filepath = resolve_path_safe(&state.upload_dir, Some(path))
        .ok_or_else(|| actix_web::error::ErrorForbidden("Invalid path"))?;

    if !filepath.exists() || filepath.is_dir() {
        return Err(actix_web::error::ErrorNotFound("File not found"));
    }

    let filename = filepath
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("download");

    // Get correct MIME type - override for common previewable types
    let ext = filepath.extension().and_then(|e| e.to_str()).unwrap_or("");
    let content_type: String = match ext.to_lowercase().as_str() {
        "pdf" => "application/pdf".to_string(),
        "mp4" => "video/mp4".to_string(),
        "webm" => "video/webm".to_string(),
        "mp3" => "audio/mpeg".to_string(),
        "wav" => "audio/wav".to_string(),
        "ogg" => "audio/ogg".to_string(),
        "txt" => "text/plain; charset=utf-8".to_string(),
        "html" | "htm" => "text/html; charset=utf-8".to_string(),
        "css" => "text/css; charset=utf-8".to_string(),
        "js" => "text/javascript; charset=utf-8".to_string(),
        "json" => "application/json; charset=utf-8".to_string(),
        "xml" => "application/xml; charset=utf-8".to_string(),
        "svg" => "image/svg+xml".to_string(),
        "png" => "image/png".to_string(),
        "jpg" | "jpeg" => "image/jpeg".to_string(),
        "gif" => "image/gif".to_string(),
        "webp" => "image/webp".to_string(),
        "ico" => "image/x-icon".to_string(),
        _ => mime_guess::from_path(&filepath)
            .first_or_octet_stream()
            .essence_str()
            .to_string(),
    };

    let file_content = tokio::fs::read(&filepath).await?;
    let file_size = file_content.len();

    let mut response = HttpResponse::Ok();

    // Set Content-Type
    response.insert_header(("Content-Type", content_type));

    // Set Content-Length
    response.insert_header(("Content-Length", file_size.to_string()));

    // Prevent MIME sniffing - browser must use our Content-Type
    response.insert_header(("X-Content-Type-Options", "nosniff"));

    // Cache for 1 hour for preview, helps with repeated views
    response.insert_header(("Cache-Control", "private, max-age=3600"));

    // Set Content-Disposition: attachment for download, inline for preview
    if query.download.unwrap_or(false) {
        response.insert_header((
            "Content-Disposition",
            format!("attachment; filename=\"{}\"", filename.replace('"', "\\\""))
        ));
    } else {
        // Explicit inline directive for preview - required by Edge for PDF viewing
        response.insert_header((
            "Content-Disposition",
            format!("inline; filename=\"{}\"", filename.replace('"', "\\\""))
        ));
    }

    Ok(response.body(file_content))
}

async fn serve_index() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(include_str!("../static/index.html")))
}

async fn healthcheck() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(serde_json::json!({"ok": true})))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    let settings = Settings::from_env();
    tokio::fs::create_dir_all(&settings.upload_dir).await?;

    let (tx, _) = broadcast::channel::<String>(100);
    let state = AppState {
        broadcaster: tx,
        upload_dir: settings.upload_dir.clone(),
        max_upload_bytes: settings.max_upload_bytes,
    };

    println!(
        "Boxy running on http://0.0.0.0:{} (uploads at {})",
        settings.port,
        state.upload_dir.to_string_lossy()
    );

    HttpServer::new(move || {
        let app_state = state.clone();
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .app_data(web::PayloadConfig::new(app_state.max_upload_bytes))
            .wrap(Logger::default())
            .wrap(Compress::default())
            .route("/", web::get().to(serve_index))
            .route("/ws", web::get().to(ws_handler))
            .route("/api/files", web::get().to(list_files))
            .route("/api/upload", web::post().to(upload_file))
            .route("/api/folder", web::post().to(create_folder))
            .route("/api/delete", web::post().to(delete_item))
            .route("/api/rename", web::post().to(rename_item))
            .route("/api/move", web::post().to(move_item))
            .route("/api/folders", web::get().to(list_all_folders))
            .route("/api/download", web::get().to(download_file))
            .route("/api/search", web::get().to(search_files))
            .route("/api/content", web::get().to(get_content))
            .route("/api/content", web::post().to(save_content))
            .route("/api/newfile", web::post().to(create_new_file))
            .route("/api/health", web::get().to(healthcheck))
    })
    .bind(("0.0.0.0", settings.port))?
    .run()
    .await
}
