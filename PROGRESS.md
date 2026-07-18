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

### RELEASED & DEPLOYED v1.4.0 — 2026-07-14
- bump-version.sh minor --release: tag v1.4.0 pushed, GitHub release live, CI green.
- deploy.sh: release binary built, boxy.service restarted, health {"ok":true}.
- Prod smoke: live page serves new UI (10 markers), /api/stats returns real
  totals (234 files / 45 folders / 1.3 GB). Sprint COMPLETE.

### Fern docs site 2026-07-18
- Built a Fern (buildwithfern.com) docs project at `fern/`: fern.config.json,
  generators.yml, docs.yml (2 tabs: Documentation + API Reference, Boxy accent
  colors, dark-first), openapi/openapi.yml covering all 18 REST endpoints + /ws,
  and 14 MDX pages (getting-started x4, guides x5, self-hosting x3, reference x2).
- Response shapes taken from src/main.rs handlers (verified json() call sites);
  shortcuts page mirrors the in-app `?` modal incl. the `0`-to-delete binding.
- `npx fern-api check`: 0 errors (warnings: AAA contrast auto-adjust, login-gated
  redirects check). Fresh-context verifier cross-check of spec vs code: pending.
- Verifier (fresh context) result: endpoint coverage 1:1, all 14 structs +
  shortcuts + env vars confirmed; found 6 doc errors (WS actions table x4,
  security ZIP depth-cap + NUL claims) — all fixed, plus minors (20 file types,
  folder action in overview, "/" in folders example, 409s on rename/move).
  Final `fern check`: 0 errors. README Documentation section now points to fern/.

