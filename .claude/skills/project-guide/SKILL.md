---
description: Core development patterns for Boxy - a Rust+JS file sharing app
globs: src/**/*
alwaysApply: false
---

# Boxy Project Guide

## Tech Stack
- **Backend**: Rust + Actix-web 4
- **Frontend**: Vanilla JS + HTML + CSS (all embedded in one file)
- **Real-time**: WebSocket broadcast
- **Tests**: Playwright e2e
- **Deploy**: Docker multi-stage

## Project Structure
```
boxy/
├── src/main.rs              # Backend (all handlers)
├── static/
│   ├── index.html           # Main app (HTML + CSS + JS, single file)
│   └── favicon.ico
├── uploads/                 # File storage (gitignored)
├── tests/ui.spec.ts         # Playwright e2e tests
├── docs/                    # Architecture docs
├── Cargo.toml               # Rust config
└── package.json             # Playwright config
```

## Backend Patterns (src/main.rs)

### Architecture
- **Single-file design** - all handlers in main.rs
- **AppState** holds: `broadcaster` (tokio broadcast sender), `upload_dir` (PathBuf)
- **Settings from env** (main.rs `Settings::from_env`): `BOX_PORT` (default 8086),
  `BOX_UPLOAD_DIR` (default `./uploads`), `BOX_BIND_ADDR` (default `127.0.0.1`),
  `BOX_MAX_UPLOAD_BYTES` (default 200 MB)
- Frontend is served via `include_str!("../static/index.html")` — it is compiled into
  the binary, so **rebuild + restart after any frontend change**

### Security (CRITICAL)
```rust
// Always use resolve_path_safe for user-provided paths
let filepath = resolve_path_safe(&state.upload_dir, Some(&user_path))
    .ok_or_else(|| actix_web::error::ErrorForbidden("Invalid path"))?;
```
- `clean_relative_path()` - strips `..`, `.` and empty segments (splits on `/` and `\`)
- `resolve_path_safe()` - canonicalizes and verifies path stays within base directory (prevents symlink attacks)
- Never trust user-provided paths directly

### Handler Pattern
Handlers are plain async fns registered with `.route(...)` in `main()` (no attribute macros):
```rust
async fn handler(
    state: web::Data<AppState>,
    query: web::Query<Params>,
) -> Result<HttpResponse> {
    // 1. Extract and sanitize input
    // 2. Perform operation
    // 3. Broadcast if mutation
    // 4. Return JSON response
}
```

### WebSocket Broadcasting
```rust
// Broadcast all file mutations; clients receive JSON {action, path} on /ws
broadcast_update(&state.broadcaster, "upload", &path);
// Actions: upload, folder, rename, move, delete, edit
```

## API Endpoints

All routes registered in `main()` (main.rs ~1049-1067). Plus `GET /` (embedded UI),
`GET /favicon.ico`, and `GET /ws` (WebSocket live updates).

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/files?path=` | List directory |
| GET | `/api/search?q=` | Recursive file search |
| GET | `/api/folders` | All folder paths (move dialog + sidebar tree) |
| GET | `/api/download?path=` | Download/preview file |
| GET | `/api/download-zip?path=` | Download directory as ZIP |
| POST | `/api/download-zip-multi` | Download selected paths as ZIP `{ paths: [...] }` |
| GET | `/api/health` | Healthcheck |
| POST | `/api/upload?path=` | Upload (multipart, supports folders, dedupes name collisions) |
| POST | `/api/folder` | Create folder |
| POST | `/api/rename` | Rename item |
| POST | `/api/move` | Move item |
| POST | `/api/delete` | Delete item |
| POST | `/api/duplicate` | Duplicate file or folder `{ path }` |
| GET | `/api/content?path=` | Read editable text file |
| POST | `/api/content` | Save editable text file |
| POST | `/api/newfile` | Create empty editable file |

### Backend safeguards (keep these in mind)
- Use `resolve_path_safe()` (canonicalises + verifies containment), never raw `resolve_path()`.
- Names are length-capped (`MAX_NAME_LEN = 255`); search query capped (`MAX_SEARCH_LEN = 256`).
- Recursive walks (`collect_folders`, `collect_search_results`) take a `depth` arg capped at
  `MAX_RECURSION_DEPTH = 64`.
- Bind defaults to `127.0.0.1` via `BOX_BIND_ADDR`. The frontend is embedded, so **rebuild +
  `sudo systemctl restart boxy` after any change** (see `docs/DEPLOYMENT.md`).

### Files-view UI components (static/index.html)
- **Sidebar folder tree:** `loadSidebarTree` / `renderSidebar` (reuses `buildFolderTree`); drop a
  file onto a node to move it. Collapsed state + expanded set persist in `localStorage`.
- **Context menu:** `showContextMenu(e, path, name, isDir)` → `#contextMenu`; closes on outside
  click / Esc / scroll.
- **Inline rename:** `startInlineRename(itemEl)` (context menu or `F2`); commits via `/api/rename`.

### Cross-Browser Sync
- No server-side app data — the filesystem under `uploads/` is the only state
- WebSocket `/ws` broadcasts `{action, path}` on every file mutation
- All connected browsers reload the affected view when a message arrives

## Quick Commands
```bash
cargo run                    # Dev server (port 8086)
cargo build --release        # Production build
npm run test:e2e            # Playwright tests
docker compose up --build   # Docker deployment
```

## Rules
1. Keep backend in single main.rs (no module splitting unless >1000 lines)
2. HTML, CSS, and JS all live in `static/index.html` (CSS in the `<style>` block near the top)
3. Always sanitize paths before filesystem access
4. Broadcast all mutations via WebSocket
5. Use env vars for config with sensible defaults
6. **Use TLDR before reading files** — see tldr-first skill

## Related Skills
- **tldr-first**: Token-efficient exploration (TLDR commands first)
- **ui-patterns**: Frontend CSS/JS patterns
- **quality-checklist**: Pre-commit verification
