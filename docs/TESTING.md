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
- Folder ops: create folder, move, rename, delete; verify WebSocket updates refresh the grid.
- Search/sort: filter list by name, toggle sort.
- Limits: uploads > configured `BOX_MAX_UPLOAD_BYTES` should be rejected.

## Environment
- `BOX_PORT` (default 8086)
- `BOX_UPLOAD_DIR` (default `./uploads`)
- `BOX_MAX_UPLOAD_BYTES` (default `209715200`)
