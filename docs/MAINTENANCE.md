# Maintenance Playbook

How Boxy actually runs in production and how to operate it.

## Production topology

```
Internet → nginx (boxy.bjk.ai, TLS via Let's Encrypt live/bjk.ai)
         → 127.0.0.1:8086
         → boxy (native systemd service, /etc/systemd/system/boxy.service,
                 runs /apps/boxy/target/release/boxy as user bjkai,
                 Restart=always)
```

- Nginx vhost: `/etc/nginx/sites-available/boxy.bjk.ai` (symlinked in sites-enabled).
- The Dockerfile / docker-compose.yml are **not used in production** — they're
  portable-deployment artifacts only.
- Uploads live in `/apps/boxy/uploads/` (gitignored).
- Upload cap: app default 200 MB (`BOX_MAX_UPLOAD_BYTES` env override in the
  systemd unit); nginx `client_max_body_size` must match it.

## Deploy a change

```bash
cd /apps/boxy
cargo build --release
sudo systemctl restart boxy
systemctl status boxy --no-pager   # confirm active
```

## Health checks

```bash
systemctl status boxy --no-pager
ss -tlnp | grep 8086               # app listening
sudo nginx -t                      # before any nginx reload
curl -sI https://boxy.bjk.ai | head -3
journalctl -u boxy -n 50 --no-pager   # app logs
```

## Nginx changes

Edit `/etc/nginx/sites-available/boxy.bjk.ai`, then **always**
`sudo nginx -t` before `sudo systemctl reload nginx` — this server hosts 100+
vhosts; a bad reload affects all of them.

## Testing

- `cargo check` on every change; `cargo build --release` before deploy.
- Playwright e2e: `npm run test:e2e` (see `docs/TESTING.md`).
- Post-deploy smoke test: load the UI, upload a small file, rename, delete.

## Known constraints

- Single-file architecture by design (`src/main.rs`, `static/index.html` +
  companions) — see `.claude/skills/project-guide`.
- Large media files (`docs/archive/`, presentations) bloat the repo (~117 MB
  pack). Don't add more binaries to git; new visuals go to `_ai_images/`
  (gitignored) or external storage. History rewrite is a pending decision.
