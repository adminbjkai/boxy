# Boxy Request/Response Lifecycle Prompt

**Target**: AI image generation (g3img / DALL-E / Midjourney)
**Style**: Clean flat vector sequence diagram, light background, 16:9 aspect ratio

---

## Prompt

Create a technical sequence diagram titled "Boxy Request Lifecycle" showing how a typical file operation flows through the system:

**Participants** (columns, left to right):
1. **Browser UI** - User interface
2. **Actix Router** - Request routing
3. **Handler** - Business logic
4. **Path Sanitizer** - Security layer
5. **Filesystem** - Storage
6. **WebSocket** - Broadcast

**Sequence for "Rename File" operation**:

```
Browser UI        Actix Router      Handler           Path Sanitizer    Filesystem        WebSocket
    |                 |                |                    |                |                |
    |-- POST /api/rename ------------->|                    |                |                |
    |                 |                |                    |                |                |
    |                 |                |-- resolve_path_safe --------------->|                |
    |                 |                |<-- Option<PathBuf> ----------------|                |
    |                 |                |                    |                |                |
    |                 |                |                    [Validate: exists, within base]   |
    |                 |                |                    |                |                |
    |                 |                |-- tokio::fs::rename ---------------->|                |
    |                 |                |<-- Ok/Err --------------------------|                |
    |                 |                |                    |                |                |
    |                 |                |-- broadcast_update("rename") ----------------------->|
    |                 |                |                    |                |                |
    |<-- 200 OK ----------------------|                    |                |                |
    |                 |                |                    |                |                |
    |<========== WebSocket event: { action: "rename", path: "..." } =======================|
    |                 |                |                    |                |                |
    [Refresh grid]    |                |                    |                |                |
```

**Key Annotations**:
- "Path validated before any FS operation"
- "Broadcast only on successful mutation"
- "All clients receive update simultaneously"

**Visual Style**:
- Vertical lifelines for each participant
- Horizontal arrows for sync calls
- Dashed arrows for async/broadcast
- Color: Blue (client), Gray (routing), Green (handler), Orange (security), Purple (storage), Red (broadcast)

**Error Path** (optional small inset):
- Show "403 Forbidden" when path escapes base directory

---

## Filename Convention
`boxy-request-lifecycle-YYYYMMDD.png`
