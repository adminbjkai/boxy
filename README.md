# Boxy

[![CI](https://github.com/adminbjkai/boxy/actions/workflows/ci.yml/badge.svg)](https://github.com/adminbjkai/boxy/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/v/release/adminbjkai/boxy)](https://github.com/adminbjkai/boxy/releases) [![Changelog](https://img.shields.io/badge/changelog-keep--a--changelog-blue)](CHANGELOG.md)

Boxy is a fast, self-hosted **file sharing** web app. It provides a real-time file
manager (drag-and-drop uploads, folders, inline editing, live updates) — all in a single Rust
binary that serves one embedded HTML page. No database, no build step for the frontend, and no
runtime CDN dependencies — fonts, Prism.js, and marked.js are vendored under `static/vendor/`,
so the app works fully offline.

- **Backend:** Rust + Actix-web 4 (single file, `src/main.rs`)
- **Frontend:** Vanilla JS + CSS embedded in `static/index.html` (served via `include_str!`)
- **Real-time:** WebSocket fan-out (`/ws`) broadcasts every file mutation to all clients
- **Storage:** the local `./uploads` directory (volume-mountable in Docker)
- **Theme:** dark-mode-first, lightweight (pure CSS, honours `prefers-reduced-motion`)

## Features

### Files
- Drag-and-drop, clipboard paste, and whole-folder uploads (original modification dates preserved)
- **Collapsible sidebar folder tree** for fast navigation; drop files onto a folder to move them
- Folder navigation with breadcrumbs and **URL hash navigation** (current folder reflected in the URL); create / move / **inline-rename** / delete
- **Right-click context menu** (Preview, Download, Copy URL, Edit, Rename, Move, Copy, Cut, Paste, Delete)
- **Clipboard copy / cut / paste** — Ctrl/Cmd+C / X / V on files and folders (single or multi-select); cut items dim until pasted; name collisions auto-dedupe (`name_1`, …)
- Multi-select (Ctrl/Cmd+click, Shift+click, or **multi-select mode toggle**) with bulk move / delete / **ZIP download**
- Drag-and-drop move (onto a folder card **or** onto the sidebar tree)
- Global recursive search (`/`) and per-folder filter by name + type (Images, Documents, Code, Media)
- **Per-column Excel-style filters** in list view (Name, Type, Date) with a Clear option
- Grid / list view toggle (persisted); sortable list columns (Name, Type, Size, Date, Time); **folders always sorted first**
- **List view**: separate Date + Time columns; single-click folder row to **inline expand** contents
- **Zoom slider** in toolbar — resizes grid cards (80–200px) or adjusts list row density
- **Live path bar** — editable address input, press Enter to navigate to any path
- **Sidebar toolbar**: toggle showing files in tree, expand-all, collapse-all buttons
- **Server-side image thumbnails** — grid tiles load cached 320px JPEGs from `/api/thumb` (not full-size originals), lazily; skeleton shimmer placeholders while a folder loads
- **Image lightbox** — full-screen viewer with keyboard arrow navigation
- In-browser text editor for editable types (`txt, csv, py, json, md, rs, js, ts, html, css, toml, yaml, yml, sql, m3u, sh, go, rb, php, xml`)
- **Syntax highlighting** (Prism.js) and **rendered Markdown preview** in editor view mode
- **Autosave** — 2-second debounce saves changes automatically while editing
- Create new empty text files in-app; **Duplicate** any file or folder via context menu
- **ZIP downloads**: per-directory (`?download=1` on folder URLs) or multi-selection

### Platform
- Live updates across clients via WebSocket, with exponential-backoff reconnect
- Dark/light theme toggle (dark by default); accessible focus styles and ARIA roles
- Keyboard navigation (arrows, Enter, Backspace, Escape, `/` search, `F2` rename, Ctrl/Cmd+S save, Ctrl/Cmd+C/X/V clipboard) — press `?` for the in-app shortcuts reference
- **Sidebar storage footer** — live totals (files · folders · size) for the upload root

## Run locally
```bash
cargo run            # dev server on http://localhost:8086
```
Configuration (all optional, via environment variables):

| Variable | Default | Purpose |
|----------|---------|---------|
| `BOX_PORT` | `8086` | HTTP listen port |
| `BOX_BIND_ADDR` | `127.0.0.1` | Bind address (localhost-only by default; nginx fronts it) |
| `BOX_UPLOAD_DIR` | `./uploads` | Upload root directory |
| `BOX_MAX_UPLOAD_BYTES` | `209715200` | Max request payload (200 MB) |
| `BOX_THUMB_DIR` | `./thumbs` | Thumbnail cache directory (outside the upload root) |

## API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | Static UI |
| GET | `/ws` | WebSocket live-update channel |
| GET | `/api/files?path=` | List a directory |
| GET | `/api/search?q=` | Recursive name search |
| GET | `/api/folders` | All folder paths (move dialog + sidebar tree) |
| GET | `/api/download?path=` | Download (`&download=true`) or inline preview |
| GET | `/api/thumb?path=` | Cached image thumbnail (max edge 320px, JPEG); 404 for non-raster files |
| GET | `/api/stats?path=` | Recursive directory stats `{ files, folders, bytes }` |
| GET | `/api/content?path=` | Read an editable text file |
| POST | `/api/content` | Save an editable text file `{ path, content }` |
| POST | `/api/newfile` | Create an empty editable file `{ path?, filename }` |
| POST | `/api/upload?path=` | Multipart upload (supports nested folder paths) |
| POST | `/api/folder` | Create folder `{ name, path? }` |
| POST | `/api/rename` | Rename `{ path, new_name }` |
| POST | `/api/move` | Move `{ path, dest_dir? }` |
| POST | `/api/delete` | Delete `{ path }` |
| POST | `/api/duplicate` | Duplicate file or folder `{ path }` → `{ path }` |
| POST | `/api/copy` | Copy file or folder into a folder `{ path, destination }` → `{ ok, path }` |
| GET | `/api/download-zip?path=` | Download directory as ZIP |
| POST | `/api/download-zip-multi` | Download selected paths as `selection.zip` `{ paths: [...] }` |
| GET | `/api/health` | Healthcheck |

WebSocket messages are `{ action, path }` where `action` is one of
`upload, folder, rename, move, delete, edit, copy`.

## Security model
- All user paths pass through `clean_relative_path` + `resolve_path_safe` (canonicalised and
  verified to stay within the upload root — blocks `..`, backslash, and symlink traversal).
- User-supplied names are length-capped (≤255) and have `/ \ \0` stripped; search queries are capped.
- Recursive folder/search walks are depth-capped (64) to resist deep-tree / symlink-loop abuse.
- Frontend escapes all user content (`escapeHtml` / `escapeAttr`); `X-Content-Type-Options: nosniff`
  on downloads. The app is designed to run **localhost-only behind nginx** (TLS terminated there).
- See `docs/code-audit.md` for the current security posture and accepted trade-offs.

## Tests
```bash
npm install
npx playwright install --with-deps chromium
npm run test:e2e
```
If the server is already running on the configured port, Playwright reuses it.

## Documentation
- **[docs.boxy.bjk.ai](https://docs.boxy.bjk.ai)** — the hosted docs site (guides, API reference, changelog)
- `fern/` — [Fern](https://github.com/fern-api/fern) docs project behind it (guides + OpenAPI API reference + dated changelog); served by the `boxy-docs` systemd service, validate with `npx fern-api check`
- The API is also exposed at **[api.boxy.bjk.ai](https://api.boxy.bjk.ai)** (same app, dedicated nginx vhost for integrations)
- `docs/ARCHITECTURE.md` — components, data flow, API surface, env config
- `docs/DEPLOYMENT.md` — production deployment (systemd + nginx reverse proxy)
- `docs/TESTING.md` — e2e + manual test checklist for all current features
- `docs/UI_WALKTHROUGH.md` — UI tour with feature descriptions
- `docs/IMPLEMENTATION_GUIDE.md` — feature inventory, patterns, and dev checklist for AI/human contributors
- `docs/code-audit.md` — security posture and accepted trade-offs

## Docker
```bash
docker compose up --build      # or: docker build -t boxy . && docker run -p 8086:8086 -v $(pwd)/uploads:/app/uploads boxy
```

## Diagrams and screenshots

Previously generated architecture diagrams and UI screenshots are archived in `docs/archive/`
(images in `docs/archive/assets/images/`, prompts in `docs/archive/prompts/`, presentation decks in
`docs/archive/presentation*/`). These predate the current UI and are kept for reference only.

To regenerate UI screenshots against the current build, run:
```bash
BOX_UPLOAD_DIR=./uploads_docs BOX_PORT=8086 cargo run --release &
node docs/capture-ui-screenshots.mjs
```
Output is written to `docs/assets/images/`.
