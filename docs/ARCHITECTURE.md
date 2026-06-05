# Boxy Architecture

## Overview
Boxy is a self-hosted file-sharing + task-board app built with Rust/Actix. A single binary serves
one embedded HTML page (`include_str!("../static/index.html")`) plus a REST/WebSocket API backed by
the local `./uploads` directory. There is no database — file state lives on disk; task/board state
lives in the browser's `localStorage`.

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
- **Web UI** (`static/index.html`): two views.
  - *Files*: collapsible sidebar folder tree, grid/list browser, drag-and-drop upload/move,
    right-click context menu, inline rename, multi-select, search/filter/sort, in-browser text
    editor, breadcrumbs. Dark-mode-first theme with CSS custom-property tokens.
  - *Tasks*: multi-board Kanban (columns + cards, drag within/between columns), list view,
    search/filter, JSON export/import. Persisted in `localStorage` (`boxy_boards`,
    `boxy_current_board`, view/theme/sidebar prefs).
- **HTTP API** (`src/main.rs`): one async handler per endpoint; all mutations broadcast over WS.
- **WebSocket** (`/ws`): each client subscribes to a `tokio::sync::broadcast` channel; every
  mutation sends `{ action, path }` to all clients. Lagged clients are logged, not dropped silently.
- **Storage**: `tokio::fs` reads/writes under the upload root; filenames de-duped server-side
  (`name`, `name_1`, … then a uuid fallback).

## API surface
- `GET /` — static UI
- `GET /ws` — WebSocket broadcast channel (`action` ∈ upload, folder, rename, move, delete, edit)
- `GET /api/files?path=` — list a directory
- `GET /api/search?q=` — recursive name search (depth-capped)
- `GET /api/folders` — all folder paths (move dialog + sidebar tree)
- `GET /api/download?path=` — download (`&download=true`) or inline preview (explicit MIME + nosniff)
- `GET /api/content?path=` — read an editable text file (UTF-8 validated)
- `POST /api/content` — save an editable text file `{ path, content }`
- `POST /api/newfile` — create an empty editable file `{ path?, filename }`
- `POST /api/upload?path=` — multipart upload (nested paths supported; `mtimes` field preserves dates)
- `POST /api/folder` — create folder `{ name, path? }`
- `POST /api/rename` — rename `{ path, new_name }`
- `POST /api/move` — move `{ path, dest_dir? }`
- `POST /api/delete` — delete `{ path }`
- `GET /api/health` — healthcheck

## Runtime configuration (env)
- `BOX_PORT` (default `8086`)
- `BOX_BIND_ADDR` (default `127.0.0.1` — localhost-only; nginx terminates TLS in front)
- `BOX_UPLOAD_DIR` (default `./uploads`)
- `BOX_MAX_UPLOAD_BYTES` (default `209715200`, 200 MB)

## Safety / hardening
- **Path safety:** `clean_relative_path` strips `.`/`..` and splits on `/` *and* `\`;
  `resolve_path_safe` canonicalises and verifies containment within the upload root (blocks symlink
  traversal). Every handler that touches user paths uses it.
- **Input limits:** names capped at 255 chars, search query at 256; the upload `mtimes` metadata
  field is byte-capped before JSON parsing.
- **Recursion:** folder/search walks are depth-capped (`MAX_RECURSION_DEPTH = 64`).
- **De-dupe:** the unique-filename loop is bounded, falling back to a uuid suffix.
- **Middleware:** `Compress` + `PayloadConfig` (size limit) + request `Logger`.

## Deployment
Production runs as a systemd service bound to `127.0.0.1`, behind nginx (TLS via wildcard cert,
WebSocket upgrade, 500 MB body). Because the frontend is embedded at compile time, **any frontend
change requires `cargo build --release` + a service restart**. See `docs/DEPLOYMENT.md`.
