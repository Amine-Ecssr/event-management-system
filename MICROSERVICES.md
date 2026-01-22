# ECSSR Events Calendar - Microservices Architecture

This document describes the refactored microservices architecture with separate containers for frontend, backend, WhatsApp service, scraper service, and database.

## Architecture Overview

```
┌─────────────────┐
│   Client        │  (React + Vite + Nginx)
│   Port: 80      │
└────────┬────────┘
         │
         │ HTTP
         ▼
┌─────────────────┐
│   Server        │  (Express + Node.js)
│   Port: 5000    │
└────┬────────┬───┬────────┐
     │        │   │        │
     │        │   │ HTTP API
     │        │   ▼
     │   ┌──────────────────┐
     │   │ WhatsApp Service │  (Isolated Session Manager)
     │   │ Port: 3001       │
     │   └──────────────────┘
     │
     │ HTTP (signed)
     ▼
┌──────────────────┐
│ Scraper Service  │  (Isolated Scrapers)
│ Port: 3002       │
└──────────────────┘
     │
     │ PostgreSQL
     ▼
┌─────────────────┐
│   Database      │  (PostgreSQL 16)
│   Port: 5432    │
└─────────────────┘
```

## Services

### 1. Client (Frontend)
- **Location:** `client/`
- **Technology:** React 18, TypeScript, Vite, Tailwind CSS
- **Port:** 80 (HTTP)
- **Container:** `ecssr-events-client`
- **Build:** Multi-stage (Node build + Nginx serve)

**Key Features:**
- Single-page application with React Router
- TanStack Query for API data fetching
- Internationalization (English/Arabic)
- Responsive design with Tailwind CSS

