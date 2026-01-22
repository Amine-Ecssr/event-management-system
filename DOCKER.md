# Docker Deployment Guide

This document provides instructions for running the ECSSR Events Calendar application using Docker.

## Prerequisites

- Docker Engine 20.10+ 
- Docker Compose 2.0+
- Git (for version control)

## Quick Start

### Production Deployment

1. **Clone the repository** (if not already done):
```bash
git clone <your-repository-url>
cd <repository-directory>
```

2. **Create environment file**:
```bash
cp .env.example .env
```

### Build + Push Docker Hub Images

If you need prebuilt images for the production or core/edge Compose bundles, run the helper script (after logging in with `docker login`):

```bash
./scripts/build_and_push_images.sh <tag>
```

- Defaults to the `omaralmansoori` namespace and `latest` tag when omitted.
- Builds and pushes the four images used across the stacks:
  - `eventvue-server`
  - `eventvue-client`
  - `eventvue-scraper-service`
  - `eventvue-whatsapp-service`

3. **Edit `.env` file** with your configuration:
```bash
nano .env  # or use your preferred editor
```

Required configuration:
- `SESSION_SECRET`: Generate a strong random secret
- `SUPERADMIN_USERNAME`: Admin username (default: admin)
- `SUPERADMIN_PASSWORD`: Admin password (default: admin123)
- Email settings (Resend or SMTP)

4. **Build and start the application**:
```bash
docker-compose up -d
```

5. **Access the application**:
Open your browser and navigate to: `http://localhost:5000`

6. **Login with superadmin credentials** specified in your `.env` file.

### Multi-VM Production Layout (Core + Edge)

Use the new Compose bundles when deploying across two VMs so that the scraper and WhatsApp services stay on an internet-enabled machine while the core stack remains isolated.

**VM 1 – Core (no internet access for proxy and client)**
- Compose file: `docker-compose.core.yml`
- Services: reverse proxy, client, API server, Keycloak, database, migrations
- TLS: place the self-signed cert and key provided by IT under `deploy/certs/<domain>.crt` and `deploy/certs/<domain>.key` before starting.
- Networks: `core-internal` is marked `internal: true` to block egress from the proxy and client.

Run on the core VM:
```bash
cp .env.core.example .env.core
docker compose -f docker-compose.core.yml --env-file .env.core up -d
```

**VM 2 – Edge (internet-facing scraper + WhatsApp)**
- Compose file: `docker-compose.edge.yml`
- Services: `scraper-service`, `whatsapp-service`
- Configure `CORE_API_BASE_URL` in the `.env` file used on this VM so both services can reach the core API over your private link (for example, `http://10.0.0.5:5000`).

Run on the edge VM:
```bash
cp .env.edge.example .env.edge
docker compose -f docker-compose.edge.yml --env-file .env.edge up -d
```

**Domain names and certificates**
- Domains will be configured later by the IT network team; keep the `VIRTUAL_HOST` placeholders in the Compose files and rename the certificate files to match the final domains.
- Because the certificate is self-signed, no ACME/Let's Encrypt companion is required.

### Development Mode

For local development with hot reload:

1. **Create environment file**:
```bash
cp .env.example .env
```

2. **Start development environment**:
```bash
docker-compose -f docker-compose.dev.yml up
```

This will:
- Mount your local code directory for hot reload
- Use a separate development database
- Run on port 5000

## Architecture

### Production Setup (`docker-compose.yml`)

**Multi-stage Docker build** for optimized production images:

- **Stage 1 (builder)**: Installs all dependencies and builds the application
- **Stage 2 (runtime)**: Lean image with only production dependencies and built artifacts

**Services**:
- `db`: PostgreSQL 16 database
- `migrate`: One-time migration service (runs `drizzle-kit push`)
- `app`: Express application serving both API and frontend

**Volumes**:
- `postgres_data`: Persistent PostgreSQL data
- `uploads_data`: Persistent user-uploaded files

### Development Setup (`docker-compose.dev.yml`)

- Uses bind mounts for hot reload
- Separate development database on port 5433
- Full development dependencies installed

## Environment Variables

### Required Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Auto-generated from POSTGRES_* vars |
| `SESSION_SECRET` | Secret for session encryption | `change-this-to-a-random-secret` |
| `SUPERADMIN_USERNAME` | Initial admin username | `admin` |
| `SUPERADMIN_PASSWORD` | Initial admin password | `admin123` |

