# Boxy UI Feature Map

**Target**: AI image generation (g3img / DALL-E / Midjourney)
**Style**: Clean flat vector feature diagram, light background, 16:9 aspect ratio
**Purpose**: Visual overview of all UI capabilities and interactions

---

## Prompt

Create a UI feature map diagram titled "Boxy UI Feature Map" showing all frontend capabilities:

**Layout**: Central app mockup with feature callouts radiating outward

### Central Element: App Interface Mockup
- Simplified browser window frame
- Header bar with app title "Boxy"
- Main content area divided into sections

### Feature Regions (with callout lines to mockup areas):

**Header Region**:
1. **Global Search**
   - Icon: Magnifying glass
   - Label: "Recursive search across all files"
   - Badge: "Max 100 results"

2. **View Toggle**
   - Icons: Grid / List
   - Label: "Grid/List view with persistent preference"

3. **Filter Dropdown**
   - Label: "File type filter"
   - Options: "All, Images, Documents, Code, Audio/Video"

**Main Content Region**:
4. **File Grid / List**
   - Icon: Grid of file icons
   - Features listed:
     - "Image thumbnails with lazy loading"
     - "Sortable columns (Name, Type, Size, Date)"
     - "Multi-select (Ctrl/Cmd+click, Shift+click)"
     - "Keyboard navigation (arrows, space, enter)"

5. **Upload Zone**
   - Icon: Cloud with up arrow
   - Label: "Drag & drop zone"
   - Features:
     - "Drag-drop files/folders"
     - "Clipboard paste"
     - "Click to browse"
     - "Folder upload support"

6. **Folder Navigation**
   - Icon: Folder tree
   - Label: "Breadcrumb navigation"
   - Features:
     - "Click to navigate"
     - "Backspace to go up"

**Sidebar Region** (or secondary area):
7. **Tasks/Kanban Board**
   - Icon: Kanban columns
   - Label: "Project management"
   - Badge: "localStorage only (no server sync)"
   - Features:
     - "Create/edit/delete boards"
     - "Drag tasks between columns"
     - "Browser-local persistence"

**Modal Dialogs** (shown as overlays):
8. **Rename Modal**
   - Input field with filename
   - Rename button

9. **Move Modal**
   - Folder tree selector
   - Move button

10. **New Folder Modal**
    - Input field for folder name
    - Create button

**Context Actions** (shown as toolbar or right-click menu):
- Download
- Rename
- Move
- Delete
- Edit (text files)

**Keyboard Shortcuts Legend** (small box):
- `↑↓←→` Navigate grid
- `Space` Select/deselect
- `Enter` Open/download
- `Backspace` Go to parent folder
- `Escape` Clear selection
- `Ctrl/Cmd+Click` Multi-select
- `Shift+Click` Range select

**Visual Style**:
- Clean, modern UI mockup aesthetic
- Callout lines with feature descriptions
- Icons for each feature area
- Color coding by feature category:
  - Blue: Navigation
  - Green: File operations
  - Orange: Upload
  - Purple: Tasks/Kanban
- Light background
- Professional documentation style

---

## Filename Convention
`boxy-ui-feature-map-YYYYMMDD.png`

Example: `boxy-ui-feature-map-20260118.png`
