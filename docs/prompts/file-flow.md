# Boxy File Upload & Event Flow Prompt

**Target**: AI image generation (g3img / DALL-E / Midjourney)
**Style**: Clean flat vector flowchart, light background, 16:9 aspect ratio

---

## Prompt

Create a technical flow diagram titled "Boxy File Flow" showing the upload and real-time update cycle:

**Flow Sequence** (left to right, top to bottom):

1. **User Action**
   - Icon: User with file
   - Label: "Drag & drop / paste / click upload"

2. **Browser Processing**
   - Box: "FormData + multipart encoding"
   - Shows file being packaged

3. **HTTP POST**
   - Arrow: "POST /api/upload?path=..."
   - Label: "Multipart payload"

4. **Server Processing** (Actix box with sub-steps):
   - Step A: "Validate path (resolve_path_safe)"
   - Step B: "De-duplicate filename if exists"
   - Step C: "Stream to ./uploads"
   - Step D: "broadcast_update('upload', path)"

5. **WebSocket Fan-out**
   - Dashed arrows to multiple browser icons
   - Label: "Real-time notification to all clients"

6. **UI Update**
   - Box: "All browsers refresh file grid"
   - Shows synchronized state

**Security Highlights** (callout boxes):
- "Path sanitized before write"
- "Filename collision handled"
- "Event broadcast on success only"

**Visual Style**:
- Numbered steps (1-6)
- Arrows showing data flow direction
- Color coding: Blue for client, Green for server, Orange for filesystem
- Clean sans-serif labels

---

## Filename Convention
`boxy-file-flow-YYYYMMDD.png`
