# Quick Start Guide - Microservices Architecture

## What Changed?

The ECSSR Events Calendar has been refactored from a monolithic architecture to a microservices architecture with the following services:

1. **Client** (Frontend) - React + Vite + Nginx on port 80
2. **Server** (Backend) - Express + Node.js on port 5000
3. **WhatsApp Service** (Isolated) - WhatsApp session manager on port 3001
4. **Scraper Service** (Isolated) - External event scrapers on port 3002
5. **Database** - PostgreSQL 16 on port 5432
6. **Migrations** - One-time database setup

## Quick Start

### 1. Environment Setup
```bash
# Copy environment files (already done)
cp server/.env.example server/.env
cp client/.env.example client/.env
cp whatsapp-service/.env.example whatsapp-service/.env
cp scraper-service/.env.example scraper-service/.env

# Edit .env files with your actual credentials
# At minimum, update:
# - server/.env: DATABASE_URL, SESSION_SECRET, email config
# - client/.env: VITE_API_BASE_URL (for production)
```

### 2. Start All Services
```bash
# Build and start all services
docker-compose -f docker-compose.new.yml up --build

# Or run in detached mode
docker-compose -f docker-compose.new.yml up -d --build
```

### 3. Access the Application
- **Frontend**: http://localhost:80
- **Backend API**: http://localhost:5000
- **WhatsApp Service**: http://localhost:3001
- **Scraper Service**: http://localhost:3002
- **Database**: postgresql://postgres:postgres@localhost:5432/ecssr_events

### 4. View Logs
```bash
# All services
docker-compose -f docker-compose.new.yml logs -f

# Specific service
docker-compose -f docker-compose.new.yml logs -f server
docker-compose -f docker-compose.new.yml logs -f client
docker-compose -f docker-compose.new.yml logs -f whatsapp-service
docker-compose -f docker-compose.new.yml logs -f scraper-service
```

### 5. Stop Services
```bash
# Stop but keep data
docker-compose -f docker-compose.new.yml down

# Stop and remove volumes (DANGER: deletes all data)
docker-compose -f docker-compose.new.yml down -v
```

## Development Mode

For local development with hot reload:

```bash
# Terminal 1: Database
docker-compose -f docker-compose.new.yml up db

# Terminal 2: Backend
cd server && npm run dev

# Terminal 3: Frontend
cd client && npm run dev

# Terminal 4: WhatsApp Service
cd whatsapp-service && npm run dev

# Terminal 5: Scraper Service
cd scraper-service && npm run dev
```

Access:
- Frontend: http://localhost:5173 (Vite dev server)
- Backend: http://localhost:5000
- WhatsApp: http://localhost:3001

## Key Architecture Benefits

### Isolated WhatsApp Service
- **Reliability**: WhatsApp crashes don't affect main app
- **Session Management**: Dedicated container for WhatsApp sessions
- **Scalability**: Can restart/update independently
- **Security**: Isolated credentials and session data
- **Maintenance**: Easier debugging and updates

### Communication Flow
```
Client (Browser)
    ↓ HTTP
Server (Express)
    ↓ HTTP API calls
WhatsApp Service
    ↓ Baileys
WhatsApp Web
```

### Data Persistence
- `postgres_data` - Database files
- `uploads_data` - User uploads
- `whatsapp_sessions` - WhatsApp session cache

## Troubleshooting

### Services Won't Start
```bash
# Check service status
docker-compose -f docker-compose.new.yml ps

# View errors
docker-compose -f docker-compose.new.yml logs

# Rebuild specific service
docker-compose -f docker-compose.new.yml build server
docker-compose -f docker-compose.new.yml up -d server
```

### Database Connection Issues
```bash
# Check database is healthy
docker-compose -f docker-compose.new.yml ps db

# Connect to database
docker-compose -f docker-compose.new.yml exec db psql -U postgres -d ecssr_events

# Re-run migrations
docker-compose -f docker-compose.new.yml run --rm migrate
```

### WhatsApp Service Issues
```bash
# View WhatsApp service logs
docker-compose -f docker-compose.new.yml logs -f whatsapp-service

# Clear WhatsApp session and restart
docker-compose -f docker-compose.new.yml down
docker volume rm ecssr_whatsapp_sessions
docker-compose -f docker-compose.new.yml up -d
```

### Port Conflicts
If ports are already in use:
```bash
# Check what's using ports
lsof -i :80
lsof -i :5000
lsof -i :3001

# Edit docker-compose.new.yml to use different ports
# Example: "8080:80" instead of "80:80"
```

## Production Deployment

### Important: Change Default Values
Edit `server/.env`:
```env
SESSION_SECRET=<generate-random-64-char-string>
SUPERADMIN_PASSWORD=<strong-password>
POSTGRES_PASSWORD=<strong-password>
```

### Use Production Compose File
```bash
# For production, create docker-compose.prod.yml
# with proper secrets management, SSL, etc.
docker-compose -f docker-compose.prod.yml up -d
```

### Recommended Production Setup
1. **Reverse Proxy**: Nginx/Traefik with SSL
2. **Secrets Management**: Docker secrets or K8s secrets
3. **Monitoring**: Prometheus + Grafana
4. **Logging**: ELK stack or Loki
5. **Backups**: Automated database backups
6. **CDN**: Cloudflare or similar for static assets

## Migration from Old Structure

The old monolithic structure still works with `docker-compose.yml`. To migrate:

1. Backup your data:
   ```bash
   docker-compose exec db pg_dump -U postgres ecssr_events > backup.sql
   ```

2. Stop old containers:
   ```bash
   docker-compose down
   ```

3. Start new architecture:
   ```bash
   docker-compose -f docker-compose.new.yml up -d
   ```

Data in volumes will be preserved if you use the same volume names.

## Additional Documentation

- **Full Architecture**: `MICROSERVICES.md`
- **Setup Guide**: `docs/SETUP.md`
- **API Documentation**: `docs/API.md`
- **RBAC & Security**: `docs/RBAC_AND_SECURITY.md`

## Need Help?

1. Check the logs first
2. Review `MICROSERVICES.md` for detailed architecture
3. Check GitHub issues
4. Create a new issue with logs and error details

---

**Status**: ✅ Refactoring Complete
**Tested**: Structure validated, services configured
**Ready**: To build and deploy