### Email Configuration (Choose One)

**Option 1: Resend (Recommended)**
| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Your Resend API key |
| `FROM_EMAIL` | Sender email address |

**Option 2: SMTP**
| Variable | Description |
|----------|-------------|
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP port (usually 587) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASSWORD` | SMTP password |
| `SMTP_FROM` | Sender email address |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_DB` | Database name | `ecssr_events` |
| `POSTGRES_USER` | Database user | `postgres` |
| `POSTGRES_PASSWORD` | Database password | `postgres` |
| `PORT` | Application port | `5000` |
| `WHATSAPP_ENABLED` | Enable WhatsApp integration | `false` |

### Elasticsearch Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `ELASTICSEARCH_URL` | Elasticsearch server URL | `http://elasticsearch:9200` |
| `ELASTICSEARCH_USERNAME` | Elasticsearch username | `elastic` |
| `ELASTICSEARCH_PASSWORD` | Elasticsearch password | (required for production) |
| `ELASTICSEARCH_ENABLED` | Enable ES features | `true` |
| `ES_INDEX_PREFIX` | Index name prefix | `eventcal` |
| `ES_INDEX_SUFFIX` | Index name suffix (env) | `dev` or `prod` |
| `KIBANA_PASSWORD` | Kibana system user password | (required for Kibana) |
| `KIBANA_DOMAIN` | Kibana subdomain (prod) | `kibana.eventcal.app` |
| `KIBANA_ENCRYPTION_KEY` | Kibana encryption key (32 chars) | (required for production) |

## Common Commands

### Production

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f app

# View all logs
docker-compose logs -f

# Rebuild after code changes
docker-compose build
docker-compose up -d

# Run database migrations manually
docker-compose run --rm migrate

# Access database
docker-compose exec db psql -U postgres -d ecssr_events

# Backup database
docker-compose exec db pg_dump -U postgres ecssr_events > backup.sql

# Restore database
docker-compose exec -T db psql -U postgres ecssr_events < backup.sql
```

### Elasticsearch

```bash
# Check ES health
curl -u elastic:eventcal-dev-password-2024 http://localhost:9200/_cluster/health

# Check installed plugins (verify ICU is installed)
curl -u elastic:eventcal-dev-password-2024 http://localhost:9200/_cat/plugins

# View ES logs
docker logs ecssr-events-elasticsearch-dev

# Access Kibana
open http://localhost:5601

# Run ES security setup script (first time only)
./scripts/setup-es-security.sh

# Test Arabic tokenization
curl -X POST "localhost:9200/_analyze" \
  -u elastic:eventcal-dev-password-2024 \
  -H "Content-Type: application/json" \
  -d '{"tokenizer": "icu_tokenizer", "text": "مؤتمر الشرق الأوسط"}'
```

### Development

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Stop development environment
docker-compose -f docker-compose.dev.yml down

# Rebuild development image
docker-compose -f docker-compose.dev.yml build

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

## Data Persistence

### Volumes

Data is persisted in Docker volumes:

- **postgres_data**: Database files
- **uploads_data**: User-uploaded files (attachments, etc.)

### Backup Volumes

```bash
# Backup uploads
docker run --rm -v ecssr-events_uploads_data:/data -v $(pwd):/backup alpine tar czf /backup/uploads-backup.tar.gz -C /data .

# Restore uploads
docker run --rm -v ecssr-events_uploads_data:/data -v $(pwd):/backup alpine tar xzf /backup/uploads-backup.tar.gz -C /data
```

## Database Migrations

Migrations run automatically on startup via the `migrate` service. To run manually:

```bash
docker-compose run --rm migrate
```

## Troubleshooting

### Port Already in Use

If port 5000 is already in use, modify the ports mapping in `docker-compose.yml`:

```yaml
ports:
  - "8080:5000"  # Change 8080 to your preferred port
```

### Database Connection Issues

1. Ensure the database service is healthy:
```bash
docker-compose ps
```

2. Check database logs:
```bash
docker-compose logs db
```

3. Verify DATABASE_URL is correct in `.env`

### Elasticsearch Issues

#### ES fails to start with memory error
```bash
# Check logs
docker logs ecssr-events-elasticsearch-dev

