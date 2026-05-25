# Dev reverse proxy

Fronts SCUT's Vite UI dev server and scut-server on a single origin (`http://localhost:8080`) so dev matches the production deployment shape. This means CORS, cookies, and same-origin behavior in dev match prod.

## Install Caddy

- macOS: `brew install caddy`
- Linux (Debian/Ubuntu): `sudo apt install caddy`
- Windows: `winget install CaddyServer.Caddy`

Any Caddy v2.x release works.

## Run

From the repo root:

```
npm run dev:proxy
```

This runs three processes concurrently:

- `scut-server` (Fastify) on `:3000`
- Vite dev server (UI) on `:5173`
- Caddy reverse proxy on `:8080`

Then open http://localhost:8080.

Stopping the script (Ctrl-C) stops all three.

## Routing

| Path | Target |
|------|--------|
| `/api/*` | scut-server on :3000 (covers `/api/v1/*` resources and unversioned meta `/api/docs`, `/api/health`) |
| `/healthz`, `/readyz` | scut-server on :3000 |
| everything else | Vite dev server on :5173 (returns `index.html` for unknown routes via Vite's SPA fallback) |

## Default ports

| Service | Port | Override |
|---------|------|----------|
| scut-server | 3000 | `PORT` env var (set in `packages/server`) |
| Vite (UI) | 5173 | `--port` flag or `vite.config.ts` `server.port` |
| Caddy (proxy) | 8080 | edit the `:8080` line in `Caddyfile` |

If you change any of these, edit `Caddyfile` to match.

## Smoke tests

With `npm run dev:proxy` running, in another terminal:

```
npm run smoke
```

`scripts/smoke.sh` defaults to `http://localhost:8080`. Override with `SCUT_BASE_URL` if needed.

## Why a proxy in dev?

Production typically fronts SCUT with a reverse proxy (Caddy, nginx, Envoy, Traefik) that exposes a single origin. Running the same shape in dev avoids late surprises around CORS, cookie SameSite, and absolute-URL assumptions. Operators can swap Caddy for any other proxy in prod; this file is dev-only.
