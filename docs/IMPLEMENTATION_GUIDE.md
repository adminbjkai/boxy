# Boxy Implementation Guide (AI Dev)

**Audience:** Developers implementing UX and feature improvements
**Last updated:** October 3, 2026 (v1.6.0)

---

## Architecture in one paragraph

Boxy is a single Rust binary. `src/main.rs` owns API handlers and configuration;
`src/assets.rs` serves explicitly allowlisted embedded assets and `src/archive.rs` builds ZIPs.
The UI is `static/index.html` (markup), `static/app.css` (styles), and `static/app.js` (behavior).
There is no frontend build step, bundler, or framework. All assets are embedded at compile time;
rebuild and restart after changes. See `docs/ARCHITECTURE.md` for the component map.

---

## State and persistence model

| What | Where |
|------|-------|
| File data | `./uploads/` on disk (tokio::fs) |
| UI preferences | `localStorage` via the `ls` helper wrapper |
| Live sync | WebSocket `/ws` — every mutation broadcasts `{ action, path }` to all tabs |
| Server config | Environment variables (see ARCHITECTURE.md) |

Preferences persisted in `localStorage`: `viewMode`, `filterType`, `listSortCol`, `listSortDir`,
`boxy_sidebar_expanded`, `boxy_sidebar_collapsed`, `itemScale`, `sidebarShowFiles`, `theme`, `sortMode`, `boxy_pins`.

---

## Feature inventory (current as of October 2026)

### Header
- **Docs button** — links to repository documentation (new tab); **theme toggle**; live WS status dot

### Files view
- **Quick access** — pinned folders (maximum 12) persist locally and sync across tabs.
- **Workspace controls** — folder summary, Refresh, clear-all filters, mobile folder toggle.
- **Grid / list toggle** — persisted; grid shows image thumbnails (cached 320px JPEGs from
  `/api/thumb` for raster formats, `RASTER_THUMB_EXTENSIONS`; SVG stays on `/api/download`),
  list shows sortable columns
- **Skeleton loading** — `showSkeleton()` renders shimmer placeholder tiles/rows while a
  folder listing fetches (only when navigating to a different path)
- **Zoom slider** — grid column width/list padding, 80–200 px range, persisted as `itemScale`
- **List view** — Name / Type / Size / Date (MM/DD/YYYY) / Time columns, sortable; folders first
- **Per-column Excel-style filters** — dropdown with text search + checkbox values + Clear;
  state in `colFilters` (checkbox) and `colTextFilters` (text) module-scope vars
- **Inline folder expand** (list view) — recursive; triangle on every dir row; uses
  `expandedFolderPaths` (Set) and `expandedFolderContents` (object keyed by path);
  `buildInlineChildren(path, depth)` renders nested rows with CSS `--inline-depth` for indentation
- **Multi-select** — Ctrl/Cmd+click, Shift+click, or multi-select mode toggle; bulk bar with
  Move / ZIP Download / Delete; state in `selectedFiles` (Set)
- **Upload progress** — per-file status panel with transfer speed and ETA; `uploadQueue` (Promise chain) serializes batches
- **Clipboard paste & button** — "Paste from Clipboard" button in drop zone reads clipboard binary items & text directly via `navigator.clipboard.read()`; Ctrl/Cmd+V pastes images/files/text; `?pastedebug=1` diagnostic overlay; `scripts/boxy-paste-mac.sh` helper for macOS Finder integrations
- **Global recursive search** — `/api/search?q=`, depth-capped
- **Name filter + type filter** — debounced name filter, type selector (Images/Documents/Code/Media)
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
- **Markdown preview** — marked.js + DOMPurify sanitization, vendored under `static/vendor/` (no CDN)
- **Autosave** — serialized 2-second debounce; close flushes pending edits; errors retain editor content; Ctrl/Cmd+S saves immediately

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
- Frontend: add it to the `EDITABLE_EXTENSIONS` array in `static/app.js`.
- Prism.js will auto-highlight if it knows the language; otherwise the editor falls back to plain text.

### Adding a new UI preference
- Add `let myPref = ls.get('myPref', 'default');` in the module-scope state block (near the start of `static/app.js`).
- Persist on change: `ls.set('myPref', value)`.
- The `ls` wrapper handles `localStorage` unavailability (privacy-blocking browsers).

### CSS conventions
- Colour and layout tokens live in `static/app.css`: `:root` defines light mode and
  `[data-theme="dark"]` overrides it. JavaScript defaults to dark when no preference is stored.
- Animation: use `transition` / `@keyframes`; honour `prefers-reduced-motion`.
- Tooltips: `data-tip="label"` on any element renders a CSS-only tooltip via `[data-tip]::after`.

---

## Files likely to change

| File | Changes to |
|------|-----------|
| `src/main.rs` | Backend handlers, routes, path safety, and copy/duplicate logic |
| `static/index.html` | Accessible HTML structure |
| `static/app.css` | Theme tokens, layouts, and motion |
| `static/app.js` | UI state, requests, and handlers |
| `src/assets.rs` | Embedded asset allowlist |
| `src/archive.rs` | Bounded disk-backed ZIP creation |
| `docs/ARCHITECTURE.md` | When API or component model changes |
| `docs/TESTING.md` | When new testable behaviors are added |
| `README.md` | When features or API surface changes |

---

## Testing checklist (manual)

The full manual checklist lives in `docs/TESTING.md` (single source of truth) — run it
after any UI-facing change. Quick smoke: upload, rename, move, delete, edit+autosave,
search, multi-select ZIP, and a second tab receiving WebSocket updates.

## Request and rendering rules

- Use `htmlAttr()` for plain HTML attributes, `escapeAttr()` for JS strings inside inline event attributes, `escapeHtml()` for HTML text, and `textContent` whenever possible.
- Never pass marked output directly to `innerHTML`; sanitize with DOMPurify first.
- `loadFiles()`/`performGlobalSearch()` use abort controllers plus generation checks; retain both protections.
- Keep file downloads streamed through NamedFile; ZIPs must stay disk-backed and skip symlinks.
- `broadcast_update(&state, ...)` invalidates the shared stats cache before broadcasting.
- Tests run on 18087 with temporary storage; never reuse the live service for mutation tests.
