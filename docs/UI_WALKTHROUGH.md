# Boxy UI Walkthrough

Captured on **2026-01-18** using Playwright + Chromium (headless) against a local build.
All screens shown in both **Light** and **Dark** themes.

Server config: `BOX_UPLOAD_DIR=./uploads_docs BOX_PORT=8086`

---

## 1) Home Screen (Empty State)
The initial view with upload drop zone, toolbar, and navigation.

**Light**
![Home light](assets/images/boxy-ui-home-light-20260118.png)

**Dark**
![Home dark](assets/images/boxy-ui-home-dark-20260118.png)

---

## 2) Create Folder Modal
Click "New Folder" to open the folder creation dialog.

**Light**
![New folder modal light](assets/images/boxy-ui-new-folder-modal-light-20260118.png)

**Dark**
![New folder modal dark](assets/images/boxy-ui-new-folder-modal-dark-20260118.png)

---

## 3) Folder Created
After creating a folder, it appears in the file grid.

**Light**
![Folder created light](assets/images/boxy-ui-folder-created-light-20260118.png)

**Dark**
![Folder created dark](assets/images/boxy-ui-folder-created-dark-20260118.png)

---

## 4) Upload Complete
File uploaded via the hidden file input; card appears with metadata.

**Light**
![Upload complete light](assets/images/boxy-ui-upload-complete-light-20260118.png)

**Dark**
![Upload complete dark](assets/images/boxy-ui-upload-complete-dark-20260118.png)

---

## 5) Rename Modal
Hover a file card, click "Rename" to open the rename dialog.

**Light**
![Rename modal light](assets/images/boxy-ui-rename-modal-light-20260118.png)

**Dark**
![Rename modal dark](assets/images/boxy-ui-rename-modal-dark-20260118.png)

---

## 6) Rename Complete
After confirming rename, the file card updates with the new name.

**Light**
![Rename complete light](assets/images/boxy-ui-rename-complete-light-20260118.png)

**Dark**
![Rename complete dark](assets/images/boxy-ui-rename-complete-dark-20260118.png)

---

## 7) Move Modal
Select destination folder from the tree view to move a file.

**Light**
![Move modal light](assets/images/boxy-ui-move-modal-light-20260118.png)

**Dark**
![Move modal dark](assets/images/boxy-ui-move-modal-dark-20260118.png)

---

## 8) Folder View (After Move)
Navigate into a folder to see moved files; breadcrumb updates.

**Light**
![Folder view light](assets/images/boxy-ui-folder-view-light-20260118.png)

**Dark**
![Folder view dark](assets/images/boxy-ui-folder-view-dark-20260118.png)

---

## 9) Search Filtered
Enter search term to filter files recursively across all folders.

**Light**
![Search filtered light](assets/images/boxy-ui-search-filtered-light-20260118.png)

**Dark**
![Search filtered dark](assets/images/boxy-ui-search-filtered-dark-20260118.png)

---

## 10) Sort Applied
Use the sort dropdown to order files by name, size, type, or date.

**Light**
![Sort applied light](assets/images/boxy-ui-sort-applied-light-20260118.png)

**Dark**
![Sort applied dark](assets/images/boxy-ui-sort-applied-dark-20260118.png)

---

## 11) Download / Preview
Hover a file to reveal action buttons including download.

**Light**
![Download light](assets/images/boxy-ui-download-light-20260118.png)

**Dark**
![Download dark](assets/images/boxy-ui-download-dark-20260118.png)

---

## 12) New File
Create a new empty file using the "New File" button.

**Light**
![New file light](assets/images/boxy-ui-new-file-light-20260118.png)

**Dark**
![New file dark](assets/images/boxy-ui-new-file-dark-20260118.png)

---

## 13) Edit Content
Double-click a text file to preview or edit its contents.

**Light**
![Edit content light](assets/images/boxy-ui-edit-content-light-20260118.png)

**Dark**
![Edit content dark](assets/images/boxy-ui-edit-content-dark-20260118.png)

---

## 14) Delete
Hover a file and click "Delete" to remove it.

**Light**
![Delete light](assets/images/boxy-ui-delete-light-20260118.png)

**Dark**
![Delete dark](assets/images/boxy-ui-delete-dark-20260118.png)

---

## 15) Tasks / Kanban Board
Switch to Tasks view to see the kanban-style task board (stored in localStorage only).

**Light**
![Tasks board light](assets/images/boxy-ui-tasks-board-light-20260118.png)

**Dark**
![Tasks board dark](assets/images/boxy-ui-tasks-board-dark-20260118.png)

---

## 16) Tasks Action
Create and manage tasks within the kanban board.

**Light**
![Tasks action light](assets/images/boxy-ui-tasks-action-light-20260118.png)

**Dark**
![Tasks action dark](assets/images/boxy-ui-tasks-action-dark-20260118.png)

---

## 17) WebSocket Sync
Multiple browser windows stay in sync via WebSocket broadcast.

**Light**
![WebSocket sync light](assets/images/boxy-ui-websocket-sync-light-20260118.png)

**Dark**
![WebSocket sync dark](assets/images/boxy-ui-websocket-sync-dark-20260118.png)

---

## Reproducing Screenshots

1. Start the server with a clean uploads root:
   ```bash
   BOX_UPLOAD_DIR=./uploads_docs BOX_PORT=8086 cargo run --release
   ```

2. Install Playwright dependencies:
   ```bash
   npm install
   npx playwright install --with-deps chromium
   ```

3. Run the capture script:
   ```bash
   node docs/capture-ui-screenshots.mjs
   ```

The script generates all screenshots in `docs/assets/images/` with both light and dark theme variants.
