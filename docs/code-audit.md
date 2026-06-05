# Boxy Code Audit (current status)

**Last reviewed:** June 5, 2026
**Files:** `src/main.rs` (~830 lines), `static/index.html` (~5.4k lines)

Boxy is a localhost-bound, single-user-style file/task tool fronted by nginx. The threat model
assumes the app is reached only through the reverse proxy on the local host, not exposed publicly.
This document tracks the security posture: what is enforced, and the trade-offs we accept.

## Enforced (resolved)

| Area | Control |
|------|---------|
| Path traversal | `clean_relative_path` strips `.`/`..` and splits on `/` **and** `\`; `resolve_path_safe` canonicalises and verifies the resolved path stays within the upload root (blocks symlink escapes). Used by every path-handling endpoint. |
| Name validation | Folder/file/rename names are length-capped (≤255) and have `/ \ \0` stripped; over-limit input → `400`. |
| Search bounds | Query length capped (≤256); recursive search/folder walks are depth-capped (`MAX_RECURSION_DEPTH = 64`). |
| Upload DoS guard | The multipart `mtimes` metadata field is byte-capped (1 MiB) before JSON parsing. |
| De-dupe loop | Unique-filename counter is bounded, then falls back to a uuid suffix (cannot spin). |
| WS robustness | Broadcast receiver handles `Lagged` explicitly (logs, keeps the socket); client reconnect uses exponential backoff + jitter. |
| Download safety | Explicit `Content-Type` + `X-Content-Type-Options: nosniff`; inline vs. attachment disposition. |
| Editing safety | `/api/content` only serves/saves whitelisted editable extensions and UTF-8-validated text. |
| XSS | Frontend escapes all user content (`escapeHtml`/`escapeAttr`); toasts use `textContent`. |
| Error handling | Global `window.onerror` / `unhandledrejection` surface a toast instead of a frozen UI. |
| Config hygiene | Binds `127.0.0.1` by default (`BOX_BIND_ADDR`); startup log reflects the real bind address; dead `AppState.max_upload_bytes` field removed. |

## Accepted trade-offs (open by design)

These are intentionally **not** implemented because the app is single-tenant and localhost-fronted;
revisit them if Boxy is ever exposed to untrusted multi-user traffic.

- **No authentication / authorization.** Access control is delegated to the network boundary
  (nginx / host). Anyone who can reach the proxy can use the app.
- **No CSRF tokens.** There are no per-user sessions to protect; mutations are unauthenticated by design.
- **No rate limiting.** Deliberately avoided to keep the dependency footprint minimal
  ("non-stressing of resources"). nginx can add limits if needed.
- **No server-side trash / soft-delete.** Deletes are immediate and permanent on disk.
- **Task data is client-side only** (`localStorage`); it is not synced, backed up, or access-controlled.

## Notes for future work
- If multi-user exposure becomes a goal: add auth (e.g. reverse-proxy basic-auth or app sessions),
  CSRF protection, and nginx-level rate limiting before anything else.
- Consider a soft-delete/trash for accidental deletions.
