#!/usr/bin/env bash
# bump-version.sh — single command to cut a Boxy release.
# Usage: ./scripts/bump-version.sh <major|minor|patch|X.Y.Z> [--release]
#   Syncs Cargo.toml + package.json, stamps CHANGELOG, commits, tags.
#   --release also pushes and creates a GitHub release from the changelog section.
set -euo pipefail
cd "$(dirname "$0")/.."

CURRENT=$(grep -m1 '^version' Cargo.toml | sed 's/.*"\(.*\)"/\1/')
IFS=. read -r MAJ MIN PAT <<<"$CURRENT"

case "${1:-}" in
  major) NEW="$((MAJ+1)).0.0" ;;
  minor) NEW="$MAJ.$((MIN+1)).0" ;;
  patch) NEW="$MAJ.$MIN.$((PAT+1))" ;;
  [0-9]*.[0-9]*.[0-9]*) NEW="$1" ;;
  *) echo "Usage: $0 <major|minor|patch|X.Y.Z> [--release]"; exit 1 ;;
esac

[ -n "$(git status --porcelain)" ] && { echo "Working tree not clean — commit or stash first."; exit 1; }

echo "Bumping $CURRENT -> $NEW"
sed -i "0,/^version = \"$CURRENT\"/s//version = \"$NEW\"/" Cargo.toml
sed -i "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW\"/" package.json
cargo check --quiet 2>/dev/null || true   # refresh Cargo.lock version stanza
grep -q "\"version\": \"$NEW\"" package.json || { echo "package.json bump failed"; exit 1; }

TODAY=$(date +%Y-%m-%d)
# Move Unreleased content into the new version section
sed -i "s/^## \[Unreleased\]$/## [Unreleased]\n\n## [$NEW] - $TODAY/" CHANGELOG.md
sed -i "s|^\[Unreleased\]: .*|[Unreleased]: https://github.com/adminbjkai/boxy/compare/v$NEW...HEAD\n[$NEW]: https://github.com/adminbjkai/boxy/compare/v$CURRENT...v$NEW|" CHANGELOG.md

git add Cargo.toml Cargo.lock package.json CHANGELOG.md
git commit -m "release: v$NEW"
git tag -a "v$NEW" -m "v$NEW"
echo "Committed and tagged v$NEW."

if [ "${2:-}" = "--release" ]; then
  git push origin main --follow-tags
  NOTES=$(awk "/^## \[$NEW\]/{flag=1;next}/^## \[/{flag=0}flag" CHANGELOG.md)
  gh release create "v$NEW" --title "v$NEW" --notes "$NOTES"
  echo "Pushed and published GitHub release v$NEW."
else
  echo "Run: git push origin main --follow-tags   (or re-run with --release)"
fi
