# Boxy Architecture Diagram Prompt

**Target**: AI image generation (g3img / DALL-E / Midjourney)
**Style**: Clean flat vector infographic, light background, 16:9 aspect ratio

---

## Prompt

Create a technical architecture diagram titled "Boxy Architecture" with the following specifications:

**Layout**: Three vertical swim lanes, left to right:
1. **Browser** (client layer)
2. **Actix Web Service** (server layer)
3. **Filesystem** (storage layer)

**Browser Lane**:
- Box: "Static HTML/JS UI"
- Shows: File grid, upload dropzone, search bar, kanban board
- Arrows out: REST API calls, WebSocket connection

**Actix Web Service Lane**:
- Box: "Rust/Actix HTTP Server"
- Sub-components:
  - "REST Handlers" (list, upload, move, rename, delete, search, content)
  - "WebSocket Broadcaster" (fan-out to clients)
  - "Path Sanitizer" (resolve_path_safe, clean_relative_path)
- Middleware badges: "Compress", "Logger", "Payload Limit (200MB)"

**Filesystem Lane**:
- Box: "./uploads directory"
- Shows: Folder tree icon
- Label: "Volume-mountable, isolated"

**Connections**:
- Browser → Actix: "HTTP REST" and "WebSocket /ws"
- Actix → Filesystem: "Sanitized read/write"
- Actix → Browser (dashed): "Broadcast events (upload/rename/move/delete)"

**Security Callouts** (small badges):
- "Path traversal blocked"
- "Search capped at 100 results"
- "XSS escaped in UI"

**Color Scheme**: Blues and grays, minimal, professional
**Typography**: Sans-serif, clean labels

---

## Filename Convention
`boxy-architecture-YYYYMMDD.png`
