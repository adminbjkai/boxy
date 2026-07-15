# Boxy Implementation Guide (AI Dev)

**Audience:** Developers implementing UX and feature improvements
**Last updated:** July 14, 2026

---

## Architecture in one paragraph

Boxy is a single Rust binary (`src/main.rs`, ~1680 lines) that embeds the entire frontend as a
compile-time string (`include_str!("../static/index.html")`). All UI logic — HTML, CSS, and JS — lives
in `static/index.html` (~5370 lines). There is no build step for the frontend; no bundler, no
framework. Any change to either file requires `cargo build --release` and a service restart to take
effect. See `docs/ARCHITECTURE.md` for the full component map.

---

## State and persistence model

| What | Where |
|------|-------|
| File data | `./uploads/` on disk (tokio::fs) |
| UI preferences | `localStorage` via the `ls` helper wrapper |
| Live sync | WebSocket `/ws` — every mutation broadcasts `{ action, path }` to all tabs |
| Server config | Environment variables (see ARCHITECTURE.md) |

Preferences persisted in `localStorage`: `viewMode`, `filterType`, `listSortCol`, `listSortDir`,
`boxy_sidebar_expanded`, `boxy_sidebar_collapsed`, `itemScale`, `sidebarShowFiles`, `theme`.

---

## Feature inventory (current as of July 2026)

### Files view
- **Grid / list toggle** — persisted; grid shows image thumbnails (cached 320px JPEGs from
  `/api/thumb` for raster formats, `RASTER_THUMB_EXTENSIONS`; SVG stays on `/api/download`),
  list shows sortable columns
- **Skeleton loading** — `showSkeleton()` renders shimmer placeholder tiles/rows while a
  folder listing fetches (only when navigating to a different path)
- **Zoom slider** — CSS `--item-scale` custom property, 80–200 px range, persisted as `itemScale`
- **List view** — Name / Type / Size / Date (MM/DD/YYYY) / Time columns, sortable; folders first
- **Per-column Excel-style filters** — dropdown with text search + checkbox values + Clear;
  state in `colFilters` (checkbox) and `colTextFilters` (text) module-scope vars
- **Inline folder expand** (list view) — recursive; triangle on every dir row; uses
  `expandedFolderPaths` (Set) and `expandedFolderContents` (object keyed by path);
  `buildInlineChildren(path, depth)` renders nested rows with CSS `--inline-depth` for indentation
- **Multi-select** — Ctrl/Cmd+click, Shift+click, or multi-select mode toggle; bulk bar with
  Move / ZIP Download / Delete; state in `selectedFiles` (Set)
- **Upload progress** — per-file status panel; `uploadQueue` (Promise chain) serializes batches
- **Global recursive search** — `/api/search?q=`, depth-capped
- **Name filter + type filter** — debounced name filter, type buttons (Images/Documents/Code/Media)
- **Live path bar** — editable `<input id="pathBar">` in nav bar
- **Sidebar** — folder tree from `/api/folders`; expand/collapse; show-files toggle (async fetches
  children for open nodes); drag-drop move; expand-all / collapse-all toolbar
- **Storage footer** — `loadSidebarStats()` renders root totals from `/api/stats` under the
  sidebar tree; debounced 2s refresh on WS messages; hides itself if the endpoint fails
- **Shortcuts modal** — `#shortcutsModal`, opened by `?` key or toolbar button

### File actions
- **Upload** — drag-drop, picker, clipboard paste; preserves folder structure and mtimes
- **Create folder / new file** — modals
- **Inline rename** — `startInlineRename(itemEl)` replaces `.file-name` span with an input in DOM;
  works in grid and list view; triggered by rename button, F2, or context menu
- **Move** — modal with folder tree; drag-drop onto card or sidebar node
- **Duplicate** — `POST /api/duplicate`; server appends `_1`, `_2`, etc.
- **Clipboard copy/cut/paste** — module state `clipboard = { paths, mode }`; Ctrl/Cmd+C/X/V
  (guarded against inputs/modals) and context-menu Copy / Cut / Paste (Paste only when
  clipboard non-empty, targets the current folder); copy → `POST /api/copy` per path,
  cut → `POST /api/move`; cut items get `.cut-item` dimming until pasted or Esc
