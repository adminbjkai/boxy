# Boxy Deployment View

**Target**: AI image generation (g3img / DALL-E / Midjourney)
**Style**: Clean flat vector deployment diagram, light background, 16:9 aspect ratio
**Purpose**: Illustrate containerized deployment architecture

---

## Prompt

Create a deployment architecture diagram titled "Boxy Deployment View" showing the containerized setup:

**Layout**: Left-to-right flow from user to storage

### User/Browser (Left)
- Icon: User silhouette with laptop/browser
- Label: "Users"
- Arrow pointing right: "HTTP/WebSocket"

### Network Boundary
- Dashed vertical line
- Label: "Network"
- Port indicator: "8086"

### Docker Container (Center, large rounded rectangle)
- Docker whale logo in corner
- Label: "Docker Container"
- Dashed border indicating container boundary

**Inside Container**:

1. **Boxy Binary**
   - Box: "boxy (Rust binary)"
   - Sub-label: "Actix Web Server"
   - Listening indicator: "0.0.0.0:8086"

2. **Environment Variables** (small config box)
   - `BOX_PORT=8086`
   - `BOX_UPLOAD_DIR=./uploads`
   - `BOX_MAX_UPLOAD_BYTES=209715200`

3. **Internal Volume Mount Point**
   - Folder icon: "/app/uploads"
   - Arrow to external storage

### Host System / Volume (Right)
- Box: "Host Filesystem"
- Folder icon: "./uploads" or "/data/boxy/uploads"
- Label: "Persistent Volume"
- Volume mount indicator: "-v $(pwd)/uploads:/app/uploads"

### Deployment Commands (bottom section)
Show command blocks:

**Docker Build & Run**:
```
docker build -t boxy .
docker run -p 8086:8086 -v $(pwd)/uploads:/app/uploads boxy
```

**Docker Compose**:
```
docker compose up --build
```

**Local Development**:
```
BOX_PORT=8086 cargo run
```

### Port Mapping Visualization
- External: "localhost:8086"
- Arrow through container boundary
- Internal: "container:8086"
- Label: "-p 8086:8086"

### Health Check Indicator
- Small badge: "GET /api/health"
- Checkmark icon
- Label: "Container health monitoring"

**Visual Style**:
- Docker-inspired color scheme (blue #0DB7ED for container)
- Clean container/box metaphor
- Arrows showing data flow direction
- Port numbers clearly visible
- Command blocks in monospace font
- Light background
- Professional DevOps documentation aesthetic
- Icons: Docker whale, folder, user, network

**Key Callouts**:
- "Volume mount persists data across container restarts"
- "Single binary, no external dependencies"
- "Configurable via environment variables"

---

## Filename Convention
`boxy-deployment-view-YYYYMMDD.png`

Example: `boxy-deployment-view-20260118.png`
