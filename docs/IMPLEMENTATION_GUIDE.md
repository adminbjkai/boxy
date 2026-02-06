# Boxy Implementation Guide (AI Dev)

**Audience:** Developers implementing UX and feature improvements  
**Perspective:** End-user clarity, speed, and visual polish

---

## Goal

Implement the UI/UX improvements identified during Playwright review, focusing on user-friendliness, visual clarity, and reducing friction. This guide defines **what to change**, **where to change it**, and **how to validate**.

---

## Status

This guide tracks the improvements that were implemented in the UI polish pass. Use it as a reference for behavior, acceptance checks, and where the code lives.

---

## Implemented Improvements

### 1) Fix missing favicon (console 404s)
**Why:** Avoids noisy errors and improves polish.  
**Where:** `static/`  
**Implemented**
- Added `static/favicon.ico` and referenced it from `static/index.html`.

**Acceptance**
- No `/favicon.ico` 404 in browser console

---

### 2) Update Credentials warning copy
**Why:** UI currently says “localStorage only” but app uses server‑synced JSON.  
**Where:** `static/index.html` (Credentials view)

**Implemented copy (should be equivalent to):**
> “Warning: Credentials are stored server-side in JSON (BOX_DATA_DIR) and synced across clients. This is NOT secure storage for sensitive data—use a password manager for important credentials.”

**Acceptance**
- Warning reflects server‑synced storage and still cautions about security

---

### 3) Hide the selection bar when nothing is selected
**Why:** Visual clutter; the “0 selected” bar takes space with no action.  
**Where:** `static/index.html` (selection toolbar JS + CSS)

**Implemented**
- Selection toolbar is hidden when `0` items are selected.
- When visible, it provides bulk actions (including download).

**Acceptance**
- Selection toolbar appears only when 1+ items are selected

---

## UX & Visual Polish

### 4) File list readability
**Why:** List view is dense; headings feel low-contrast.  
**Where:** `static/css/styles.css`

**Implemented**
- Improved header contrast/weight, row hover states, and spacing for scanability.

**Acceptance**
- List headers are visually distinct from rows
- Hover makes the active row clear

---

### 5) Sticky toolbar in Files view
**Why:** Users scroll long lists; top actions should remain accessible.  
**Where:** `static/css/styles.css` and layout container in `static/index.html`

**Implemented**
- Files toolbar/breadcrumb area remains visible while scrolling.

**Acceptance**
- Toolbar stays visible while scrolling files

---

### 6) Tasks empty-state CTA
**Why:** Empty boards should guide first action.  
**Where:** `static/index.html` Tasks view

**Implemented**
- Added empty-state guidance/CTA when tasks/columns are empty.

**Acceptance**
- Empty states provide clear next action

---

## Feature Usability

### 7) Upload progress & per-file errors
**Where:** `static/index.html` upload logic + progress UI  
**Implemented**
- Shows overall progress plus per-file status/errors.

**Acceptance**
- Users see progress while uploading.
- If a file fails, the UI shows which file failed and why (as available).

### 8) Inline rename in list view
**Where:** list view row renderer + rename handler  
**Implemented**
- Rename can be performed directly in list view without opening the modal.

**Acceptance**
- Inline rename updates the server and refreshes the list/grid correctly.

### 9) Bulk actions panel (multi-select)
**Where:** selection toolbar + file actions  
**Implemented**
- Bulk action controls appear only when multi-select is active.

**Acceptance**
- Bulk actions operate on exactly the selected items.

---

## Files Likely to Change

- `static/index.html` (UI structure + JS behavior)
- `static/css/styles.css` (layout polish)
- `static/` (new favicon asset)
- Docs: `README.md`, `docs/TESTING.md`, `docs/ARCHITECTURE.md` (when behavior changes)

---

## Testing Checklist (Manual)

- Files view: grid/list toggle works; selection bar hides when empty
- Credentials warning text matches server‑synced storage
- Favicon loads without 404
- Sticky toolbar remains visible during scroll
- Tasks empty board shows CTA guidance
- Upload shows progress and per-file status/errors
- Inline rename works in list view
- Bulk actions (move/delete/download) apply to selected items only

---

## Notes

- Keep UI changes minimal and consistent with current design language.
- Avoid introducing new dependencies unless required.
- Update docs if behavior changes (README + docs/TESTING).
