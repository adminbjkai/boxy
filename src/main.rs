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
const DEFAULT_BIND_ADDR: &str = "127.0.0.1"; // localhost-only; nginx terminates TLS in front
const DEFAULT_MAX_UPLOAD_BYTES: usize = 1024 * 1024 * 200; // 200 MB
/// Cap recursion in folder/search walks to avoid stack/CPU blowup on deep trees or symlink loops.
const MAX_RECURSION_DEPTH: usize = 64;
/// Max length for user-supplied names (folder, file, rename) — matches common filesystem limits.
const MAX_NAME_LEN: usize = 255;
/// Max length for a search query.
const MAX_SEARCH_LEN: usize = 256;
/// Cap bytes read for the upload `mtimes` metadata field before JSON parsing (memory-DoS guard).
const MAX_MTIMES_BYTES: usize = 1024 * 1024; // 1 MiB
/// Upper bound on filename de-dupe attempts before falling back to a uuid suffix.
const MAX_DEDUPE_ATTEMPTS: u32 = 10_000;
const EDITABLE_EXTENSIONS: &[&str] = &[
    "txt", "csv", "py", "json", "md", "rs", "js", "html", "css", "toml", "yaml", "yml",
    "sql", "m3u", "ts", "sh", "go", "rb", "php", "xml",
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
}

