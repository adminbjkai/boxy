# Changelog

All notable changes to Boxy are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

## [Unreleased]

## [1.6.0] - 2026-10-03

### Changed
- Refreshed teal/neutral workspace with a clear folder heading, direct-folder totals, compact upload strip, and reduced decorative motion
- Separated embedded markup, styles, and behavior into index.html, app.css, and app.js; consolidated static asset serving and ZIP creation into focused Rust modules
- File downloads stream through NamedFile with byte ranges and conditional requests; ZIPs use anonymous disk-backed temporary files and buffered source copying
- Resource bounds: two thumbnail decoders with allocation/dimension limits, one ZIP builder, at most four HTTP workers, shared mutation-invalidated stats cache
- Live file/tree refreshes coalesce and hidden tabs defer updates; stale listings/searches are aborted and ignored

### Added
- Pinned folders (up to 12, browser-local and cross-tab synchronized), Refresh, folder summaries, and one-click clear-all filters
- Mobile folder access, touch-visible file actions, dialog focus containment/return, and accessible control labels
- Vendored DOMPurify for safe Markdown previews; sandbox CSP on uploaded document responses
- Isolated browser/API tests on port 18087 with temporary storage; strict formatting/lint and browser coverage in CI
- Deployment backup, public/local verification, and automatic rollback on failure
- "Paste from Clipboard" button in the drop zone for explicit, focus-independent clipboard reading via `navigator.clipboard.read()` (supporting images, binary files, and plain text)
- Clipboard diagnostic overlay via `?pastedebug=1` URL query parameter to inspect clipboard data transfer items and MIME types
- Real-time transfer speed and dynamic ETA indicator in the overall upload progress panel, plus TB formatting support
- Streaming buffered writer (`BufWriter` with 256 KB buffer) in `upload_file` for high-throughput uploads
- Helper script `scripts/boxy-paste-mac.sh` to upload Finder-copied or selected files directly to Boxy from macOS via hotkey or CLI

### Fixed
- Closing the editor flushes pending autosave; saves are serialized, stale loads cannot populate a different editor, and save failures retain content
- Correct handling of quotes, ampersands, angle brackets, and encoded folder hashes; optional multipart original_name preserves exact browser upload filenames
- Nested uploads reject existing symlinks escaping their target storage directory; ZIP recursion skips nested symlinks and preserves duplicate basenames
- Bulk move/delete reports partial failures and retains failed selections for retry; folder creation surfaces API errors
- Thumbnail URLs reflect source metadata; decoder cache identity uses high-resolution mtime and size
- Release metadata sync covers npm lock, OpenAPI, and asset URLs; Docker build uses a current Rust toolchain and excludes local data/build output
- App-enforced `BOX_MAX_UPLOAD_BYTES`: streaming uploads monitor written bytes and automatically purge partial files if the limit is exceeded, returning HTTP 413 Payload Too Large
- Depth-capped ZIP archives: `download_zip` and `download_zip_multi` directory walks now enforce `MAX_RECURSION_DEPTH` (64)
- Non-interfering keyboard shortcuts: Ctrl/Cmd+V now preserves native browser paste unless items are actively staged in Boxy's internal clipboard
- E2e test suite: added assertion for `#pasteClipboardBtn` and restored Playwright browser headless shell dependencies

### Removed
- Duplicated per-asset handlers and separate ZIP walkers, duplicate rename request logic, repeated font-face declarations, and oversized bounce/tilt/idle animation rules
- Broken Docs destination; app now links to GitHub documentation while historical docs hosting remains absent

## [1.5.1] - 2026-07-18

### Fixed
- e2e spec: ambiguous `Create` button selector (strict-mode violation against the
  toolbar tooltips) — now `exact: true`; full suite passes again (5/5)

### Removed
- Dead frontend code (~90 lines): unused `formatDate()`, `downloadSelected()` +
  `getFileEntryByPath()`, three orphaned inline-rename state variables, vestigial
  `is-hidden`/`cm-focus` class references, and dead CSS (`.file-list` thumb rule,
  `.tree-indent` family, `--warm`, `--priority-*` custom properties)
- `docs/capture-ui-screenshots.mjs` — superseded by `docs/capture-fern-screenshots.mjs`,
  which regenerates the docs-site screenshots in `fern/assets/`

### Maintenance
- Docs accuracy sweep: fixed 19 stale claims across README, docs/ (MAINTENANCE,
  TESTING, code-audit, ARCHITECTURE, TEAM, UI_WALKTHROUGH, IMPLEMENTATION_GUIDE) and
  `.claude/skills/`; consolidated duplicated env-var table, API table, and manual
  test checklist to single canonical sources

## [1.5.0] - 2026-07-18

### Added
- Fern documentation site (`fern/`): guides with real app screenshots, OpenAPI
  API reference, dated changelog — served at docs.boxy.bjk.ai; API also exposed
  at api.boxy.bjk.ai
- "Docs" button in the app header linking to docs.boxy.bjk.ai (opens in a new tab)

### Fixed
- Dockerfile now sets `BOX_BIND_ADDR=0.0.0.0` — previously the container bound
  127.0.0.1, so `docker run -p 8086:8086` published a dead port

