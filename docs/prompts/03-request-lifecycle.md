# Boxy Request Lifecycle (Rename Example)

**Target**: AI image generation (g3img / DALL-E / Midjourney)
**Style**: Clean flat vector sequence diagram, light background, 16:9 aspect ratio
**Purpose**: Show detailed request flow through all system layers

---

## Prompt

Create a technical sequence diagram titled "Boxy Request Lifecycle" showing how a rename operation flows through the system:

**Participants** (vertical lifelines, left to right):
1. **Browser UI** - Blue (#3B82F6)
2. **Actix Router** - Gray (#6B7280)
3. **Rename Handler** - Green (#10B981)
4. **Path Sanitizer** - Orange (#F59E0B)
5. **Filesystem** - Purple (#8B5CF6)
6. **WebSocket Broadcaster** - Red (#EF4444)

**Sequence Flow**:

```
Browser UI        Actix Router      Rename Handler    Path Sanitizer    Filesystem        WS Broadcaster
    |                 |                 |                 |                 |                 |
    |-- POST /api/rename { path, new_name } ------------>|                 |                 |
    |                 |                 |                 |                 |                 |
    |                 |                 |-- resolve_path_safe(path) ------>|                 |
    |                 |                 |<-- Option<PathBuf> -------------|                 |
    |                 |                 |                 |                 |                 |
    |                 |                 |   [Validate: exists, within base, no symlink escape]
    |                 |                 |                 |                 |                 |
    |                 |                 |-- resolve_path_safe(new_path) -->|                 |
    |                 |                 |<-- Option<PathBuf> -------------|                 |
    |                 |                 |                 |                 |                 |
    |                 |                 |-- tokio::fs::rename(old, new) ---------------->|
    |                 |                 |<-- Ok(()) ------------------------------------|
    |                 |                 |                 |                 |                 |
    |                 |                 |-- broadcast_update("rename", path) ----------------->|
    |                 |                 |                 |                 |                 |
    |<-- 200 OK { success: true } -----|                 |                 |                 |
    |                 |                 |                 |                 |                 |
    |<=============== WebSocket: { action: "rename", path: "..." } =======================|
    |                 |                 |                 |                 |                 |
    [Refresh grid]    |                 |                 |                 |                 |
```

**Key Annotations** (callout boxes):
- At Path Sanitizer: "Canonicalization prevents symlink escapes"
- At Filesystem: "Atomic rename operation"
- At WS Broadcaster: "All clients notified simultaneously"

**Error Path** (small inset diagram):
- Show "403 Forbidden" response when path validation fails
- Label: "Path escapes base directory"

**Visual Style**:
- Vertical dashed lifelines for each participant
- Horizontal solid arrows for synchronous calls
- Horizontal dashed arrows for async/responses
- Double-line arrows (===) for WebSocket broadcast
- Activation boxes showing when each component is active
- Color-coded participant headers
- Clean sans-serif labels
- Light gray background

---

## Filename Convention
`boxy-request-lifecycle-YYYYMMDD.png`

Example: `boxy-request-lifecycle-20260118.png`