struct Settings {
    upload_dir: PathBuf,
    port: u16,
    bind_addr: String,
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
            bind_addr: env::var("BOX_BIND_ADDR")
                .unwrap_or_else(|_| DEFAULT_BIND_ADDR.to_string()),
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
                    match msg {
                        Ok(text) => {
                            if session.text(text).await.is_err() {
                                break;
                            }
                        }
                        Err(broadcast::error::RecvError::Lagged(skipped)) => {
                            eprintln!("warn: WebSocket client lagged behind; {skipped} update(s) dropped");
                        }
                        Err(broadcast::error::RecvError::Closed) => break,
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
    download: Option<String>,
}

fn clean_relative_path(path: &str) -> PathBuf {
    let mut clean = PathBuf::new();
    // Split on both separators so Windows-style backslash segments can't smuggle traversal.
    for segment in path.split(['/', '\\']) {
        if segment.is_empty() || segment == "." || segment == ".." {
            continue;
        }
        clean.push(segment);
    }
    clean
}

/// Reject user-supplied names that are empty or longer than the filesystem-safe limit.
fn valid_name_len(name: &str) -> bool {
    !name.is_empty() && name.len() <= MAX_NAME_LEN
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
                if bytes.len() > MAX_MTIMES_BYTES {
                    return Err(actix_web::error::ErrorBadRequest("mtimes metadata too large"));
                }
            }
            if let Ok(parsed) =
                serde_json::from_slice::<std::collections::HashMap<String, u64>>(&bytes)
            {
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
            let mtime = filetime::FileTime::from_unix_time(
                (mtime_ms / 1000) as i64,
                ((mtime_ms % 1000) * 1_000_000) as u32,
            );
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
    while counter <= MAX_DEDUPE_ATTEMPTS {
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

    // Fallback after too many collisions: a guaranteed-unique uuid suffix.
    let unique = match ext {
        Some(e) => format!("{}_{}.{}", stem, uuid::Uuid::new_v4(), e),
        None => format!("{}_{}", stem, uuid::Uuid::new_v4()),
    };
    parent.join(unique)
}

#[derive(Deserialize)]
struct DuplicateReq {
    path: String,
}

async fn duplicate_item(
    body: web::Json<DuplicateReq>,
    state: web::Data<AppState>,
) -> Result<HttpResponse> {
    let src = resolve_path_safe(&state.upload_dir, Some(&body.path))
        .ok_or_else(|| actix_web::error::ErrorForbidden("Invalid path"))?;

    if !src.exists() {
        return Err(actix_web::error::ErrorNotFound("Source not found"));
    }

    let dest = get_unique_filepath(&src).await;

    if src.is_dir() {
        copy_dir_all(&src, &dest).await?;
    } else {
        tokio::fs::copy(&src, &dest).await?;
    }

    let rel = dest
        .strip_prefix(&state.upload_dir)
        .unwrap_or(&dest)
        .to_string_lossy()
        .replace('\\', "/");
    broadcast_update(&state.broadcaster, "upload", &rel);
    Ok(HttpResponse::Ok().json(serde_json::json!({ "path": rel })))
}

#[async_recursion::async_recursion]
async fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    tokio::fs::create_dir_all(dst).await?;
    let mut dir = tokio::fs::read_dir(src).await?;
    while let Some(entry) = dir.next_entry().await? {
        let dst_path = dst.join(entry.file_name());
        if entry.file_type().await?.is_dir() {
            copy_dir_all(&entry.path(), &dst_path).await?;
        } else {
            tokio::fs::copy(entry.path(), dst_path).await?;
        }
    }
    Ok(())
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
    if !valid_name_len(&body.name) {
        return Err(actix_web::error::ErrorBadRequest("Folder name length invalid"));
    }

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
    if !valid_name_len(&body.new_name) {
        return Err(actix_web::error::ErrorBadRequest("New name length invalid"));
    }

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
    collect_folders(state.upload_dir.clone(), String::new(), &mut folders, 0).await;
    Ok(HttpResponse::Ok().json(folders))
}

#[async_recursion::async_recursion]
async fn collect_folders(path: PathBuf, prefix: String, folders: &mut Vec<String>, depth: usize) {
    if depth >= MAX_RECURSION_DEPTH {
        return;
    }
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
                    collect_folders(entry.path(), full_path, folders, depth + 1).await;
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
    if query.q.len() > MAX_SEARCH_LEN {
        return Err(actix_web::error::ErrorBadRequest("Search query too long"));
    }
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
        0,
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
    depth: usize,
) {
    if depth >= MAX_RECURSION_DEPTH {
        return;
    }
    if let Ok(mut dir) = tokio::fs::read_dir(&path).await {
        while let Ok(Some(entry)) = dir.next_entry().await {
            // Check limit before processing each entry
            if results.len() >= MAX_SEARCH_RESULTS {
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

                // Recurse into directories
                if meta.is_dir() {
                    collect_search_results(entry.path(), full_path, search_term, results, depth + 1)
                        .await;
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
    if !valid_name_len(&body.filename) {
        return Err(actix_web::error::ErrorBadRequest("Filename length invalid"));
    }
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
    let force_download = query.download.as_deref().map(|v| v == "true" || v == "1").unwrap_or(false);
    if force_download {
        response.insert_header((
            "Content-Disposition",
            format!("attachment; filename=\"{}\"", filename.replace('"', "\\\"")),
        ));
    } else {
        // Explicit inline directive for preview - required by Edge for PDF viewing
        response.insert_header((
            "Content-Disposition",
            format!("inline; filename=\"{}\"", filename.replace('"', "\\\"")),
        ));
    }

    Ok(response.body(file_content))
}

async fn download_zip(
    state: web::Data<AppState>,
    query: web::Query<PathQuery>,
) -> Result<HttpResponse> {
    let path = query
        .path
        .as_ref()
        .ok_or_else(|| actix_web::error::ErrorBadRequest("path required"))?;

    let dirpath = resolve_path_safe(&state.upload_dir, Some(path))
        .ok_or_else(|| actix_web::error::ErrorForbidden("Invalid path"))?;

    if !dirpath.exists() || !dirpath.is_dir() {
        return Err(actix_web::error::ErrorNotFound("Directory not found"));
    }

    let dirname = dirpath
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("archive")
        .to_string();

    let buf = tokio::task::spawn_blocking(move || -> std::io::Result<Vec<u8>> {
        let cursor = std::io::Cursor::new(Vec::new());
        let mut zip = zip::ZipWriter::new(cursor);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        fn add_dir(
            zip: &mut zip::ZipWriter<std::io::Cursor<Vec<u8>>>,
            base: &Path,
            dir: &Path,
            options: zip::write::SimpleFileOptions,
        ) -> std::io::Result<()> {
            for entry in std::fs::read_dir(dir)? {
                let entry = entry?;
                let entry_path = entry.path();
                let rel = entry_path.strip_prefix(base).unwrap_or(&entry_path);
                let rel_str = rel.to_string_lossy().replace('\\', "/");
                if entry_path.is_dir() {
                    zip.add_directory(&rel_str, options)?;
                    add_dir(zip, base, &entry_path, options)?;
                } else {
                    zip.start_file(&rel_str, options)?;
                    let data = std::fs::read(&entry_path)?;
                    std::io::Write::write_all(zip, &data)?;
                }
            }
            Ok(())
        }

        add_dir(&mut zip, &dirpath, &dirpath, options)?;
        let cursor = zip.finish()?;
        Ok(cursor.into_inner())
    })
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?
    .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?;

    Ok(HttpResponse::Ok()
        .insert_header(("Content-Type", "application/zip"))
        .insert_header(("Content-Disposition", format!("attachment; filename=\"{}.zip\"", dirname.replace('"', "\\\""))))
        .insert_header(("Content-Length", buf.len().to_string()))
        .body(buf))
}

#[derive(Deserialize)]
struct ZipMultiReq {
    paths: Vec<String>,
}

async fn download_zip_multi(
    state: web::Data<AppState>,
    body: web::Json<ZipMultiReq>,
) -> Result<HttpResponse> {
    if body.paths.is_empty() {
        return Err(actix_web::error::ErrorBadRequest("paths required"));
    }

    let upload_dir = state.upload_dir.clone();
    let paths: Vec<PathBuf> = body
        .paths
        .iter()
        .filter_map(|p| resolve_path_safe(&upload_dir, Some(p)))
        .collect();

    if paths.is_empty() {
        return Err(actix_web::error::ErrorForbidden("No valid paths"));
    }

    let buf = tokio::task::spawn_blocking(move || -> std::io::Result<Vec<u8>> {
        let cursor = std::io::Cursor::new(Vec::new());
        let mut zip = zip::ZipWriter::new(cursor);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        fn add_entry(
            zip: &mut zip::ZipWriter<std::io::Cursor<Vec<u8>>>,
            base_name: &str,
            entry_path: &Path,
            options: zip::write::SimpleFileOptions,
        ) -> std::io::Result<()> {
            if entry_path.is_dir() {
                zip.add_directory(base_name, options)?;
                for child in std::fs::read_dir(entry_path)? {
                    let child = child?;
                    let child_name = format!("{}/{}", base_name, child.file_name().to_string_lossy());
                    add_entry(zip, &child_name, &child.path(), options)?;
                }
            } else {
                zip.start_file(base_name, options)?;
                let data = std::fs::read(entry_path)?;
                std::io::Write::write_all(zip, &data)?;
            }
            Ok(())
        }

        for p in &paths {
            let name = p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "file".to_string());
            add_entry(&mut zip, &name, p, options)?;
        }

        let cursor = zip.finish()?;
        Ok(cursor.into_inner())
    })
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?
    .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))?;

    Ok(HttpResponse::Ok()
        .insert_header(("Content-Type", "application/zip"))
        .insert_header(("Content-Disposition", "attachment; filename=\"selection.zip\""))
        .insert_header(("Content-Length", buf.len().to_string()))
        .body(buf))
}

async fn serve_index() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .insert_header(("Cache-Control", "no-cache, no-store, must-revalidate"))
        .insert_header(("Pragma", "no-cache"))
        .insert_header(("Expires", "0"))
        .body(include_str!("../static/index.html")))
}

