# Boxy Code Audit (Updated)

**Date:** February 6, 2026  
**Files Reviewed:** `src/main.rs`, `static/index.html`

---

## Executive Summary

Boxy is a file-sharing and task management web app with an Actix-web backend and a vanilla JS frontend. File operations are handled via REST endpoints, while app data (boards/tiles/credentials) is stored server-side in JSON files under `BOX_DATA_DIR` and synchronized via WebSocket `data_sync` events. The codebase is straightforward and functional, but it intentionally omits access controls and rate limiting.

---

## Verified Observations (Current Code)

1. **Path safety is enforced for file operations**  
   All filesystem operations resolve paths through `resolve_path_safe()`, which canonicalizes existing paths and verifies they remain under the configured upload root.

2. **Upload size limit is request-level only**  
   Total payload size is constrained via `PayloadConfig` (`BOX_MAX_UPLOAD_BYTES`). There is no per-file size tracking or size limit for the `mtimes` metadata field.

3. **No authentication or authorization**  
   All REST and WebSocket endpoints are publicly accessible to anyone who can reach the server.

4. **App data is stored in plaintext JSON**  
   Boards, tiles, and credentials are written directly to `BOX_DATA_DIR` as JSON without encryption or access controls.

5. **Broadcast failures are not logged**  
   WebSocket broadcasts (`tx.send`) ignore errors, so dropped updates are silent under high volume.

6. **WebSocket reconnect uses fixed delay**  
   Reconnect attempts use a constant 2-second delay (no exponential backoff).

7. **No rate limiting**  
   Endpoints can be called without throttling, which may allow abusive use if exposed publicly.

8. **No explicit CORS policy**  
   CORS headers are not configured. Cross-origin browser requests will be blocked by default unless a reverse proxy adds headers.

---

## Suggested Improvements (If Hardening Is Desired)

- Add authentication/authorization (even basic token auth) for all API routes.
- Introduce rate limiting for upload/search/delete endpoints.
- Add per-file upload limits and cap `mtimes` metadata size.
- Log or meter dropped WebSocket broadcasts.
- Add exponential backoff with jitter for reconnect.
- Store credentials in an external secrets manager or encrypt at rest.
- Configure CORS explicitly if the UI and API will live on different origins.
