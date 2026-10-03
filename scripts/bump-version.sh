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
python3 - "$NEW" <<'PYTHON'
import json, re, sys
from pathlib import Path
version = sys.argv[1]
for file in ['package.json', 'package-lock.json']:
    path = Path(file); data = json.loads(path.read_text()); data['version'] = version
    if 'packages' in data: data['packages']['']['version'] = version
    path.write_text(json.dumps(data, indent=2) + '\n')
path = Path('fern/openapi/openapi.yml')
path.write_text(re.sub(r'(?m)^  version: .*$', '  version: ' + version, path.read_text(), count=1))
path = Path('static/index.html')
path.write_text(re.sub(r'(/assets/app\.(?:css|js)\?v=)[^"\s]+', r'\g<1>' + version, path.read_text()))
PYTHON
cargo check --quiet

TODAY=$(date +%Y-%m-%d)
# Move Unreleased content into the new version section
sed -i "s/^## \[Unreleased\]$/## [Unreleased]\n\n## [$NEW] - $TODAY/" CHANGELOG.md
sed -i "s|^\[Unreleased\]: .*|[Unreleased]: https://github.com/adminbjkai/boxy/compare/v$NEW...HEAD\n[$NEW]: https://github.com/adminbjkai/boxy/compare/v$CURRENT...v$NEW|" CHANGELOG.md

git add Cargo.toml Cargo.lock package.json package-lock.json fern/openapi/openapi.yml static/index.html CHANGELOG.md
git commit -m "release: v$NEW"
git tag -a "v$NEW" -m "v$NEW"
echo "Committed and tagged v$NEW."

if [ "${2:-}" = "--release" ]; then
  git push origin main --follow-tags
  NOTES=$(awk "/^## \[$NEW\]/{flag=1;next}/^## \[/{flag=0}flag" CHANGELOG.md)
  notes_file=$(mktemp)
  printf '%s\n' "$NOTES" > "$notes_file"
  gh release create "v$NEW" --title "v$NEW" --notes-file "$notes_file"
  echo "Pushed and published GitHub release v$NEW."
else
  echo "Run: git push origin main --follow-tags   (or re-run with --release)"
fi
