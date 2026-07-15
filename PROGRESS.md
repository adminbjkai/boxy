# PROGRESS — Boxy professionalization jumpstart

**Goal:** Full review of app + nginx + repo, then stand up a professional maintenance
system: synced versioning, changelog, release flow, agent team structure, docs.

## Plan
1. ✅ Scout: repo layout, versions, nginx configs, git state
2. ⏳ Parallel specialist reviews (app code / nginx+deploy / repo+release hygiene)
3. ⏳ Build system: CHANGELOG.md, bump script, docs/VERSIONING.md, docs/TEAM.md
4. ⏳ Apply findings: fixes/cleanups from the three reviews (scoped, high-value only)
5. ⏳ Release v1.1.0: sync manifests, tag, push, GitHub release
6. ⏳ Verify with fresh-context verifier, final report

## Key facts (evidence)
- Version drift: git tag `v1.0.0` → commit 2e040fd (2026-01-12); Cargo.toml &
  package.json both `0.1.0`; 56 commits since the tag, never released.
- Nginx: `boxy.bjk.ai` enabled; `boxy2.bjk.ai.conf` and `boxy3.bjk.ai` exist in
  sites-available (likely stale — pending infra agent confirmation).
- Stack: Rust actix-web (+actix-ws, multipart) backend, vanilla JS static frontend,
  Playwright e2e, Dockerfile + docker-compose present.
- `.claude/` already has skills (project-guide, ui-patterns, quality-checklist,
  tldr-first) and agents (code-reviewer, refactor-helper, ui-improver).

## Decisions
- Next version: **1.1.0** (minor — features since 1.0.0).
- Versioning: SemVer, Cargo.toml is the single source of truth; bump script syncs
  package.json + CHANGELOG + git tag.

## Done (evidence in session 2026-07-02)
- Reviews complete: app code (healthy; dead JS ~700 lines, upload dedup-name bug,
  stale project-guide skill), nginx (missing request-buffering off, 500M/200M
  limit mismatch, stale boxy2/boxy3), repo (no CHANGELOG/CI, 117MB pack, empty
  GH description, tag v1.0.0 stale).
- Built: CHANGELOG.md, scripts/bump-version.sh, docs/VERSIONING.md, docs/TEAM.md,
  docs/MAINTENANCE.md, .github/workflows/ci.yml.
- Infra applied: nginx vhost → http2 + proxy_request_buffering off +
  proxy_send_timeout 300; nginx -t OK, reloaded; GET / → 200 over HTTP/2,
  /api/health → {"ok":true}. Stale boxy2/boxy3 configs renamed *.stale-20260702.
  boxy.service: +BOX_MAX_UPLOAD_BYTES=524288000 +NoNewPrivileges, daemon-reloaded
  (service restart deferred to new-binary deploy).
- Repo: tech_stack_ppt untracked + gitignored; manifests synced to 1.0.0
  (Cargo.toml, package.json, Cargo.lock); GH description set; issues #13-15 filed
  (history bloat, vendor CDN deps, Rust unit tests).

- App fixes applied & verified by implementer: upload dedup-name fix (live-tested
  on port 18099: file.txt → file_1.txt reported correctly), −747 lines dead JS/HTML,
  styles.css deleted, README dep claim fixed, project-guide + ui-patterns skills
  rewritten to current reality. cargo check clean; node --check on extracted JS OK.