### Known issues (documented)
- `BOX_MAX_UPLOAD_BYTES` is not enforced by the app: actix `PayloadConfig` does
  not apply to the Multipart/JSON extractors in use, so oversized bodies are
  accepted; the effective upload cap is the reverse proxy's
  `client_max_body_size`. ZIP streaming walks are not depth-capped (unlike
  folder/search/stats walks).

## [1.4.0] - 2026-07-14

### Added
- Server-side image thumbnails: `GET /api/thumb` serves cached, downscaled
  (max edge 320px) JPEGs so grid tiles no longer download full-size originals;
  cache dir configurable via `BOX_THUMB_DIR` (default `./thumbs`)
- Clipboard copy / cut / paste: Ctrl/Cmd+C/X/V and context-menu Copy / Cut /
  Paste on files and folders, with cut-dimming and collision dedupe, backed by
  new `POST /api/copy`
- Keyboard-shortcuts help modal (`?` key or toolbar button)
- Sidebar storage footer with live totals from new `GET /api/stats`
- Skeleton shimmer placeholders while a folder listing loads
- 7 new Rust unit tests (23 total): thumb cache keys, stats walk, copy dedupe
  and self/descendant rejection

## [1.3.0] - 2026-07-03

### Added
- File previews: PDF (embedded viewer), video and audio players in a media
  preview modal; AVIF support; grid thumbnails properly gated to grid view (#7)
- Connection-loss banner with auto-reconnect status; API errors now surface the
  server's actual message in toasts (#12)
- Rust unit tests: path-traversal safety, filename dedup, name validation —
  16 tests in CI (#15)
- Vendored Prism.js, marked.js and web fonts — zero third-party runtime
  requests, works fully offline (#14)

### Fixed
- Escaped raw file extension in icon rendering (minor XSS hardening)

### Maintenance
- Standing specialist agents on low-cost models (.claude/agents: boxy-frontend,
  boxy-backend on Sonnet; boxy-chores on Haiku)
- scripts/deploy.sh: one-command build + restart + health verification

## [1.2.0] - 2026-07-03

### Added
- Motion UI overhaul: real-time WebSocket-driven item animations (new-item glow,
  change flash, no full-list repaint), full-viewport drag-and-drop upload overlay,
  per-file upload progress with checkmark draw, springy pressable states on all
  controls, context menu scales from cursor, modal blur/scale transitions,
  toast progress bar with hover-pause, capped stagger transitions, breadcrumb
  slide animations, animated empty state, folder icon hover tilt
- Mobile polish: ≤480px responsive layout, ≥40px tap targets on touch devices
- All motion respects `prefers-reduced-motion`; animations are transform/opacity-only

## [1.1.0] - 2026-07-02

Everything shipped since the original v1.0.0 tag (56 commits, Jan–Jul 2026).

### Added
- Dark-first UI overhaul with comprehensive interactivity and filtering
- Dashboard tiles: image icons, drag reorder, credentials and about pages
- Kanban: 60fps drag-and-drop, due-date color coding and filtering
- Server-side storage for cross-browser data sync
- Recursive inline directory expansion in the file list
- Column text filter, sidebar show-files toggle, tooltips
- MM/DD/YYYY date formatting
- Playwright e2e test scaffolding

### Fixed
- `uploadQueue` ReferenceError on upload (module-scope declaration)
- `inlineRenamePath` undefined crash and rename TypeError
- localStorage failures under browser tracking prevention
- Broken Google Fonts URL
- List view alignment, files header spacing, nav meta clipping
- Kanban stuck drag ghost and ghost cursor tracking
- Dashboard duplicate tile bug and breadcrumb clipping
- Cache-control headers and WebSocket reliability

### Changed
- Documentation fully re-aligned with current app behavior; visuals archived
- README now accurately lists CDN dependencies (Prism.js, marked.js, Google Fonts)

### Removed
- Dead dashboard-tiles/credentials code (~750 lines of unreachable JS + modal HTML)
- Orphaned `static/css/styles.css` (2,860 lines, referenced by nothing)
- `tech_stack_ppt/` untracked from git (presentation assets, 17 MB PDF)

### Maintenance
- Upload responses/broadcasts now report the deduplicated filename after a name collision
- New release system: `CHANGELOG.md`, `scripts/bump-version.sh`, `docs/VERSIONING.md`
- New `docs/TEAM.md` (agent roster) and `docs/MAINTENANCE.md` (ops playbook)
- GitHub Actions CI: cargo check/clippy/test + Cargo.toml↔package.json version-sync gate
- Nginx: HTTP/2, streaming uploads (`proxy_request_buffering off`); systemd unit hardened, 500 MB upload cap aligned end-to-end

## [1.0.0] - 2026-01-12

Initial stable release: Rust (actix-web) file-sharing server with vanilla JS
frontend — uploads, file management, websocket live updates, zip downloads.

[Unreleased]: https://github.com/adminbjkai/boxy/compare/v1.6.0...HEAD
[1.6.0]: https://github.com/adminbjkai/boxy/compare/v1.5.1...v1.6.0
[1.5.1]: https://github.com/adminbjkai/boxy/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/adminbjkai/boxy/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/adminbjkai/boxy/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/adminbjkai/boxy/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/adminbjkai/boxy/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/adminbjkai/boxy/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/adminbjkai/boxy/releases/tag/v1.0.0
