#!/usr/bin/env bash
# deploy.sh — build and deploy Boxy to production with health verification.
# Usage: ./scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Building release binary…"
cargo build --release

echo "Restarting boxy.service…"
sudo systemctl restart boxy
sleep 1
systemctl is-active --quiet boxy || { echo "FAIL: service not active"; journalctl -u boxy -n 20 --no-pager; exit 1; }

HEALTH=$(curl -sf --max-time 5 https://boxy.bjk.ai/api/health || true)
[ "$HEALTH" = '{"ok":true}' ] || { echo "FAIL: health check returned: $HEALTH"; exit 1; }

echo "Deployed OK — version $(grep -m1 '^version' Cargo.toml | sed 's/.*"\(.*\)"/\1/'), health: $HEALTH"
