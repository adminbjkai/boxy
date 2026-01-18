# Boxy System Architecture Overview

**Target**: AI image generation (g3img / DALL-E / Midjourney)
**Style**: Clean flat vector infographic, light background, 16:9 aspect ratio
**Purpose**: Primary architecture diagram for README and documentation

---

## Prompt

Create a professional technical architecture diagram titled "Boxy System Architecture" with the following specifications:

**Layout**: Three vertical swim lanes within a Docker container boundary, left to right:

### Lane 1: Browser (Client Layer)
- Box: "Vanilla HTML/JS UI"
- Sub-components shown as smaller boxes:
  - "File Grid" (drag-drop upload zone)
  - "Search Bar" (global recursive search)
  - "Folder Navigation"
  - "Rename/Move Modals"
  - "Tasks/Kanban" with label: "localStorage only"
- Connection out: Arrow labeled "REST API" pointing right
- Connection out: Bidirectional arrow labeled "WebSocket /ws" pointing right

### Lane 2: Actix Web Service (Server Layer)
- Box: "Rust/Actix HTTP Server (port 8086)"
- Sub-components:
  - "REST Handlers" listing: files, search, upload, folder, rename, move, delete, download, content, newfile, health
  - "Path Sanitizer" with functions: `resolve_path_safe()`, `clean_relative_path()`
  - "WebSocket Broadcaster" with label: `broadcast_update()` fan-out
- Middleware badges at top: "Compress", "Logger", "Payload Limit (200MB)"
- Security badge: "MAX_SEARCH_RESULTS = 100"

### Lane 3: Filesystem (Storage Layer)
- Box: "./uploads directory"
- Icon: Folder tree
- Label: "Volume-mountable, isolated"
- Arrow from Actix: "Sanitized read/write"

**Docker Boundary**:
- Dashed rectangle enclosing all three lanes
- Label: "Docker Container"
- Port exposure indicator: "8086:8086"
- Volume mount indicator: "-v uploads:/app/uploads"

**Connections**:
- Browser → Actix: Solid arrow "HTTP REST"
- Browser ↔ Actix: Bidirectional dashed arrow "WebSocket"
- Actix → Filesystem: Solid arrow "Sanitized I/O"
- Actix → Browser (return): Dashed arrows "Broadcast events"

**Security Callouts** (small badges with shield icons):
- "Path traversal blocked"
- "Symlink escape prevented"
- "XSS escaped in UI"

**Visual Style**:
- Clean sans-serif typography (Inter, Roboto, or similar)
- Color scheme: Blue (#3B82F6) for client, Green (#10B981) for server, Orange (#F59E0B) for storage
- Light gray background (#F9FAFB)
- Subtle drop shadows on boxes
- High contrast, readable at 50% zoom
- Professional SaaS documentation aesthetic

---

## Filename Convention
`boxy-system-architecture-YYYYMMDD.png`

Example: `boxy-system-architecture-20260118.png`
