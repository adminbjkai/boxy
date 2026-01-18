# Boxy File Upload & Real-Time Update Flow

**Target**: AI image generation (g3img / DALL-E / Midjourney)
**Style**: Clean flat vector flowchart, light background, 16:9 aspect ratio
**Purpose**: Illustrate the complete upload cycle with real-time sync

---

## Prompt

Create a technical flow diagram titled "Boxy File Upload & Real-Time Update Flow" showing the complete upload and broadcast cycle:

**Flow Sequence** (numbered steps, left-to-right then down):

### Step 1: User Action
- Icon: User silhouette with file icon
- Label: "Drag & drop / Paste / Click upload"
- Sub-label: "Supports folder uploads with nested paths"

### Step 2: Browser Processing
- Box: "FormData Construction"
- Shows: File being packaged into multipart/form-data
- Label: "Preserves original modification dates"

### Step 3: HTTP Request
- Arrow: "POST /api/upload?path=..."
- Label: "Multipart payload"
- Badge: "Max 200MB (BOX_MAX_UPLOAD_BYTES)"

### Step 4: Server Validation (Actix box with sequential sub-steps)
- Step 4a: "Validate path" → `resolve_path_safe()`
  - Callout: "Blocks ../ traversal"
  - Callout: "Prevents symlink escapes"
- Step 4b: "Check payload size" → "≤ 200MB"
- Step 4c: "De-duplicate filename" → "name_1, name_2, ..."

### Step 5: Filesystem Write
- Arrow: "tokio::fs::write"
- Box: "./uploads/[path]/[filename]"
- Label: "Async streaming write"

### Step 6: Broadcast Trigger
- Box: "broadcast_update('upload', path)"
- Arrows fanning out to multiple browser icons
- Label: "WebSocket fan-out to ALL connected clients"

### Step 7: UI Update (multiple browsers)
- Multiple browser icons receiving event
- Box: "{ action: 'upload', path: '...' }"
- Label: "All browsers refresh file grid simultaneously"

**Error Paths** (shown as red dashed branches):
- From Step 4a: "403 Forbidden" → "Path escapes base directory"
- From Step 4b: "413 Payload Too Large" → "File exceeds 200MB"

**Visual Style**:
- Numbered circles (1-7) at each step
- Solid arrows for sync operations
- Dashed arrows for async/broadcast
- Color coding:
  - Blue (#3B82F6): Client operations
  - Green (#10B981): Server processing
  - Orange (#F59E0B): Filesystem operations
  - Red (#EF4444): Error paths
- Clean sans-serif labels
- Light background with subtle grid

---

## Filename Convention
`boxy-file-upload-flow-YYYYMMDD.png`

Example: `boxy-file-upload-flow-20260118.png`
