# Testing Boxy

## End-to-end (Playwright)
```bash
npm install
npx playwright install --with-deps
npm run test:e2e
```
If the server is already running on the configured port, tests will reuse it; otherwise Playwright will start it.

## Manual checks
- Upload: drag-drop or select a file; confirm it appears and is downloadable.
- Upload progress: verify per-file status updates and error messaging on failed uploads.
- Folder ops: create folder, move, rename, delete; verify WebSocket updates refresh the grid.
- Search/sort: filter list by name, toggle sort.
- List view: inline rename works (Enter to save, Esc to cancel, blur to save).
- Multi-select: selection bar shows bulk move/delete/download and hides at 0 selected.
- Limits: uploads > configured `BOX_MAX_UPLOAD_BYTES` should be rejected.
- Data sync: create a task or dashboard tile in one browser and verify another browser updates via WebSocket (`data_sync`).
- UI polish: verify favicon loads, tasks empty-state CTA shows, and toolbar remains visible on scroll.

## Environment
- `BOX_PORT` (default 8086)
- `BOX_UPLOAD_DIR` (default `./uploads`)
- `BOX_DATA_DIR` (default `./data`)
- `BOX_MAX_UPLOAD_BYTES` (default `209715200`)
