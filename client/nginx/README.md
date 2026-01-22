# Nginx Configuration for ECSSR Events Calendar

This directory contains nginx configuration files for the frontend client.

## Files

- **`default.conf`** - Main HTTP configuration (currently in use)
- **`ssl.conf.example`** - HTTPS/SSL configuration template

## Usage

### HTTP Only (Default)
The `default.conf` is used by default and provides:
- SPA routing with fallback to `index.html`
- Security headers
- Gzip compression
- Static asset caching
- Health check endpoint at `/health`

### Adding HTTPS/SSL

1. **Get SSL certificates** (via Let's Encrypt, CloudFlare, or your provider)

2. **Copy the SSL template:**
   ```bash
   cp ssl.conf.example ssl.conf
   ```

3. **Edit `ssl.conf`:**
   - Replace `yourdomain.com` with your actual domain
   - Update certificate paths
   - Uncomment the entire configuration

4. **Mount certificates in docker-compose:**
   ```yaml
   client:
     volumes:
       - ./certs/cert.pem:/etc/nginx/ssl/cert.pem:ro
       - ./certs/key.pem:/etc/nginx/ssl/key.pem:ro
   ```

5. **Use SSL config in Dockerfile:**
   ```dockerfile
   COPY client/nginx/ssl.conf /etc/nginx/conf.d/default.conf
   ```

6. **Expose port 443:**
   ```yaml
   ports:
     - "443:443"
     - "80:80"
   ```

### API Proxy (Optional)

If you want the client to proxy API requests through nginx (same-origin):

Uncomment the `/api` location block in either config file and configure:
```nginx
location /api {
    proxy_pass http://server:5000;
    # ... proxy headers
}
```

Then update the client's `VITE_API_BASE_URL` to use relative paths:
```bash
VITE_API_BASE_URL=/api
```

## Testing Configuration

Test nginx configuration before deploying:
```bash
docker run --rm -v $(pwd)/client/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro nginx:alpine nginx -t
```

## Production Recommendations

1. Use a reverse proxy (Traefik, Caddy) in front of nginx for automatic SSL
2. Enable HSTS after testing HTTPS
3. Consider using CloudFlare or a CDN for additional security and performance
4. Monitor nginx logs for errors and security issues
