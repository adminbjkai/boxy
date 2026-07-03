# Changelog

All notable changes to Boxy are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/adminbjkai/boxy/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/adminbjkai/boxy/releases/tag/v1.0.0