# On Linux - increase vm.max_map_count
sudo sysctl -w vm.max_map_count=262144
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf

# On macOS - increase Docker Desktop memory to 4GB+
# Go to Docker Desktop > Settings > Resources > Memory
```

#### Kibana can't connect to ES
- Wait 60+ seconds for ES to be healthy before Kibana starts
- Check ES health: `curl -u elastic:password http://localhost:9200/_cluster/health`
- Verify KIBANA_PASSWORD matches the setup
- Run: `./scripts/setup-es-security.sh`

#### ICU plugin not found
```bash
# Rebuild ES image with ICU plugin
docker compose -f docker-compose.dev.yml build elasticsearch

# Verify plugin is installed
docker exec ecssr-events-elasticsearch-dev bin/elasticsearch-plugin list
```

#### App can't connect to ES
- Ensure ES and app are on the same Docker network
- Check `ELASTICSEARCH_URL` environment variable
- Verify ES is healthy before app starts

### Application Crashes

View application logs:
```bash
docker-compose logs app
```

Common issues:
- Missing environment variables
- Database not ready (wait for health check)
- Invalid SESSION_SECRET

### Reset Everything

To completely reset (⚠️ WARNING: This deletes all data):

```bash
docker-compose down -v
docker-compose up -d
```

## Security Considerations

### Production Checklist

- [ ] Change `SESSION_SECRET` to a strong random value (32+ characters)
- [ ] Change `SUPERADMIN_PASSWORD` from default
- [ ] Use strong `POSTGRES_PASSWORD`
- [ ] Configure firewall to restrict database port (5432) access
- [ ] Use HTTPS/TLS for production deployments
- [ ] Keep `.env` file secure and never commit to Git
- [ ] Regularly update Docker base images
- [ ] Configure proper backup strategy

### Generating Secrets

```bash
# Generate random SESSION_SECRET
openssl rand -base64 32

# Generate random password
openssl rand -base64 16
```

## Production Deployment

### Recommended Setup

1. **Use reverse proxy** (nginx, Traefik, Caddy) for HTTPS
2. **Configure domain name** and SSL certificates
3. **Set up monitoring** (logs, health checks)
4. **Configure backups** (database + uploads volume)
5. **Use Docker Swarm or Kubernetes** for high availability

### Example nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Health Checks

The application includes health check endpoints:

- Application: `http://localhost:5000/api/health`
- Database: Automatic PostgreSQL health check

Monitor with:
```bash
docker-compose ps
```

Healthy services show "healthy" status.

## Updates and Maintenance

### Updating the Application

1. Pull latest changes:
```bash
git pull
```

2. Rebuild and restart:
```bash
docker-compose build
docker-compose up -d
```

3. Migrations run automatically on startup.

### Updating Docker Images

Update base images (Node.js, PostgreSQL):
```bash
docker-compose pull
docker-compose up -d
```

## Elasticsearch Docker Setup

EventVue uses Elasticsearch 8.12.0 with the ICU plugin for bilingual search (English/Arabic).

### Development Elasticsearch

The development stack (`docker-compose.dev.yml`) includes:

```yaml
elasticsearch:
  image: elasticsearch:8.12.0
  container_name: ecssr-events-elasticsearch-dev
  environment:
    - discovery.type=single-node
    - xpack.security.enabled=true
    - ELASTIC_PASSWORD=eventcal-dev-password-2024
  ports:
    - "9200:9200"

kibana:
  image: kibana:8.12.0
  container_name: ecssr-events-kibana-dev
  ports:
    - "5601:5601"
  depends_on:
    elasticsearch:
      condition: service_healthy
```

### First-Time Elasticsearch Setup

```bash
# 1. Start the development stack
npm run docker:dev:build

# 2. Wait for ES to be healthy (30-60 seconds)
docker logs -f ecssr-events-elasticsearch-dev

# 3. Run security setup script
./scripts/setup-es-security.sh

# 4. Verify ICU plugin
curl -u elastic:eventcal-dev-password-2024 http://localhost:9200/_cat/plugins

# 5. Initialize indices
curl -X POST http://localhost:5000/api/search/admin/initialize
```

### Elasticsearch Commands

