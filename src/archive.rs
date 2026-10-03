//! Disk-backed archives avoid retaining archives or individual source files in RAM.
use actix_files::NamedFile;
use actix_web::{
    http::header::{ContentDisposition, DispositionParam, DispositionType},
    HttpRequest, HttpResponse, Result,
};
use std::{
    collections::HashSet,
    fs::File,
    io,
    path::{Path, PathBuf},
    sync::Arc,
};
use tokio::sync::Semaphore;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

fn add_entry(zip: &mut ZipWriter<File>, path: &Path, name: &str, depth: usize) -> io::Result<()> {
    if depth >= super::MAX_RECURSION_DEPTH {
        return Err(io::Error::other("Archive folder depth limit exceeded"));
    }
    let meta = std::fs::symlink_metadata(path)?;
    // Never traverse symlinks inside selected folders.
    if meta.file_type().is_symlink() {
        return Ok(());
    }
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    if meta.is_dir() {
        if !name.is_empty() {
            zip.add_directory(name, options)?;
        }
        for child in std::fs::read_dir(path)? {
            let child = child?;
            let child_name = if name.is_empty() {
                child.file_name().to_string_lossy().into_owned()
            } else {
                format!("{}/{}", name, child.file_name().to_string_lossy())
            };
            add_entry(zip, &child.path(), &child_name, depth + 1)?;
        }
    } else if meta.is_file() {
        zip.start_file(name, options)?;
        io::copy(&mut File::open(path)?, zip)?;
    }
    Ok(())
}

fn build(paths: Vec<PathBuf>, contents_only: bool) -> io::Result<File> {
    let mut zip = ZipWriter::new(tempfile::tempfile()?);
    let mut used = HashSet::new();
    for path in paths {
        let base_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("file");
        let mut name = if contents_only {
            String::new()
        } else {
            base_name.to_owned()
        };
        // Two selected paths can have the same basename. Keep both in the archive.
        let mut suffix = 1;
        while !used.insert(name.clone()) {
            name = format!("{}_{}", base_name, suffix);
            suffix += 1;
        }
        add_entry(&mut zip, &path, &name, 0)?;
    }
    Ok(zip.finish()?)
}

pub async fn respond(
    req: HttpRequest,
    slots: Arc<Semaphore>,
    paths: Vec<PathBuf>,
    name: String,
    contents_only: bool,
) -> Result<HttpResponse> {
    let permit = slots
        .acquire_owned()
        .await
        .map_err(actix_web::error::ErrorInternalServerError)?;
    let file = tokio::task::spawn_blocking(move || {
        let _permit = permit;
        build(paths, contents_only)
    })
    .await
    .map_err(actix_web::error::ErrorInternalServerError)?
    .map_err(actix_web::error::ErrorInternalServerError)?;
    // Anonymous temporary file is removed automatically when the response closes.
    Ok(NamedFile::from_file(file, &name)?
        .set_content_disposition(ContentDisposition {
            disposition: DispositionType::Attachment,
            parameters: vec![DispositionParam::Filename(name)],
        })
        .into_response(&req))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn archive_preserves_both_basename_collisions() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("a")).unwrap();
        std::fs::create_dir_all(dir.path().join("b")).unwrap();
        let a = dir.path().join("a/file.txt");
        let b = dir.path().join("b/file.txt");
        std::fs::write(&a, "first").unwrap();
        std::fs::write(&b, "second").unwrap();
        let file = build(vec![a, b], false).unwrap();
        let mut zip = zip::ZipArchive::new(file).unwrap();
        assert_eq!(zip.len(), 2);
        assert!(zip.by_name("file.txt").is_ok());
        assert!(zip.by_name("file.txt_1").is_ok());
    }
    #[cfg(unix)]
    #[test]
    fn archive_skips_nested_symlinks() {
        let dir = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        std::fs::write(outside.path().join("secret.txt"), "secret").unwrap();
        std::fs::write(dir.path().join("safe.txt"), "safe").unwrap();
        std::os::unix::fs::symlink(outside.path(), dir.path().join("escape")).unwrap();
        let file = build(vec![dir.path().into()], true).unwrap();
        let mut zip = zip::ZipArchive::new(file).unwrap();
        assert_eq!(zip.len(), 1);
        assert!(zip.by_name("safe.txt").is_ok());
    }
}
