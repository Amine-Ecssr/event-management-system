# Nginx + SSL (Certbot) Setup

This guide sets up a host-level Nginx reverse proxy with automatic HTTPS via Certbot. It proxies traffic to your running Docker services.

Important: We updated `client` to publish on `8081:80` so the host can bind `:80` and `:443`.

## 1) Prerequisites
- Ubuntu/Debian server with DNS A records pointing to your server IP:
  - `your_domain.com`
  - `www.your_domain.com`
  - (optional) `auth.your_domain.com` for Keycloak
- Docker stack up and running:

```bash
cd /root/app/eventcal
# Or your actual path to the repo
# Ensure services are up
docker compose up -d
```

By default the compose file exposes:
- Client: `http://127.0.0.1:8081`
- API (server): `http://127.0.0.1:5001`
- Keycloak: `http://127.0.0.1:8080`

## 2) Install and enable Nginx
```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl enable --now nginx
```

Open firewall if UFW is enabled:
```bash
sudo ufw allow 'Nginx Full'
```

## 3) Create Nginx site config
Create `/etc/nginx/sites-available/eventcal.conf` referencing your domains. This config proxies:
- `/` to the client on `127.0.0.1:8081`
- `/api/` to the backend on `127.0.0.1:5001`
- Optional: `auth.your_domain.com` to Keycloak on `127.0.0.1:8080`

```bash
sudo tee /etc/nginx/sites-available/eventcal.conf > /dev/null <<'NGINX'
# Primary site (HTTP only initially; Certbot will add HTTPS blocks)
server {
    listen 80;
    listen [::]:80;
    server_name your_domain.com www.your_domain.com;

    # Proxy frontend
    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Proxy API
    location /api/ {
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_pass http://127.0.0.1:5001/api/;
    }
}

# Optional: Keycloak on a subdomain
server {
    listen 80;
    listen [::]:80;
    server_name auth.your_domain.com;

    location / {
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass http://127.0.0.1:8080/;
    }
}
NGINX

sudo ln -s /etc/nginx/sites-available/eventcal.conf /etc/nginx/sites-enabled/eventcal.conf
sudo nginx -t
sudo systemctl reload nginx
```

Tip: Replace `your_domain.com` everywhere with your actual domain(s).

## 4) Install Certbot (Nginx plugin)
```bash
sudo apt install -y certbot python3-certbot-nginx
```

## 5) Obtain and install certificates
Run Certbot for your domain(s). Certbot will modify the Nginx config to add the HTTPS server blocks and set up HTTP→HTTPS redirects.

```bash
sudo certbot --nginx -d your_domain.com -d www.your_domain.com
```

- Follow the prompts to select redirect option.
- If you also want Keycloak on a subdomain:

```bash
sudo certbot --nginx -d auth.your_domain.com
```

## 6) Verify
- Open `https://your_domain.com` — should show the client UI.
- `https://your_domain.com/api/health` (or similar) should proxy to the backend.
- If configured, `https://auth.your_domain.com` should show Keycloak.

## 7) Auto-renewal
Certbot installs a systemd timer/cron. Test renewal with a dry run:
```bash
sudo certbot renew --dry-run
```

## Notes
- We kept container ports published on localhost so host Nginx can proxy to them. Ensure no other services occupy ports 80/443 on the host.
- If you prefer a single domain for both app and API, keep the `/api/` location block as above and set `VITE_API_BASE_URL` in the client build to `/api`.
- For production hardening, consider:
  - Adding `proxy_read_timeout` where long requests occur
  - Enabling gzip, caching static assets
  - Restricting direct access to backend ports with a host firewall
