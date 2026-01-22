# Containerized Nginx + Let's Encrypt (nginx-proxy + acme-companion)

This project ships with a production-ready reverse proxy using `nginxproxy/nginx-proxy` and automated TLS certificates via `nginxproxy/acme-companion`.

## What it does
- Terminates HTTPS on the `reverse-proxy` container (ports 80/443)
- Auto-provisions and renews Let's Encrypt certificates
- Routes by hostname to app containers on an internal network

Hostnames used by default:
- App (client): `eventcal.app`, `www.eventcal.app`
- API (server): `api.eventcal.app`
- Auth (Keycloak): `auth.eventcal.app`

## 1) DNS prerequisites
Create A/AAAA records to your server IP:
- `eventcal.app`
- `www.eventcal.app`
- `api.eventcal.app`
- `auth.eventcal.app`

## 2) Configure environment
Edit `.env.production` and set:
- `LETSENCRYPT_EMAIL` to your email
- `DOMAIN`, `WWW_DOMAIN`, `API_DOMAIN`, `AUTH_DOMAIN` to your domains
- `VITE_API_BASE_URL` to `https://api.eventcal.app`
- `KEYCLOAK_URL` to `https://auth.eventcal.app`
- `KEYCLOAK_REDIRECT_URI` to `https://api.eventcal.app/api/auth/callback`

Example values are already present in `.env.production` for `eventcal.app`.

## 3) Bring the stack up
```bash
cd /path/to/EventVue
# Use the production env file
docker compose --env-file .env.production up -d
```

This starts:
- `reverse-proxy` (nginx-proxy) on 80/443
- `acme-companion` which requests/renews certs
- `client`, `server`, `keycloak`, `db`, etc.

## 4) Verify
- Open `https://eventcal.app` → client UI
- API: `https://api.eventcal.app/api/health`
- Auth: `https://auth.eventcal.app` (Keycloak)

## 5) Renewals
Certificates renew automatically. To test renewal logic:
```bash
# Dry run (no changes)
docker compose --env-file .env.production exec acme-companion /app/force_renew
```

## Notes
- App services no longer publish host ports; they attach to the `proxy-network` and are discovered by the proxy via Docker events.
- Routing is controlled with env vars set on services:
  - `VIRTUAL_HOST`, `VIRTUAL_PORT` for nginx-proxy
  - `LETSENCRYPT_HOST`, `LETSENCRYPT_EMAIL` for acme-companion
- Certs persist in Docker named volumes: `nginx_certs`, `nginx_vhost`, `nginx_html`, `nginx_acme`.
- If you want to disable a hostname, remove it from the service's `VIRTUAL_HOST`/`LETSENCRYPT_HOST` env variables and redeploy.