async fn serve_favicon() -> HttpResponse {
    HttpResponse::Ok()
        .content_type("image/x-icon")
        .body(include_bytes!("../static/favicon.ico").as_ref())
}

async fn healthcheck() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(serde_json::json!({"ok": true})))
}


#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    let settings = Settings::from_env();
    tokio::fs::create_dir_all(&settings.upload_dir).await?;

    let (tx, _) = broadcast::channel::<String>(256);
    let state = AppState {
        broadcaster: tx,
        upload_dir: settings.upload_dir.clone(),
    };

    let max_upload_bytes = settings.max_upload_bytes;
    let bind = (settings.bind_addr.clone(), settings.port);

    println!(
        "Boxy running on http://{}:{} (uploads at {})",
        bind.0,
        bind.1,
        state.upload_dir.to_string_lossy()
    );

    HttpServer::new(move || {
        let app_state = state.clone();
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .app_data(web::PayloadConfig::new(max_upload_bytes))
            .wrap(Logger::default())
            .wrap(Compress::default())
            .route("/", web::get().to(serve_index))
            .route("/favicon.ico", web::get().to(serve_favicon))
            .route("/ws", web::get().to(ws_handler))
            .route("/api/files", web::get().to(list_files))
            .route("/api/upload", web::post().to(upload_file))
            .route("/api/folder", web::post().to(create_folder))
            .route("/api/delete", web::post().to(delete_item))
            .route("/api/rename", web::post().to(rename_item))
            .route("/api/move", web::post().to(move_item))
            .route("/api/folders", web::get().to(list_all_folders))
            .route("/api/download", web::get().to(download_file))
            .route("/api/download-zip", web::get().to(download_zip))
            .route("/api/download-zip-multi", web::post().to(download_zip_multi))
            .route("/api/search", web::get().to(search_files))
            .route("/api/content", web::get().to(get_content))
            .route("/api/content", web::post().to(save_content))
            .route("/api/newfile", web::post().to(create_new_file))
            .route("/api/duplicate", web::post().to(duplicate_item))
            .route("/api/health", web::get().to(healthcheck))
    })
    .bind(bind)?
    .run()
    .await
}
