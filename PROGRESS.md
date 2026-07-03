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
