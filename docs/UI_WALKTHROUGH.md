# Boxy UI Walkthrough

> Screenshots from earlier builds are archived in `docs/archive/`. The flows below describe
> the current (July 2026) UI. Regenerate screenshots with the capture script when the UI is stable.

---

## Layout overview

The app is a single-page file manager with three persistent regions:

```
┌─────────────────────────────────────────────────────┐
│  nav-bar: breadcrumb · path bar · meta count · icons │
├──────────────┬──────────────────────────────────────┤
│  sidebar     │  toolbar (view · zoom · upload · …)  │
│  (folder     │  ─────────────────────────────────── │
│   tree)      │  file grid / list view               │
│              │                                       │
│              │  (drop zone when empty)               │
└──────────────┴──────────────────────────────────────┘
```

---

## 1. Nav bar

- **Breadcrumb** — current folder path as clickable segments; click any segment to navigate up.
- **Live path bar** — editable `<input>` showing the current path; press Enter to jump to any path
  directly (useful for deep folder trees).
- **Item count** — "N items" reflects the filtered view.
- **Theme toggle** — sun/moon icon; persists in `localStorage`.
- **Global search** — magnifier icon opens a full-screen search overlay; results are recursive.

---

## 2. Sidebar (folder tree)

- **Navigation:** click any folder to navigate into it.
- **Expand/collapse:** the chevron next to each folder expands or collapses that node in the tree.
  State persists in `localStorage` (`boxy_sidebar_expanded`).
- **Collapse panel:** the `‹` button in the sidebar header collapses the entire sidebar;
  the `›` button on the left edge reopens it.
- **Sidebar toolbar** (three small buttons at the sidebar top):
  - **Show files** — toggles file entries (not just folders) visible in the tree.
  - **Expand all** — expands every tree node.
  - **Collapse all** — collapses all tree nodes.
- **Drop target:** drag a file card and drop it onto a sidebar folder node to move it.

---

## 3. Main toolbar

| Button | Action |
|--------|--------|
| Grid / List icon | Toggle between card grid and sortable list view (persists) |
| Global search icon | Open recursive search overlay |
| Multi-select icon | Toggle multi-select mode (single-click selects; bulk action bar appears) |
| Zoom slider | Resize grid cards 80–200 px, or adjust list row density |
| Upload | Open file picker (drag-drop also works anywhere) |
| New Folder | Open "Create folder" modal |
| New File | Create an empty text file in the current folder |

All buttons have tooltip labels on hover.

---

## 4. Grid view

Files and folders appear as cards with icons (thumbnails for images, type-colour icons for others).

- **Single click** — select/deselect (multi-select mode) or navigate into folder (normal mode).
- **Double click** — navigate into folder or open file in the editor.
- **Drag** — move a file to a folder card or the sidebar tree.
- **Hover** — reveals action buttons: Copy URL, Download, Edit, Move, Rename, Delete (plus
  ZIP Download for folders).
- **Right-click** — context menu: Preview, Download, Copy URL, Edit, Rename, Move, Duplicate, Delete.

---

## 5. List view

A full-width table with sortable column headers:

| Column | Sortable | Notes |
|--------|----------|-------|
| Name | yes | Folders always first |
| Type | yes | Detected from extension |
| Size | yes | Human-readable; "—" for folders |
| Date | yes | MM/DD/YYYY |
| Time | yes | 12-hour local time |
| Actions | — | Icon buttons: ZIP/Copy URL, Download, Edit, Move, Rename, Delete |

**Column filters** — each column header has a filter icon (▾). Clicking it opens a dropdown with:
- A text input for substring search.
- Checkboxes for each distinct value in that column.
- A **Clear** button that resets both text and checkbox filters.

**Inline folder expand** — single-clicking a folder row (or its triangle) expands it inline,
inserting child items directly below it with a left-side accent bar. Subdirectories inside also
get their own triangle and can be expanded recursively. Indentation increases 20 px per depth
level. Single-clicking again (or clicking the triangle) collapses.

---

## 6. Upload

- **Drag-and-drop** — drop files or folders anywhere on the page.
- **File picker** — click the Upload button; supports multi-file selection.
- **Clipboard paste** — Ctrl/Cmd+V pastes clipboard files.
- **Folder uploads** preserve nested structure and original modification dates.
- The **Upload progress panel** appears during upload showing overall progress and per-file
  status with progress bars and error messages.

---

## 7. Multi-select

Two ways to multi-select:

1. **Ctrl/Cmd+click** or **Shift+click** items at any time.
2. **Multi-select mode toggle** (toolbar button) — switches to single-click selection.

When ≥ 1 item is selected, the **selection bar** appears at the bottom with:
- Item count.
- **Move** — opens the move modal pre-seeded with all selected items.
- **Download ZIP** — downloads all selected files and folders as `selection.zip`.
- **Delete** — bulk-deletes all selected items after confirmation.
- **Clear** — deselects all.

---

## 8. In-browser editor

Double-click any editable file (`txt, csv, py, json, md, rs, js, ts, html, css, toml, yaml,
yml, sql, m3u, sh, go, rb, php, xml`) to open the editor modal.

- **Syntax highlighting:** Prism.js highlights the file based on its extension.
- **Rendered Markdown preview:** `.md` files have a toggle to switch between raw edit and a
  rendered HTML preview (via marked.js).
- **Autosave:** edits are auto-saved with a 2-second debounce; a status indicator shows
  "Saving…" / "Saved".
- **Manual save:** Ctrl/Cmd+S saves immediately.
- **Close:** Esc or the × button.

---

## 9. Image lightbox

Clicking an image file opens a full-screen lightbox:
- Left/right arrows (or keyboard ← →) navigate between images in the current folder.
- Esc or clicking the backdrop closes it.

---

## 10. Context menu

Right-click any file or folder:

| Action | Available on |
|--------|-------------|
| Preview | Files |
| Download | Files |
| Copy URL | Files |
| Edit | Editable text files |
| Rename | Files and folders |
| Move | Files and folders |
| Duplicate | Files and folders |
| Download ZIP | Folders |
| Delete | Files and folders |

**Duplicate** clones the item in the same folder, appending `_1`, `_2`, … to avoid conflicts.

---

## 11. Keyboard shortcuts

| Key | Action |
|-----|--------|
| `/` | Open global search |
| `F2` | Rename focused item (inline) |
| `Backspace` | Navigate up one folder |
| `↑ ↓` | Move focus between items |
| `Enter` | Open focused item |
| `Esc` | Close modal / context menu / editor / lightbox |
| `Ctrl/Cmd+S` | Save in editor |
| `← →` | Navigate lightbox images |

---

## Regenerating screenshots

Screenshots are archived in `docs/archive/`. To generate fresh ones against the current UI:

1. Start the server with a clean uploads root:
   ```bash
   BOX_UPLOAD_DIR=./uploads_docs BOX_PORT=8086 cargo run --release
   ```

2. Install Playwright:
   ```bash
   npm install
   npx playwright install --with-deps chromium
   ```

3. Run the capture script:
   ```bash
   node docs/capture-ui-screenshots.mjs
   ```
