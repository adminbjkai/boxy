# Versioning & Releases

Boxy uses [SemVer](https://semver.org/). **`Cargo.toml` is the single source of
truth** — `package.json` and git tags are kept in sync by the bump script.

- **patch** (1.1.x) — bug fixes only
- **minor** (1.x.0) — new features, UI additions, backwards-compatible changes
- **major** (x.0.0) — breaking changes (API endpoints removed/renamed, storage
  format changes, config env vars renamed)

## How to cut a release

1. Make sure everything you want in the release is committed and pushed, and the
   `## [Unreleased]` section of `CHANGELOG.md` describes it (keep it updated as
   you merge work — that's the whole discipline).
2. Run:
   ```bash
   ./scripts/bump-version.sh minor --release   # or patch / major / X.Y.Z
   ```
   This syncs `Cargo.toml` + `package.json`, moves Unreleased → the new version
   in `CHANGELOG.md`, commits, tags `vX.Y.Z`, pushes, and publishes a GitHub
   release with the changelog section as notes.
3. Deploy: `cargo build --release && sudo systemctl restart boxy`

Without `--release` the script stops after the local commit + tag so you can
inspect before pushing.

## Rules

- Never edit version numbers by hand — always the script.
- Every user-visible change lands in `CHANGELOG.md` under `[Unreleased]` in the
  same PR/commit that makes the change.
- Tag every release. GitHub's release page is the public version record.
