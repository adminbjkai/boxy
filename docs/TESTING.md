# Testing Boxy

## End-to-end (Playwright)
```bash
npm install
npx playwright install --with-deps chromium
npm run test:e2e
```
If the server is already running on the configured port, Playwright reuses it; otherwise it starts one.
Specs live in `tests/ui.spec.ts`.

## Unit tests (Rust)
```bash
cargo test                # 23 tests: path safety, dedupe, name validation,
                          # thumb cache keys, stats walk, copy rejection cases
```

## Build verification
```bash
cargo build --release     # must be warning-clean
cargo clippy              # optional lint pass
```

## Manual smoke checklist

### Core navigation
- **Theme:** first load defaults to dark; toggle persists across reloads.
- **Sidebar:** folder tree renders; clicking a folder navigates; expand/collapse carets work;
  the collapse toggle hides/shows the tree (state persists); dragging a file onto a tree node moves it.
- **Sidebar toolbar:** show-files toggle adds files to the sidebar tree; expand-all and collapse-all
  buttons work; state persists.
- **URL hash navigation:** navigate into a folder and confirm the URL hash updates; paste the URL
  in a new tab and verify the correct folder opens.
- **Live path bar:** click the editable path input in the nav bar, type a folder path, press Enter
  to navigate directly.

### File operations
- **Upload:** drag-drop, file picker, and clipboard paste all upload correctly; upload progress panel
  shows per-file status with progress bars.
- **Create:** create folder and new empty text file.
- **Inline rename:** right-click → Rename (or `F2` on the focused item) opens an in-place input;
  Enter commits, Esc cancels; works in both grid and list view.
- **Context menu:** right-click a file/folder shows all correct actions (Preview, Download, Copy URL,
  Edit, Rename, Move, Copy, Cut, Paste when clipboard non-empty, Duplicate, Delete); closes on
  outside click or Esc.
- **Clipboard:** Ctrl/Cmd+C on a selection then Ctrl/Cmd+V in another folder pastes copies
  (collisions dedupe to `_1`); Ctrl/Cmd+X dims the items and V moves them; Esc clears a cut;
  shortcuts are inert while typing in an input or with a modal open.
- **Move:** drag onto a folder card or the sidebar; bulk move with multi-select; move modal tree.
- **Duplicate:** right-click → Duplicate appends `_1` (or `_2`, etc.) and appears in the file list.
- **Delete:** single file/folder delete and bulk delete via multi-select.
- **Download:** per-file download button; folder ZIP download (`?download=1` param and button);
  multi-select ZIP download via bulk bar.

### Views and filtering
- **Grid/list toggle:** switching views persists; grid shows thumbnail cards, list shows sortable columns.
- **Thumbnails:** grid image tiles request `/api/thumb` (network tab shows small JPEGs, not
  full-size originals); a corrupt image falls back to the type icon; repeat visits hit the cache.
- **Skeleton loading:** navigating to a folder briefly shows shimmer placeholders, no blank flash;
  same-folder WebSocket refreshes do not blank the grid.
- **Shortcuts modal:** `?` (and the toolbar `?` button) opens the help modal; Esc/backdrop closes.
- **Storage footer:** sidebar bottom shows "N files · N folders · size"; updates within ~2s of an
  upload or delete.
- **Zoom slider:** slider in toolbar resizes grid cards (80–200 px) or adjusts list row density;
  value persists.
- **List view columns:** Name, Type, Size, Date (MM/DD/YYYY), Time — sortable by clicking headers;
  folders always appear first.
- **Per-column filters:** click the filter icon on Name, Type, or Date column headers; dropdown shows
  text search input plus value checkboxes; filtering updates the list live; Clear button resets.
- **Inline folder expand:** in list view, single-clicking a folder row (or clicking the triangle)
  expands it inline showing children; subdirectory children show their own triangle and can be
  expanded recursively; contracting the parent hides all nested contents.
- **Search/filter/sort:** name filter (debounced), type filter (Images/Documents/Code/Media),
  global recursive search via `/`.
- **Multi-select mode:** toolbar toggle enables single-click selection without Ctrl/Cmd; bulk bar
  appears with move/delete/ZIP-download actions.

### Editor
- **Open editor:** double-click an editable file (txt, py, json, md, rs, js, ts, html, css, etc.)
  to open the in-browser editor.
- **Syntax highlighting:** code files render with Prism.js language-appropriate colouring.
- **Markdown preview:** `.md` files have a rendered-preview toggle alongside the raw edit mode.
- **Autosave:** edits debounce-save after 2 seconds; status indicator confirms save.
- **Save shortcut:** Ctrl/Cmd+S saves immediately.

### Image lightbox
- **Lightbox:** clicking an image file opens full-screen lightbox; left/right arrow keys navigate
  between images; Esc closes.

### Real-time / WebSocket
- **Live updates:** a change in one tab (upload, rename, delete) appears in another tab via WebSocket
  broadcast without a manual refresh.
- **Reconnect:** disconnect from the server and reconnect; the client reconnects with exponential
  backoff and re-loads files.

### Limits & errors
- **Upload size:** uploads larger than `BOX_MAX_UPLOAD_BYTES` are rejected with an error toast.
- **Long names:** names longer than 255 characters produce a 400 error toast.

## Environment variables
| Variable | Default | Purpose |
|----------|---------|---------|
| `BOX_PORT` | `8086` | HTTP listen port |
| `BOX_BIND_ADDR` | `127.0.0.1` | Bind address |
| `BOX_UPLOAD_DIR` | `./uploads` | Upload root |
| `BOX_MAX_UPLOAD_BYTES` | `209715200` | Max payload (200 MB) |
