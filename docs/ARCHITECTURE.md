# Boxy Architecture

## Overview
Boxy is a lightweight file sharing UI built with Rust/Actix, serving a static web client and REST/WebSocket APIs for file operations backed by a local uploads directory.

- **Web UI**: drag-drop uploads, file grid with search/sort, move/rename/delete, downloads, theme toggle.
- **APIs**: REST endpoints for listing, upload (multipart), folder CRUD, move/rename/delete, download, health, and folder tree; WebSocket `/ws` for broadcast updates (upload/rename/move/delete).
- **Storage**: local filesystem `./uploads` (volume-mountable in Docker), filenames de-duped server-side.
- **Limits**: payload limit defaults to 200MB; compression middleware enabled.
- **Extensibility**: runtime config via env vars (`BOX_PORT`, `BOX_UPLOAD_DIR`, `BOX_MAX_UPLOAD_BYTES`).

## Diagrams
### Architecture (components)
![Boxy architecture](assets/images/boxy-architecture-20260112.png)

### File flow (upload + updates)
![Boxy file flow](assets/images/boxy-file-flow-20260112.png)

## Runtime configuration
- `BOX_PORT`: HTTP bind port (default `8086`).
- `BOX_UPLOAD_DIR`: upload root (default `./uploads`).
- `BOX_MAX_UPLOAD_BYTES`: max upload size in bytes (default `209715200`).

## Request surface
- `GET /` – static UI
- `GET /ws` – WebSocket broadcast channel
- `GET /api/files?path=...` – list items in folder
- `GET /api/search?q=...` – recursive file search by name
- `POST /api/upload?path=...` – multipart upload (supports nested paths for folder uploads)
- `POST /api/folder` – create folder `{ name, path? }`
- `POST /api/rename` – rename `{ path, new_name }`
- `POST /api/move` – move `{ path, dest_dir? }`
- `POST /api/delete` – delete `{ path }`
- `GET /api/folders` – list all folders for move dialog
- `GET /api/download?path=...` – download/preview file
- `GET /api/health` – healthcheck

## Notes on implementation
- Paths are sanitized and resolved under the configured upload root to avoid traversal.
- Duplicate filenames are de-duped (`name`, `name_1`, ...).
- Broadcast channel fans out events to connected WebSocket clients.
- Compression middleware and payload limits applied to protect the service.
