# Testing Boxy

## End-to-end (Playwright)
```bash
npm install
npx playwright install --with-deps chromium
npm run test:e2e
```
If the server is already running on the configured port, Playwright reuses it; otherwise it starts one.
Specs live in `tests/ui.spec.ts`.

## Build verification
```bash
cargo build --release     # must be warning-clean
cargo clippy              # optional lint pass
```

## Manual smoke checklist
- **Theme:** first load defaults to dark; toggle persists across reloads.
- **Sidebar:** folder tree renders; clicking a folder navigates; expand/collapse carets work;
  the collapse toggle hides/shows the tree (state persists); dragging a file onto a tree node moves it.
- **Files:** drag-drop / picker / clipboard upload; create folder + file; download; copy URL.
- **Inline rename:** right-click → Rename (or `F2` on the focused item) edits in place; Enter commits, Esc cancels.
- **Context menu:** right-click a file/folder shows the correct actions; closes on outside click / Esc.
- **Move:** drag onto a folder card or the sidebar; bulk move with multi-select.
- **Search/filter/sort:** name filter (debounced), type filter, sort; global search via `/`.
- **Tasks:** switch to Tasks; create/edit/delete a task; drag between columns; collapse a column;
  switch Kanban/List; export then import a board.
- **Live updates:** a change in one tab appears in another via WebSocket; reconnect after a restart.
- **Limits:** uploads larger than `BOX_MAX_UPLOAD_BYTES` are rejected; over-long names → error.

## Environment
- `BOX_PORT` (default 8086)
- `BOX_BIND_ADDR` (default `127.0.0.1`)
- `BOX_UPLOAD_DIR` (default `./uploads`)
- `BOX_MAX_UPLOAD_BYTES` (default `209715200`)
