# Boxy

Boxy is a fast, self-hosted **file sharing + task board** web app. It pairs a real-time file
manager (drag-and-drop uploads, folders, inline editing, live updates) with a built-in Kanban
board — all in a single Rust binary that serves one embedded HTML page. No database, no build
step for the frontend, no external JS/CSS dependencies (web fonts only).

- **Backend:** Rust + Actix-web 4 (single file, `src/main.rs`)
- **Frontend:** Vanilla JS + CSS embedded in `static/index.html` (served via `include_str!`)
- **Real-time:** WebSocket fan-out (`/ws`) broadcasts every file mutation to all clients
- **Storage:** the local `./uploads` directory (volume-mountable in Docker)
- **Theme:** dark-mode-first, lightweight (pure CSS, honours `prefers-reduced-motion`)

## Features

### Files
- Drag-and-drop, clipboard paste, and whole-folder uploads (original modification dates preserved)
- **Collapsible sidebar folder tree** for fast navigation; drop files onto a folder to move them
- Folder navigation with breadcrumbs; create / move / **inline-rename** / delete
- **Right-click context menu** (Preview, Download, Copy URL, Edit, Rename, Move, Delete)
- Multi-select (Ctrl/Cmd+click, Shift+click) with bulk move / delete
- Drag-and-drop move (onto a folder card **or** onto the sidebar tree)
- Global recursive search (`/`) and per-folder filter by name + type (Images, Documents, Code, Media)
- Grid / list view toggle (persisted); sortable list columns (Name, Type, Size, Date)
- Image thumbnails with lazy loading; skeleton loaders on first paint
- In-browser text editor for editable types (`txt, csv, py, json, md, rs, js, html, css, toml, yaml, yml`)
- Create new empty text files in-app

### Tasks (Kanban)
- Multiple boards (create / rename / delete / switch), persisted in `localStorage`
- Customisable columns (add / rename / delete / collapse); drag tasks between and within columns
- Tasks with title, description, priority, due date, and tags
- Kanban **and** sortable list views; search + status/priority filtering
- Export a board to JSON and import/merge boards back in

### Platform
- Live updates across clients via WebSocket, with exponential-backoff reconnect
- Dark/light theme toggle (dark by default); accessible focus styles and ARIA roles
- Keyboard navigation (arrows, Enter, Backspace, Escape, `/` search, `F2` rename, Ctrl/Cmd+S save)

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

## API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | Static UI |
| GET | `/ws` | WebSocket live-update channel |
| GET | `/api/files?path=` | List a directory |
| GET | `/api/search?q=` | Recursive name search |
| GET | `/api/folders` | All folder paths (move dialog + sidebar tree) |
| GET | `/api/download?path=` | Download (`&download=true`) or inline preview |
| GET | `/api/content?path=` | Read an editable text file |
| POST | `/api/content` | Save an editable text file `{ path, content }` |
| POST | `/api/newfile` | Create an empty editable file `{ path?, filename }` |
| POST | `/api/upload?path=` | Multipart upload (supports nested folder paths) |
| POST | `/api/folder` | Create folder `{ name, path? }` |
| POST | `/api/rename` | Rename `{ path, new_name }` |
| POST | `/api/move` | Move `{ path, dest_dir? }` |
| POST | `/api/delete` | Delete `{ path }` |
| GET | `/api/health` | Healthcheck |

WebSocket messages are `{ action, path }` where `action` is one of
`upload, folder, rename, move, delete, edit`.

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
- `docs/ARCHITECTURE.md` — components, data flow, subsystems
- `docs/DEPLOYMENT.md` — production deployment (systemd + nginx reverse proxy)
- `docs/TESTING.md` — e2e + manual test checklist
- `docs/UI_WALKTHROUGH.md` — UI tour
- `docs/code-audit.md` — security/code audit (current status)

## Docker
```bash
docker compose up --build      # or: docker build -t boxy . && docker run -p 8086:8086 -v $(pwd)/uploads:/app/uploads boxy
```
