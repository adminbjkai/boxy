# Boxy Deployment

Boxy runs as a **localhost-bound systemd service behind nginx** (nginx terminates TLS with the
existing wildcard certificate). The app never binds a public interface directly.

## Topology
```
Internet ──HTTPS──▶ nginx (boxy.bjk.ai, :443) ──proxy──▶ 127.0.0.1:8086 ──▶ boxy (systemd)
```

## Build & restart (the core loop)
The frontend (`static/index.html`) is embedded into the binary at compile time, so **any change to
the backend or the frontend requires a rebuild and restart**:
```bash
cargo build --release
sudo systemctl restart boxy
systemctl is-active boxy
curl -s http://127.0.0.1:8086/api/health     # {"ok":true}
curl -I  https://boxy.bjk.ai
```
Tip: keep a rollback copy before restarting — `cp target/release/boxy target/release/boxy.bak`.

## systemd unit
`/etc/systemd/system/boxy.service` runs `/apps/boxy/target/release/boxy` as user `bjkai` with
working directory `/apps/boxy`. Configuration is via environment (see `docs/ARCHITECTURE.md`):
`BOX_PORT`, `BOX_BIND_ADDR` (default `127.0.0.1`), `BOX_UPLOAD_DIR`, `BOX_MAX_UPLOAD_BYTES`,
`BOX_THUMB_DIR` (thumbnail cache, default `./thumbs` relative to the working directory — safe to
delete at any time; it repopulates on demand).

```bash
systemctl status boxy
journalctl -u boxy -n 50 --no-pager
```

## nginx site
`/etc/nginx/sites-enabled/boxy.bjk.ai` (symlinked from `sites-available`):
- `listen 80` → 301 redirect to HTTPS
- `listen 443 ssl` with the wildcard cert
  (`/etc/letsencrypt/live/bjk.ai/fullchain.pem` / `privkey.pem` — do **not** run certbot for this app)
- `proxy_pass http://127.0.0.1:8086;`
- standard proxy headers (`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`)
- WebSocket upgrade headers (`Upgrade`, `Connection "upgrade"`) + `proxy_read_timeout 86400`
- `client_max_body_size 500M`

After editing nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Constraints
- Bind **localhost only**; do not expose the app port publicly or open firewall ports.
- Reuse the existing wildcard TLS cert; do not generate new certs.
- Do not restart unrelated services.

## Docker (alternative)
```bash
docker compose up --build
# or
docker build -t boxy . && docker run -p 8086:8086 -v $(pwd)/uploads:/app/uploads boxy
```

## Companion services (added 2026-07-18)

- **docs.boxy.bjk.ai** — the documentation site. `boxy-docs.service` runs
  `npx fern-api docs dev --port 3901 --backend-port 3911` (Fern preview server,
  ~1 min startup); nginx vhost `docs.boxy.bjk.ai` proxies :3901 and serves
  `/_local/` assets from :3911 (rewrites the preview server's localhost
  redirects). Own LE cert at `/etc/letsencrypt/live/docs.boxy.bjk.ai/` — the
  `*.bjk.ai` wildcard cannot cover two-level subdomains. Content edits under
  `fern/` hot-reload; docs.yml/openapi changes are safest with
  `sudo systemctl restart boxy-docs`.
- **api.boxy.bjk.ai** — same app/API on a dedicated vhost proxying
  127.0.0.1:8086, own LE cert at `/etc/letsencrypt/live/api.boxy.bjk.ai/`.
- Note: certbot's nginx *installer* fails on this box ("Unsupported RSA key
  length: 1024" from an unrelated vhost) — use `certbot certonly` and write the
  TLS server block manually. Renewals (`certbot renew`) are unaffected.