**Environment Variables:**
- `VITE_API_BASE_URL` - Backend API URL (default: http://localhost:5000)

### 2. Server (Backend)
- **Location:** `server/`
- **Technology:** Express.js, Node.js, Drizzle ORM
- **Port:** 5000
- **Container:** `ecssr-events-server`

**Key Features:**
- RESTful API endpoints
- Authentication & authorization (RBAC)
- Database migrations
- Email notifications (Resend/SMTP)
- Task scheduling & reminders
- Event scraping service
- File upload handling

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `WHATSAPP_SERVICE_URL` - WhatsApp service API URL
- `SCRAPER_SERVICE_URL` / `SCRAPER_SERVICE_SECRET` - Scraper microservice endpoint and signing secret
- `RESEND_API_KEY` / SMTP configuration
- See `server/.env.example` for full list

### 3. WhatsApp Service
- **Location:** `whatsapp-service/`
- **Technology:** Express.js, Node.js, Baileys (WhatsApp client)
- **Port:** 3001
- **Container:** `ecssr-whatsapp-service`

**Key Features:**
- Isolated WhatsApp session management
- QR code authentication
- Message sending API
- Chat list retrieval
- Session persistence across restarts
- Dedicated cache volume for session data

**Why Isolated?**
- **Session Stability:** WhatsApp sessions require careful management and can be fragile. Isolating them prevents crashes from affecting the main application.
- **Independent Scaling:** Can restart/update without disrupting main server.
- **Security:** Credentials and session data are isolated.
- **Maintenance:** Easier to debug and maintain WhatsApp-specific logic.

**API Endpoints:**
- `GET /health` - Health check
- `GET /api/whatsapp/status` - Session status
- `GET /api/whatsapp/qr` - Get QR code for auth
- `POST /api/whatsapp/start` - Start session
- `POST /api/whatsapp/logout` - Logout session
- `GET /api/whatsapp/chats` - List chats
- `POST /api/whatsapp/send` - Send message
- `POST /api/whatsapp/notify/event` - Send event notification
- `POST /api/whatsapp/notify/event-with-stakeholders` - Send event with stakeholders
- `POST /api/whatsapp/notify/task-reminder` - Send task reminder

### 4. Scraper Service
- **Location:** `scraper-service/`
- **Technology:** Express.js, Node.js, Cheerio
- **Port:** 3002
- **Container:** `ecssr-scraper-service`

**Key Features:**
- Internet-facing scraping kept outside the main backend
- HMAC-signed responses using `SCRAPER_SERVICE_SECRET`
- Token-protected endpoints via `x-scraper-auth` header

**API Endpoints:**
- `GET /health` - Health check
- `POST /api/scraper/abu-dhabi` - Fetch Abu Dhabi Media Office events
- `POST /api/scraper/adnec` - Fetch ADNEC events
- `POST /api/scraper/all` - Fetch all supported sources in one call

**Environment Variables:**
- `SCRAPER_SERVICE_TOKEN` - Shared token required on inbound requests
- `SCRAPER_SERVICE_SECRET` - Secret used to sign responses for backend verification
- `PORT` - Defaults to 3002

### 5. Database
- **Technology:** PostgreSQL 16
- **Port:** 5432
- **Container:** `ecssr-events-db`
- **Volume:** `postgres_data` (persistent)

### 6. Migrations
- **Container:** `ecssr-events-migrate`
- **Runs Once:** On startup, after database is healthy
- **Purpose:** Apply database schema migrations

## Docker Setup

### Quick Start

1. **Copy environment files:**
   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   cp whatsapp-service/.env.example whatsapp-service/.env
   ```

2. **Configure environment variables:**
   Edit the `.env` files with your actual values (database credentials, API keys, etc.)

3. **Build and start all services:**
   ```bash
   docker-compose -f docker-compose.new.yml up --build
   ```

4. **Access the application:**
   - Frontend: http://localhost:80
   - Backend API: http://localhost:5000
   - WhatsApp Service: http://localhost:3001

### Development Mode

For development with hot reload:

```bash
# In separate terminals:
cd client && npm run dev    # Frontend on :5173
cd server && npm run dev    # Backend on :5000
cd whatsapp-service && npm run dev  # WhatsApp on :3001
```

### Individual Service Management

```bash
# Build specific service
docker-compose -f docker-compose.new.yml build client

# Start specific service
docker-compose -f docker-compose.new.yml up client

# View logs
docker-compose -f docker-compose.new.yml logs -f server

# Stop all services
docker-compose -f docker-compose.new.yml down

# Stop and remove volumes (DANGER: deletes data)
docker-compose -f docker-compose.new.yml down -v
```

## Volumes

- **postgres_data:** Database files (persistent)
- **uploads_data:** User uploaded files (persistent)
- **whatsapp_sessions:** WhatsApp session cache (persistent)

## Networking

All services communicate via the `ecssr-network` bridge network:
- Services reference each other by container name
- Internal DNS resolution (e.g., `server:5000`)
- Only specified ports are exposed to host

## Health Checks

All services include health checks:
- **Database:** `pg_isready`
- **Server:** HTTP GET to `/api/health`
- **Client:** HTTP GET to `/`
- **WhatsApp:** HTTP GET to `/health`

## Migration from Monolith

### What Changed:

1. **Separate Dockerfiles:** Each service has its own Dockerfile
2. **WhatsApp Isolation:** WhatsApp logic moved to `whatsapp-service/`
3. **HTTP Communication:** Server communicates with WhatsApp service via REST API
4. **Independent Scaling:** Each service can be scaled/restarted independently
5. **Volume Management:** Separate volumes for each service's data

### Backwards Compatibility:

- Existing database schema remains unchanged
- API endpoints remain the same (transparent to frontend)
- Environment variables mostly the same (some additions)

## Production Considerations

### Security:
- Change all default passwords in `.env` files
- Use strong `SESSION_SECRET`
- Enable HTTPS with reverse proxy (Nginx/Traefik)
- Restrict database access
- Use secrets management (Docker secrets, Kubernetes secrets, etc.)

### Performance:
- Consider using CDN for frontend static assets
- Scale server horizontally if needed
- Monitor WhatsApp service for session stability
- Regular database backups

### Monitoring:
- Set up logging aggregation (ELK, Grafana Loki)
- Monitor health check endpoints
- Alert on service failures
- Track WhatsApp session stability

## Troubleshooting

### WhatsApp Service Not Connecting:
1. Check logs: `docker-compose logs whatsapp-service`
2. Verify session cache: `docker volume inspect ecssr_whatsapp_sessions`
3. Try logout and re-authenticate
4. Ensure Baileys dependencies are installed

### Database Connection Issues:
1. Verify database is healthy: `docker-compose ps`
2. Check connection string in server env
3. Ensure migrations completed: `docker-compose logs migrate`

### CORS Errors:
1. Verify `VITE_API_BASE_URL` in client
2. Check server CORS configuration
3. Ensure proper network connectivity

## Development Workflow

1. **Make changes** to code
2. **Rebuild service:** `docker-compose build <service>`
3. **Restart service:** `docker-compose up -d <service>`
4. **View logs:** `docker-compose logs -f <service>`
5. **Test changes**
6. **Commit with git**

## Git History

File moves were done with `git mv` to preserve history:
- `server/whatsapp.ts` → `whatsapp-service/src/whatsapp-manager.ts`

## Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Microservices Architecture](https://microservices.io/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [React Query (TanStack)](https://tanstack.com/query/)

---

**Questions or Issues?** Check the main project documentation in `docs/` or create an issue.