### Docs live at docs.boxy.bjk.ai — 2026-07-18
- DNS already pointed here. New LE cert (wildcard can't cover 2-level subdomain);
  certbot issued OK, nginx installer failed (unrelated 1024-bit key elsewhere) →
  TLS block written manually. boxy-docs.service (npx fern-api docs dev :3901),
  enabled; nginx vhost docs.boxy.bjk.ai proxies it.
- Verified: https root 200 "Overview | Boxy Docs", 80→443 redirect, /api-reference
  200, cert CN docs.boxy.bjk.ai valid to 2026-10-16, service active + port owned
  by systemd instance (stale ad-hoc preview killed).

### Docs upgrade round 2 — 2026-07-18 (screenshots, api subdomain, polish)
- api.boxy.bjk.ai live: nginx vhost -> :8086, own LE cert (nginx installer broken
  on this box; TLS block manual). Verified /api/health,/api/files,/api/stats 200.
- Real app screenshots: seeded demo instance on :18086 (uploads_docs/), captured
  11 shots (home d/l, thumbnails, lightbox, list, editor code+md, context menu,
  global search, shortcuts, multi-select) into fern/assets/ via fern-shots script.
- Content rewrite per researched Fern patterns (6 ref sites + 19 more URLs via
  4 haiku agents): Frames+captions, Steps, CodeGroup, synced Tabs (curl/py/js),
  ParamField config, mermaid diagrams, AccordionGroup FAQs, EndpointRequestSnippet,
  cookbook page, API overview as api-tab summary, native dated changelog tab,
  logo (dark/light SVG), favicon, announcement banner, navbar links (app+GitHub).
- API examples now use https://api.boxy.bjk.ai (no localhost) per user request.
- Fixed: internal links rewritten to canonical Fern URLs (user-reported bug);
  /_local image redirect to localhost:3911 fixed via pinned backend port +
  nginx proxy_redirect + /_local/ location. Full 2-level crawl: 48 pages/links
  all 200 (after fixing /api-reference/api-overview -> /api-reference).
- README + docs/DEPLOYMENT.md updated for docs/api subdomains + certbot quirk.
- Final accuracy audit (fable-verifier over all pages/spec/changelog vs code):
  pending.
- Final accuracy audit (fable-verifier, ran the server + curl probes): 8 real
  findings, all fixed — biggest: BOX_MAX_UPLOAD_BYTES is NOT enforced app-side
  (PayloadConfig doesn't cover Multipart/Json extractors; proven empirically) →
  docs corrected in 5 places + CHANGELOG "Known issues"; Dockerfile bug fixed
  (now sets BOX_BIND_ADDR=0.0.0.0 — container port was dead before); error
  table corrected (400/404/409 sources, 413 is proxy-only); cookbook jq recipe
  rewritten (printf|jq -Rs, tested); clippy is advisory in CI (docs now say so);
  spec: +400s on search/content/newfile, +409 newfile, download accepts 1,
  "rejected"→normalised wording; "Media"→"Audio/Video".
- Post-fix verification: fern check 0 errors; docs restarted; corrected text
  confirmed live; 7 key URLs 200. Demo server killed, temp files removed.
- User-spotted render error on /reference/architecture: FileTree.Folder/File
  sub-component syntax unsupported by Fern MDX → replaced with plain code-block
  tree. Post-restart sweep of all 17 live pages: 0 render errors.
- Preview-server chrome leak (stuck "Reloading..." pill + "Everyone" role widget
  visible to visitors): hidden via nginx sub_filter CSS injection on the docs
  vhost (Accept-Encoding stripped upstream); verified display:none via live DOM.
- "Docs" header button added to the app (static/index.html, .docs-link style,
  opens docs.boxy.bjk.ai in new tab); CHANGELOG Unreleased updated; release
  rebuilt (binary .bak kept), boxy restarted, health ok, button verified live
  via screenshot.
- Synced to GitHub 2026-07-18: UI_WALKTHROUGH +Docs button; lightbox-dark.png
  compressed 2.5MB->462KB; 3 commits pushed (102beb3 Dockerfile fix, fe1a75f
  Docs button, 9b48aec fern docs site) -> main; CI completed success. Docs site
  + app + api verified 200/healthy post-push. Working tree clean except this
  PROGRESS line.

### RELEASED & DEPLOYED v1.5.0 — 2026-07-18
- bump-version.sh minor --release: tag v1.5.0 pushed, GitHub release live.
- deploy.sh: binary rebuilt as 1.5.0, boxy restarted, health {"ok":true}.
- Docs site synced: fern/changelog/2026-07-18.md (v1.5.0) + spec version 1.5.0,
  pushed (e413d2c), boxy-docs restarted, /changelog shows v1.5.0. CI green on
  both release and docs-sync commits. Sprint COMPLETE.

### Full-repo cleanup sprint — 2026-07-18 (post-v1.5.0)
- Goal: 100% clean codes+docs, no redundancies, all synced to v1.5.0 state.
- Lanes: my structural scan (done: git hygiene OK, pack 14M, all cruft ignored;
  README docs/archive refs stale — archive gone from disk); agent A auditing all
  internal docs vs v1.5.0; agent B hunting dead code in index.html/main.rs.
- Cleanup applied & verified: frontend -88 lines dead code (formatDate,
  downloadSelected+getFileEntryByPath, 3 vars, is-hidden/cm-focus, 4 CSS blocks);
  main.rs verified clean (0 clippy warnings); 19 doc fixes + 3 consolidations
  (TESTING env table, project-guide API table, IMPL_GUIDE checklist -> pointers);
  old capture script deleted, new docs/capture-fern-screenshots.mjs committed and
  RUN-verified (11/11 shots); e2e spec exact:true fix -> 5/5 pass on live server
  with cleaned frontend deployed; artifacts cleaned from prod uploads;
  cargo test 23/23; fern check 0 errors.

### RELEASED & DEPLOYED v1.5.1 — 2026-07-18 (cleanup release)
- Tag pushed, GitHub release live, deploy.sh OK (health {"ok":true}), docs site
  synced (v1.5.1 on /changelog, spec 1.5.1). CI green x3 (cleanup, release,
  docs-sync). Tree clean. Cleanup sprint COMPLETE.