```bash
# Check ES health
curl -u elastic:eventcal-dev-password-2024 http://localhost:9200/_cluster/health?pretty

# List indices
curl -u elastic:eventcal-dev-password-2024 "http://localhost:9200/_cat/indices/eventcal-*?v"

# Test search
curl -u elastic:eventcal-dev-password-2024 \
  -X POST "http://localhost:9200/eventcal-events-dev/_search" \
  -H "Content-Type: application/json" \
  -d '{"query": {"match_all": {}}, "size": 5}'

# Reindex data from PostgreSQL
curl -X POST http://localhost:5000/api/search/admin/reindex \
  -H "Content-Type: application/json" \
  -d '{"entity": "events"}'

# Check sync status
curl http://localhost:5000/api/search/health/detailed
```

### Access Kibana

- **URL:** http://localhost:5601
- **Username:** `elastic`
- **Password:** `eventcal-dev-password-2024`

**Useful Kibana Features:**
1. **Discover** - Query and explore data
2. **Dev Tools** - Run raw ES queries
3. **Stack Monitoring** - Cluster health
4. **Index Management** - View index settings

### Production Elasticsearch Subdomains

For production, use dedicated subdomains:

| Subdomain | Service | SSL Certificate |
|-----------|---------|-----------------|
| `eventcal.app` | Main application | Let's Encrypt |
| `auth.eventcal.app` | Keycloak SSO | Let's Encrypt |
| `kibana.eventcal.app` | Kibana | Let's Encrypt |
| `storage.eventcal.app` | MinIO S3 | Let's Encrypt |

**Nginx Configuration for Kibana Subdomain:**

```nginx
server {
    listen 443 ssl http2;
    server_name kibana.eventcal.app;

    ssl_certificate /etc/letsencrypt/live/kibana.eventcal.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kibana.eventcal.app/privkey.pem;

    location / {
        proxy_pass http://kibana:5601;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Elasticsearch Volumes

```yaml
volumes:
  elasticsearch_data:
    name: eventcal-elasticsearch-data
```

**Backup ES data:**
```bash
# Create snapshot repository (MinIO/S3)
./scripts/es-backup.sh

# Manual backup
docker run --rm \
  -v eventcal-elasticsearch-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/es-data-$(date +%Y%m%d).tar.gz -C /data .
```

### Elasticsearch Troubleshooting

#### ES fails to start (memory error)

```bash
# Linux: Increase vm.max_map_count
sudo sysctl -w vm.max_map_count=262144
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf

# macOS: Increase Docker Desktop memory
# Docker Desktop > Settings > Resources > Memory (4GB minimum)
```

#### Kibana can't connect to ES

```bash
# 1. Check ES is healthy
curl -u elastic:password http://localhost:9200/_cluster/health

# 2. Verify kibana_system user exists
./scripts/setup-es-security.sh

# 3. Check Kibana logs
docker logs ecssr-events-kibana-dev
```

#### ICU plugin not installed

```bash
# Rebuild ES image
docker compose -f docker-compose.dev.yml build elasticsearch --no-cache

# Verify plugin
docker exec ecssr-events-elasticsearch-dev bin/elasticsearch-plugin list
```

#### App can't connect to ES

```bash
# Check network
docker network inspect ecssr-events_default

# Verify ELASTICSEARCH_URL in app container
docker exec ecssr-events-app printenv | grep ELASTICSEARCH
```

### Related Documentation

- [ELASTICSEARCH_SETUP.md](docs/ELASTICSEARCH_SETUP.md) - Complete setup guide
- [ELASTICSEARCH_ARCHITECTURE.md](docs/ELASTICSEARCH_ARCHITECTURE.md) - System design
- [ELASTICSEARCH_MAINTENANCE.md](docs/ELASTICSEARCH_MAINTENANCE.md) - Operations
- [ES_PRODUCTION.md](docs/ES_PRODUCTION.md) - Production deployment
- [ES_DISASTER_RECOVERY.md](docs/ES_DISASTER_RECOVERY.md) - DR procedures

## Support

For issues or questions:
1. Check application logs: `docker-compose logs app`
2. Check database logs: `docker-compose logs db`
3. Verify environment configuration in `.env`
4. Review this documentation

## Git Integration

This application uses Git for version control:

```bash
# Check status
git status

# Stage changes
git add .

# Commit changes
git commit -m "Your commit message"

# Push to remote
git push origin main
```

Configure Git ignore for Docker and environment files (already included in `.gitignore`).
