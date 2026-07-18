# Boxy Architecture

## Overview
Boxy is a self-hosted file-sharing app built with Rust/Actix. A single binary serves
one embedded HTML page (`include_str!("../static/index.html")`) plus a REST/WebSocket API backed by
the local `./uploads` directory. There is no database — file state lives on disk; UI preferences
(view mode, sort, sidebar) are persisted in `localStorage`.

```
Browser (static/index.html: HTML+CSS+JS)
  │   REST (fetch)            WebSocket (/ws)
  ▼                              ▲
Actix-web (src/main.rs) ─ broadcast::Sender fan-out ─┘
  │ tokio::fs
  ▼
./uploads  (volume-mountable)
```

## Components
- **Web UI** (`static/index.html`, ~5370 lines): single Files view — collapsible sidebar folder tree,
  grid/list browser, drag-and-drop upload/move, right-click context menu, inline rename,
  multi-select with bulk ZIP download, search/filter/sort, in-browser text editor with syntax
  highlighting and markdown rendered preview, URL hash navigation. Dark-mode-first theme with
  CSS custom-property tokens. Feature highlights:
  - **List view**: separate Date + Time columns, per-column Excel-style filter dropdowns,
    single-click inline folder expand, folders-first sort
  - **Zoom slider**: resizes grid cards or adjusts list row density (80–200px range)
  - **Multi-select mode**: toggle in toolbar for single-click selection without Ctrl/Cmd
  - **Live path bar**: editable address input in nav bar, Enter to navigate
  - **Sidebar toolbar**: show-files toggle, expand-all, collapse-all buttons
  - **Image lightbox**: full-screen viewer with keyboard arrow navigation
  - **Autosave**: 2-second debounce autosave in the text editor
  - **Duplicate**: context-menu option to clone any file or folder (appends `_1`, `_2`, …)
  - **Clipboard**: Ctrl/Cmd+C/X/V and context-menu Copy/Cut/Paste across folders (cut items dim
    until pasted; copy uses `POST /api/copy`, cut uses `POST /api/move`)
  - **Thumbnails**: grid tiles for raster images load cached 320px JPEGs from `/api/thumb`;
    skeleton shimmer placeholders while a folder listing loads
  - **Shortcuts modal**: `?` key or toolbar button lists all keyboard shortcuts
  - **Storage footer**: sidebar shows live root totals from `/api/stats`, refreshed
    (debounced) on WebSocket events
  UI preferences (`viewMode`, `filterType`, `listSortCol`, `listSortDir`, `boxy_sidebar_expanded`,
  `boxy_sidebar_collapsed`, `itemScale`, `sidebarShowFiles`) are persisted in `localStorage`.
- **HTTP API** (`src/main.rs`, ~1680 lines): one async handler per endpoint; all mutations broadcast over WS.
- **WebSocket** (`/ws`): each client subscribes to a `tokio::sync::broadcast` channel; every
  mutation sends `{ action, path }` to all clients. Lagged clients are logged, not dropped silently.
- **Storage**: `tokio::fs` reads/writes under the upload root; filenames de-duped server-side
  (`name`, `name_1`, … then a uuid fallback).

## API surface
- `GET /` — static UI
- `GET /ws` — WebSocket broadcast channel (`action` ∈ upload, folder, rename, move, delete, edit, copy)
- `GET /api/files?path=` — list a directory
- `GET /api/search?q=` — recursive name search (depth-capped)
- `GET /api/folders` — all folder paths (move dialog + sidebar tree)
- `GET /api/download?path=` — download (`&download=true`) or inline preview (explicit MIME + nosniff)
- `GET /api/thumb?path=` — cached image thumbnail (max edge 320px, JPEG; raster formats only,
  sources >50 MB skipped; cache keyed on path + mtime under `BOX_THUMB_DIR`)
- `GET /api/stats?path=` — recursive directory stats `{ files, folders, bytes }` (depth-capped)
- `GET /api/content?path=` — read an editable text file (UTF-8 validated)
- `POST /api/content` — save an editable text file `{ path, content }`
- `POST /api/newfile` — create an empty editable file `{ path?, filename }`
- `POST /api/upload?path=` — multipart upload (nested paths supported; `mtimes` field preserves dates)
- `POST /api/folder` — create folder `{ name, path? }`
- `POST /api/rename` — rename `{ path, new_name }`
- `POST /api/move` — move `{ path, dest_dir? }`
- `POST /api/delete` — delete `{ path }`
- `POST /api/duplicate` — duplicate file or folder `{ path }` → `{ path: new_path }`
- `POST /api/copy` — copy file or folder into a destination folder `{ path, destination }` →
  `{ ok, path }` (collision dedupe; rejects copying a folder into itself/descendants)
- `GET /api/download-zip?path=` — download a directory as a ZIP
- `POST /api/download-zip-multi` — download selected paths as `selection.zip` `{ paths: [...] }`
- `GET /api/health` — healthcheck

## Runtime configuration (env)
- `BOX_PORT` (default `8086`)
- `BOX_BIND_ADDR` (default `127.0.0.1` — localhost-only; nginx terminates TLS in front)
- `BOX_UPLOAD_DIR` (default `./uploads`)
- `BOX_MAX_UPLOAD_BYTES` (default `209715200`, 200 MB)
- `BOX_THUMB_DIR` (default `./thumbs` — thumbnail cache, deliberately outside the upload root
  so it never appears in listings/search)

## Safety / hardening
- **Path safety:** `clean_relative_path` strips `.`/`..` and splits on `/` *and* `\`;
  `resolve_path_safe` canonicalises and verifies containment within the upload root (blocks symlink
  traversal). Every handler that touches user paths uses it.
- **Input limits:** names capped at 255 chars, search query at 256; the upload `mtimes` metadata
  field is byte-capped before JSON parsing.
- **Recursion:** folder/search walks are depth-capped (`MAX_RECURSION_DEPTH = 64`).
- **De-dupe:** the unique-filename loop is bounded, falling back to a uuid suffix.
- **Middleware:** `Compress` + `PayloadConfig` + request `Logger`. Note: `PayloadConfig` does **not** apply to the Multipart/Json extractors in use, so `BOX_MAX_UPLOAD_BYTES` is not enforced app-side — the reverse proxy's `client_max_body_size` is the effective cap (CHANGELOG Known Issues).

## Deployment
Production runs as a systemd service bound to `127.0.0.1`, behind nginx (TLS via wildcard cert,
WebSocket upgrade, 500 MB body). Because the frontend is embedded at compile time, **any frontend
change requires `cargo build --release` + a service restart**. See `docs/DEPLOYMENT.md`.
