# Boxy Code Audit (current status)

**Last reviewed:** October 3, 2026 (v1.6.0)
**Files:** `src/main.rs`, `src/assets.rs`, `src/archive.rs`, `static/index.html`, `static/app.js`, `static/app.css`

Boxy is a localhost-bound, single-user file tool fronted by nginx. The app binds locally and is reachable through its HTTPS reverse proxy. The proxy does not itself provide authentication; access remains a deployment-level responsibility. This document
tracks the security posture: what is enforced, and the trade-offs we accept.

## Enforced (resolved)

| Area | Control |
|------|---------|
| Path traversal | `clean_relative_path` strips `.`/`..` and splits on `/` **and** `\`; `resolve_path_safe` canonicalises and verifies the resolved path stays within the upload root (blocks symlink escapes). Used by every path-handling endpoint. |
| Name validation | Folder/file/rename names are length-capped (≤255 UTF-8 bytes) and normalize `/ \ \0`; over-limit input → `400`. |
| Search bounds | Query length capped (≤256); recursive search/folder walks are depth-capped (`MAX_RECURSION_DEPTH = 64`). |
| Nested upload path | Each cleaned nested filename is resolved safely before parent creation, blocking pre-existing symlink escapes. |
| Upload DoS guard | Multipart metadata fields are byte-capped (`mtimes` 1 MiB, `original_name` 4096 bytes) before JSON parsing. |
| De-dupe loop | Unique-filename counter is bounded, then falls back to a uuid suffix (cannot spin). |
| WS robustness | Broadcast receiver handles `Lagged` explicitly (logs, keeps the socket); client reconnect uses exponential backoff + jitter. |
| Download safety | NamedFile streaming with byte ranges/conditional responses, nosniff, safely encoded dispositions, and sandbox CSP isolating uploaded active documents. |
| Editing safety | `/api/content` only serves/saves whitelisted editable extensions and UTF-8-validated text. |
| XSS | Separate text/attribute/JS encoders; DOMPurify sanitizes Markdown HTML; toasts/pin labels use `textContent`. |
| Error handling | Global `window.onerror` / `unhandledrejection` surface a toast instead of a frozen UI. |
| Upload cap | Streaming uploads enforce `BOX_MAX_UPLOAD_BYTES` (default 100 GiB; 0 = unlimited) with 256 KB buffered writes; exceeding limit or write aborts purge the partial file and return HTTP 413. |
| ZIP recursion bounds | Shared disk-backed walker depth-capped at 64; nested symlinks skipped; one archive build at a time. No source-file or archive-sized RAM allocation. |
| Thumbnail bounds | Two shared decoder slots, source ≤50 MB, 128 MiB allocation cap, 16,384px dimension cap. Decode failure returns 404/fallback icon. |
| Config hygiene | Binds `127.0.0.1` by default (`BOX_BIND_ADDR`); startup log reflects the real bind address. |
| localStorage safety | All `localStorage` reads go through an `ls` helper that wraps every call in try/catch so Safari/Firefox tracking-prevention blocking does not crash the app. |

## Accepted trade-offs (open by design)

These are intentionally **not** implemented because the app is single-tenant and localhost-fronted;
revisit them if Boxy is ever exposed to untrusted multi-user traffic.

- **No authentication / authorization.** Access control is delegated to the network boundary
  (nginx / host). Anyone who can reach the proxy can use the app.
- **No CSRF tokens.** There are no per-user sessions to protect; mutations are unauthenticated by design.
- **No rate limiting.** Deliberately avoided to keep the dependency footprint minimal. nginx can add
  limits if needed.
- **No server-side trash / soft-delete.** Deletes are immediate and permanent on disk.

## Remaining limitations

- ZIP builds use temporary disk space proportional to the compressed archive; there is no disk quota. Insufficient disk space returns an error and drops the temporary file.
- Path checks do not eliminate filesystem time-of-check/time-of-use races against a local process changing symlinks. Restrict write access to the upload root.
- There is no application authentication, rate limiting, or server trash. These remain explicit deployment/design limitations.
- Thumbnail disk cache is not automatically pruned. It may be cleared between restarts or maintained externally; it regenerates on demand.

## Notes for future work
- If multi-user exposure becomes a goal: add auth (e.g. reverse-proxy basic-auth or app sessions),
  CSRF protection, and nginx-level rate limiting before anything else.
- Consider a soft-delete/trash for accidental deletions.
