# Nginx Configuration Directory

This directory stores SSL certificates and nginx configuration files on the host machine for easier management and backup.

## Directory Structure

```
nginx-config/
├── certs/          # SSL certificates (managed by Let's Encrypt)
├── vhost.d/        # Virtual host configurations
├── html/           # Static HTML files (ACME challenges)
└── acme/           # ACME client configuration and state
```

## Purpose

These directories are mounted as bind mounts in the nginx-proxy and acme-companion containers instead of using Docker volumes. This provides:

- **Direct Access**: View and manage SSL certificates directly from the host filesystem
- **Easy Backup**: Simple to backup by copying the directory
- **Debugging**: Easier to inspect configurations and certificates
- **Portability**: Certificates and configs are in a known location

## Security Notes

⚠️ **Important**: The `certs/` and `acme/` directories contain sensitive data:
- Private keys for SSL certificates
- ACME account credentials
- Certificate files

These directories are excluded from version control via `.gitignore`.

## Usage

### Production Deployment

When deploying with `docker-compose.yml`:

```bash
# Ensure the directory exists
mkdir -p nginx-config/{certs,vhost.d,html,acme}

# Start services
docker compose up -d
```

### Viewing Certificates

```bash
# List all certificates
ls -la nginx-config/certs/

# View certificate details
openssl x509 -in nginx-config/certs/your-domain.com.crt -text -noout
```

### Backup

```bash
# Backup SSL certificates and configuration
tar -czf nginx-config-backup-$(date +%Y%m%d).tar.gz nginx-config/
```

### Restore

```bash
# Restore from backup
tar -xzf nginx-config-backup-YYYYMMDD.tar.gz
```

## Permissions

The nginx-proxy container runs as root and needs read/write access to these directories. The default permissions should work, but if you encounter issues:

```bash
# Ensure proper ownership (if needed)
sudo chown -R $(whoami):$(whoami) nginx-config/
chmod -R 755 nginx-config/
```

## Troubleshooting

### Certificates Not Generating

1. Check ACME companion logs:
   ```bash
   docker logs ecssr-nginx-proxy-acme
   ```

2. Verify DNS is pointing to your server

3. Ensure ports 80 and 443 are accessible

### Permission Errors

If you see permission errors in logs:

```bash
# Fix permissions
chmod -R 755 nginx-config/
```

## Related Documentation

- [NGINX_DOCKER_SSL.md](../docs/NGINX_DOCKER_SSL.md) - Complete SSL setup guide
- [docker-compose.yml](../docker-compose.yml) - Production configuration
