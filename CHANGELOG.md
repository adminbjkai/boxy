# Changelog

All notable changes to Boxy are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/adminbjkai/boxy/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/adminbjkai/boxy/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/adminbjkai/boxy/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/adminbjkai/boxy/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/adminbjkai/boxy/releases/tag/v1.0.0