- **Delete** — single item and bulk
- **Download** — single file; folder ZIP (`GET /api/download-zip?path=`);
  multi-select ZIP (`POST /api/download-zip-multi`)
- **Copy URL** — copies `/api/download?path=…` to clipboard

### Editor
- **Open** — double-click any file in `EDITABLE_EXTENSIONS` list
- **Syntax highlight** — Prism.js, vendored under `static/vendor/` (no CDN)
- **Markdown preview** — marked.js, vendored under `static/vendor/` (no CDN)
- **Autosave** — 2-second debounce; Ctrl/Cmd+S for immediate save

### Image lightbox
- Full-screen; keyboard ← → to navigate; Esc to close
- `lightboxImages` array populated from visible image items at open time

### Context menu
- Right-click any item: Preview, Download, Copy URL, Edit, Rename, Move, Copy, Cut, Paste
  (when clipboard non-empty), Duplicate, Download ZIP, Delete

---

## Key implementation patterns

### Adding a new API endpoint
1. Add handler function in `src/main.rs` (follow the `clean_relative_path` + `resolve_path_safe`
   pattern for any user-supplied path).
2. Register the route in `HttpServer::new` (bottom of `main()`).
3. Broadcast a WS message if the mutation should fan out to other clients.
4. Add a `fetch` call in the JS and wire it to a UI action.
5. Update `docs/ARCHITECTURE.md` API surface table and `README.md` API table.

### Adding a new editable file type
- Backend: add the extension to `EDITABLE_EXTENSIONS` in `src/main.rs`.
- Frontend: add it to the `EDITABLE_EXTENSIONS` array in `static/index.html`.
- Prism.js will auto-highlight if it knows the language; otherwise the editor falls back to plain text.

### Adding a new UI preference
- Add `let myPref = ls.get('myPref', 'default');` in the module-scope state block (~line 2060).
- Persist on change: `ls.set('myPref', value)`.
- The `ls` wrapper handles `localStorage` unavailability (privacy-blocking browsers).

### CSS conventions
- All colour and spacing tokens are CSS custom properties on `:root` (dark) and
  `[data-theme="light"]` override blocks.
- Animation: use `transition` / `@keyframes`; honour `prefers-reduced-motion`.
- Tooltips: `data-tip="label"` on any element renders a CSS-only tooltip via `[data-tip]::after`.

---

## Files likely to change

| File | Changes to |
|------|-----------|
| `src/main.rs` | Backend handlers, routes, security, ZIP/duplicate logic |
| `static/index.html` | All UI: HTML structure, CSS tokens, JS state and handlers |
| `docs/ARCHITECTURE.md` | When API or component model changes |
| `docs/TESTING.md` | When new testable behaviors are added |
| `README.md` | When features or API surface changes |

---

## Testing checklist (manual)

- Files: grid/list toggle; upload (drag-drop, picker, clipboard); create folder + file
- Zoom slider: resizes grid cards; persists on reload
- List view: columns sortable; Date shows MM/DD/YYYY; per-column filters (text + checkbox + Clear)
- Inline folder expand: triangle visible on all dirs; recursive nesting; collapses on click
- Rename: rename button → in-place input; Enter commits, Esc cancels; F2 on focused item
- Context menu: all actions present and correct; Duplicate creates `_1` copy; right-click closes on Esc
- Clipboard: Ctrl/Cmd+C then V pastes a copy; Ctrl/Cmd+X dims the item and V moves it;
  paste collision creates `_1`; Esc clears a cut
- Thumbnails: grid image tiles request `/api/thumb` (check network tab); broken image falls back to icon
- Shortcuts modal: `?` opens it; Esc / backdrop closes; toolbar button works
- Storage footer: shows totals; updates after upload/delete
- Move: drag onto folder card; drag onto sidebar node; move modal
- Download: single file; folder ZIP; multi-select ZIP
- Editor: syntax highlight for code files; rendered preview for `.md`; autosave indicator
- Lightbox: opens on image click; arrow navigation; Esc closes
- Multi-select: Ctrl+click, Shift+click, mode toggle; bulk bar actions
- Sidebar: show-files toggle; expand/collapse; expand-all/collapse-all
- Live path bar: type a path, Enter navigates
- URL hash: navigate into folder, reload, same folder opens
- WebSocket: change in tab A appears in tab B without refresh
- Theme toggle: persists; dark is default
