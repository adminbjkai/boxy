---
description: Core development patterns for Boxy - a Rust+JS file sharing app
globs: src/**/*
alwaysApply: false
---

# Boxy Project Guide

## Tech Stack
- **Backend**: Rust + Actix-web 4
- **Frontend**: Vanilla JS + HTML + CSS (embedded assets, split by concern)
- **Real-time**: WebSocket broadcast
- **Tests**: Playwright e2e
- **Deploy**: native systemd + nginx (Docker available as portable alternative)

## Project Structure
```
boxy/
├── src/main.rs              # Backend (all handlers)
├── static/
│   ├── index.html           # Main app markup (CSS: app.css; JS: app.js)
│   ├── favicon.ico
│   └── vendor/              # Vendored Prism.js, marked.js, fonts (offline)
├── fern/                    # Docs site (docs.boxy.bjk.ai): docs.yml, OpenAPI, pages
├── uploads/                 # File storage (gitignored)
├── tests/ui.spec.ts         # Playwright e2e tests
├── docs/                    # Architecture docs
├── scripts/                 # bump-version.sh, deploy.sh
├── Cargo.toml               # Rust config
└── package.json             # Playwright config
```

## Backend Patterns (src/main.rs)

### Architecture
- **Single-file design** - API handlers in main.rs, asset/archive helpers in focused modules
- **AppState** holds: `broadcaster` (tokio broadcast sender), `upload_dir` (PathBuf),
  `thumb_dir` (PathBuf, thumbnail cache), `max_upload_bytes` (usize)
- **Settings from env** (main.rs `Settings::from_env`): `BOX_PORT` (default 8086),
  `BOX_UPLOAD_DIR` (default `./uploads`), `BOX_BIND_ADDR` (default `127.0.0.1`),
  `BOX_MAX_UPLOAD_BYTES` (default 100 GiB; 0 in env = unlimited; app-enforced),
  `BOX_THUMB_DIR` (default `./thumbs`, kept outside the upload root so cache files never appear in listings)
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
broadcast_update(&state, "upload", &path);
// Actions: upload, folder, rename, move, delete, edit, copy
```

## API Endpoints

All routes are registered in `main()` (main.rs, bottom). The canonical references are
the table in `docs/ARCHITECTURE.md` (internal) and `fern/openapi/openapi.yml` (the
docs-site OpenAPI spec) — update **both** when adding an endpoint, plus README's table.
Every mutation must broadcast `{ action, path }` on the WebSocket.
## Quick Commands
```bash
cargo run                    # Dev server (port 8086)
cargo build --release        # Production build
npm run test:e2e            # Playwright tests
docker compose up --build   # Docker deployment
```

## Rules
1. Keep API handlers in main.rs and shared archive/asset operations in their focused modules
2. Markup lives in `static/index.html`, CSS in `static/app.css`, and JS in `static/app.js`; all are embedded in the binary
3. Always sanitize paths before filesystem access
4. Broadcast all mutations via WebSocket
5. Use env vars for config with sensible defaults
6. **Use TLDR before reading files** — see tldr-first skill

## Related Skills
- **tldr-first**: Token-efficient exploration (TLDR commands first)
- **ui-patterns**: Frontend CSS/JS patterns
- **quality-checklist**: Pre-commit verification
