#!/usr/bin/env bash
# Build, preserve the previous binary, restart only Boxy, and roll back on failure.
set -euo pipefail
cd "$(dirname "$0")/.."
backup_dir=$(mktemp -d "${TMPDIR:-/tmp}/boxy-deploy-XXXXXX")
had_binary=0
running_pid=$(systemctl show boxy -p MainPID --value)
if [[ "$running_pid" =~ ^[0-9]+$ ]] && [ "$running_pid" -gt 0 ] && [ -r "/proc/$running_pid/exe" ]; then
  # cargo may already have replaced target/release/boxy; back up the actual live inode.
  cp "/proc/$running_pid/exe" "$backup_dir/boxy"
  had_binary=1
elif [ -x target/release/boxy ]; then
  cp target/release/boxy "$backup_dir/boxy"
  had_binary=1
fi
restarted=0
rollback() {
  echo "Deploy failed. Previous binary: $backup_dir/boxy" >&2
  if [ "$restarted" = 1 ] && [ "$had_binary" = 1 ]; then
    cp "$backup_dir/boxy" target/release/boxy.rollback
    mv target/release/boxy.rollback target/release/boxy
    sudo -n systemctl restart boxy
    echo "Restored previous Boxy binary." >&2
  fi
}
trap rollback ERR
cargo build --release --locked --jobs "${BOX_BUILD_JOBS:-2}"
restarted=1
sudo -n systemctl restart boxy
for attempt in {1..20}; do
  if systemctl is-active --quiet boxy &&
     [ "$(curl -fsS --max-time 5 http://127.0.0.1:8086/api/health 2>/dev/null || true)" = '{"ok":true}' ]; then
    break
  fi
  sleep 1
done
systemctl is-active --quiet boxy
[ "$(curl -fsS --max-time 10 https://boxy.bjk.ai/api/health)" = '{"ok":true}' ]
version=$(sed -n 's/^version = "\(.*\)"/\1/p' Cargo.toml | head -1)
curl -fsS --max-time 10 https://boxy.bjk.ai/ | rg -q "app.js\?v=$version"
echo "Deployed v$version; local/public health and UI version verified. Rollback binary: $backup_dir/boxy"