- Committed 6f98743 (67 files, −3,917 lines net).
- **Released v1.1.0** via ./scripts/bump-version.sh minor --release: manifests
  1.1.0, tag pushed, GitHub release live
  (https://github.com/adminbjkai/boxy/releases/tag/v1.1.0). CI run triggered.

- Deployed: release binary built, boxy.service restarted with new env; live
  GET / 200 over HTTP/2, /api/health ok. Fresh-context verifier: 10/10 PASS
  (one nit — uncommitted PROGRESS.md — committed and pushed after).
- **Main task COMPLETE 2026-07-03.**

## Side project 2026-07-03: Android APK (/apps/boxy-apk)
- Kotlin WebView shell for boxy.bjk.ai: native file-picker uploads, DownloadManager
  downloads, share-to-upload (ACTION_SEND → POST /api/upload), dark theme, adaptive icon.
- Toolchain installed: JDK17, Android SDK 34, Gradle 8.7. Release build signed with
  boxy-release.keystore. Deliverable: /apps/boxy-apk/boxy.apk (pending build result).

## Sprint 2026-07-03: Motion UI overhaul → v1.2.0
- All 10 motion/microinteraction items shipped in static/index.html (+386 lines):
  WS-driven item animations, drop overlay, upload progress+checkmark, spring
  pressables, cursor-origin context menu, modal transitions, toast progress,
  capped staggers, breadcrumbs, empty state, mobile (<=480px, 40px targets),
  reduced-motion safe. Verified: node --check, XSS audit (29=29 escapes), debug
  server markers, live deploy + Playwright screenshot OK. Released v1.2.0.

## GitHub housekeeping 2026-07-03
- Closed 5 stale issues (#5,8,9,10,11) w/ evidence comments; updated #7,#12 scope.
- Milestone v1.3.0 → #7,12,14,15; #13 labeled decision-needed; repo topics set.
- Added issue/PR templates, README badges (CI/release/changelog). Pushed.

## Sprint 2026-07-03 (b): Resolve all open issues → v1.3.0
- Lanes running (Sonnet): #15 unit tests (main.rs), #7+#12 previews+offline UX
  (index.html). Next: #14 vendoring (both files) after lanes merge. #13 history
  rewrite LAST (needs exclusive repo access; git-bundle backup first).
- Created standing cheap specialists: .claude/agents/boxy-frontend (sonnet),
  boxy-backend (sonnet), boxy-chores (haiku). Added scripts/deploy.sh.

## Sprint 2026-07-03 (b) COMPLETE → v1.3.0 + tracker at zero
- v1.3.0 shipped & deployed (deploy.sh first live run OK): previews (#7),
  offline UX + API errors (#12), vendored deps zero-CDN (#14), 16 unit tests (#15).
- #13 resolved: backup bundle /apps/boxy-backup-20260703.bundle, filter-repo
  strip-blobs->1M, force-pushed; pack 117MB→9.9MB, releases intact, tests green.
- All GitHub issues closed (0 open). Milestone v1.3.0 closed.

## Sprint 2026-07-14: v1.4 enhancement package
**Goal:** smoother/faster/more useful — server-side thumbnails, clipboard
copy/cut/paste, storage stats, shortcuts help, loading polish.

### Plan
1. ⏳ Backend lane (boxy-backend agent), API contract FROZEN:
   - `GET /api/thumb?path=` — downscaled cached image thumbnail (image crate,
     max edge 320px, JPEG out, disk cache BOX_THUMB_DIR default ./thumbs,
     cache key = hash(rel_path+mtime), spawn_blocking, skip inputs >50MB,
     404 for non-raster, long Cache-Control)
   - `GET /api/stats?path=` — recursive `{files, folders, bytes}` (depth-capped)
   - `POST /api/copy` `{path, destination}` — copy file/dir into dest folder,
     dedupe collisions, broadcast action "copy"
2. ⏳ Frontend lane (boxy-frontend agent): thumbs via /api/thumb (icon fallback,
   SVG keeps /api/download), Ctrl/Cmd+C/X/V + context-menu Copy/Cut/Paste,
   `?` shortcuts-help modal, sidebar storage footer (/api/stats, debounced on WS),
   skeleton shimmer while folder loads.
3. ⏳ Integrate: cargo build + test, node --check, live smoke on debug port.
4. ⏳ Fresh-context verify, report. No commit/deploy without user ask.

### Decisions
- Thumb cache OUTSIDE upload_dir (BOX_THUMB_DIR) so it never shows in listings.

### DONE 2026-07-14 — verified, uncommitted
- Backend: /api/thumb (cached 320px JPEGs, BOX_THUMB_DIR), /api/stats, /api/copy
  (+7 unit tests → 23 total pass). Frontend: thumbs via /api/thumb, Ctrl/Cmd+C/X/V
  clipboard + context-menu Copy/Cut/Paste w/ cut dimming, `?` shortcuts modal,
  sidebar storage footer, skeleton shimmer.
- Fresh-context verifier: PASS all 6 criteria (live curl incl. traversal/collision
  attacks, headless-Chromium XSS filenames — nothing fired, WS "copy" broadcast
  observed, cargo test 23/23, node --check OK, prod 8086 untouched).
- NOT committed, NOT deployed — awaiting user go-ahead (needs rebuild + systemctl
  restart per deploy.sh since frontend is embedded).

### Docs sync 2026-07-14 (post-feature)
- Updated to current state: README (vendored deps — CDN claim was stale since
  v1.3.0! — env table, API table, features, WS actions), CHANGELOG Unreleased,
  ARCHITECTURE, IMPLEMENTATION_GUIDE (CDN refs fixed, line counts, checklist),
  UI_WALKTHROUGH (toolbar/context-menu/shortcuts tables), TESTING (unit-test
  section + new manual checks), DEPLOYMENT (+BOX_THUMB_DIR), code-audit
  (addendum for new endpoints), project-guide skill, .gitignore (+/thumbs).
- Sweep verified: no stale CDN/line-count claims remain; cargo test 23/23.
