---
description: Core development patterns for Boxy - a Rust+JS file sharing app
globs: src/**/*
alwaysApply: false
---

# Boxy Project Guide

## Tech Stack
- **Backend**: Rust + Actix-web 4
- **Frontend**: Vanilla JS + HTML (embedded)
- **Real-time**: WebSocket broadcast
- **Tests**: Playwright e2e
- **Deploy**: Docker multi-stage

## Project Structure
```
boxy/
├── src/main.rs          # Monolithic backend (all handlers)
├── static/index.html    # Complete frontend (HTML + CSS + JS)
├── tests/ui.spec.ts     # Playwright e2e tests
├── docs/                # Architecture docs
├── uploads/             # File storage (gitignored)
├── Cargo.toml           # Rust config
└── package.json         # Playwright config
```

## Backend Patterns (src/main.rs)

### Architecture
- **Single-file design** - all handlers in main.rs
- **AppState** holds: broadcaster, upload_dir, max_upload_bytes
- **Settings from env**: `BOX_PORT`, `BOX_UPLOAD_DIR`, `BOX_MAX_UPLOAD_BYTES`

### Security (CRITICAL)
```rust
// Always use resolve_path_safe for user-provided paths
let filepath = resolve_path_safe(&state.upload_dir, Some(&user_path))
    .ok_or_else(|| actix_web::error::ErrorForbidden("Invalid path"))?;
```
- `clean_relative_path()` - strips `..` and empty segments
- `resolve_path_safe()` - canonicalizes and verifies path stays within base directory (prevents symlink attacks)
- Never trust user-provided paths directly

### Handler Pattern
```rust
#[get("/api/endpoint")]
async fn handler(
    state: web::Data<AppState>,
    query: web::Query<Params>,
) -> impl Responder {
    // 1. Extract and sanitize input
    // 2. Perform operation
    // 3. Broadcast if mutation
    // 4. Return JSON response
}
```

### WebSocket Broadcasting
```rust
// Broadcast all file mutations
broadcast_update(&state.broadcaster, "upload", &path);
// Actions: upload, rename, move, delete, folder
```

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/files?path=` | List directory |
| GET | `/api/search?q=` | Recursive file search |
| GET | `/api/folders` | All folder paths |
| GET | `/api/download?path=` | Download/preview file |
| GET | `/api/health` | Healthcheck |
| POST | `/api/upload?path=` | Upload (multipart, supports folders) |
| POST | `/api/folder` | Create folder |
| POST | `/api/rename` | Rename item |
| POST | `/api/move` | Move item |
| POST | `/api/delete` | Delete item |

## Kanban Board System (Frontend)

### Data Structure
```javascript
// localStorage keys
boxy_boards         // Array of all boards
boxy_current_board  // ID of active board

// Board structure
{
  id: 'abc123',
  name: 'My Board',
  columns: [{ id: 'todo', name: 'Todo', order: 0 }, ...],
  tasks: [{ id, title, description, status, priority, dueDate, tags, createdAt }, ...],
  createdAt: 1705400000000
}
```

### Key Functions
- `loadBoards()` - Load from localStorage, auto-migrates old `boxy_tasks`/`boxy_columns` format
- `saveBoards()` - Persist all boards
- `saveCurrentBoard()` - Sync working `tasks`/`columns` to active board
- `switchBoard(boardId)` - Change active board, updates UI
- `renderBoardSelector()` - Update board dropdown
- `showBoardModal(boardId?)` - Create/rename board modal

### Working Variables
```javascript
let boards = [];           // All boards array
let currentBoardId = null; // Active board
let tasks = [];            // Current board's tasks (working copy)
let columns = [];          // Current board's columns (working copy)
```

## Quick Commands
```bash
cargo run                    # Dev server (port 8086)
cargo build --release        # Production build
npm run test:e2e            # Playwright tests
docker compose up --build   # Docker deployment
```

## Rules
1. Keep backend in single main.rs (no module splitting unless >1000 lines)
2. Frontend stays embedded via `include_str!`
3. Always sanitize paths before filesystem access
4. Broadcast all mutations via WebSocket
5. Use env vars for config with sensible defaults

## Related Skills
- **ui-patterns**: Frontend CSS/JS patterns
- **quality-checklist**: Pre-commit verification
