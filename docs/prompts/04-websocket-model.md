# Boxy WebSocket Model

**Target**: AI image generation (g3img / DALL-E / Midjourney)
**Style**: Clean flat vector diagram, light background, 16:9 aspect ratio
**Purpose**: Illustrate real-time sync architecture and reconnection behavior

---

## Prompt

Create a technical diagram titled "Boxy WebSocket Real-Time Model" showing the fan-out topology and reconnection behavior:

**Layout**: Hub-and-spoke with timeline

### Central Hub: Actix WebSocket Server
- Large central box: "WebSocket Broadcaster"
- Label: "ws://host:8086/ws"
- Sub-component: "broadcast_update(action, path)"
- Badge: "Tokio broadcast channel"

### Connected Clients (spoke pattern)
- 4-5 browser icons arranged in a semi-circle around the hub
- Each labeled: "Client A", "Client B", "Client C", etc.
- Bidirectional arrows connecting each to the hub
- Labels on arrows: "Subscribe" (incoming), "Event" (outgoing)

### Event Types Box
- Box listing mutation events:
  - `{ action: "upload", path: "..." }`
  - `{ action: "rename", path: "...", new_name: "..." }`
  - `{ action: "move", path: "...", dest: "..." }`
  - `{ action: "delete", path: "..." }`
  - `{ action: "edit", path: "..." }`

### Fan-Out Visualization
- Show a single mutation (e.g., "Client A uploads file")
- Arrows radiating from hub to ALL other clients
- Label: "Simultaneous broadcast to all connected clients"
- Timestamp indicators showing same-time delivery

### Reconnection Timeline (bottom section)
- Horizontal timeline showing:
  1. "Connection lost" (X mark)
  2. "Wait 2 seconds" (clock icon)
  3. "Reconnect attempt" (arrow)
  4. "Connection restored" (checkmark)
- Label: "Fixed 2-second retry interval"
- Code snippet: `setTimeout(connectWS, 2000)`
- Note: "NOT exponential backoff"

### Multi-Client Sync Scenario
- Small diagram showing:
  - Client A: "Rename file.txt → document.txt"
  - Server: "broadcast_update('rename', ...)"
  - Clients B, C, D: "Grid refreshes automatically"

**Visual Style**:
- Hub-and-spoke layout with central emphasis
- Animated-looking arrows (gradient or motion lines)
- Color coding:
  - Green (#10B981): Active connections
  - Red (#EF4444): Disconnected state
  - Blue (#3B82F6): Reconnecting
- Timeline with clear interval markers
- Clean sans-serif typography
- Light background with subtle radial gradient from center

---

## Filename Convention
`boxy-websocket-model-YYYYMMDD.png`

Example: `boxy-websocket-model-20260118.png`
