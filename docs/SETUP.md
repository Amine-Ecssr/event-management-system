# Environment Setup Guide

This guide provides instructions for setting up EventVue (ECSSR Events Calendar) in different environments.

## Prerequisites

### Required Software

- **Node.js 20.x or higher** - [Download](https://nodejs.org/)
- **npm 9.x or higher** - Included with Node.js
- **PostgreSQL 16 (recommended)** - [Download](https://www.postgresql.org/download/)
- **Git** - [Download](https://git-scm.com/)

### Optional (for Docker deployment)

- **Docker Engine 20.10+** - [Download](https://docs.docker.com/get-docker/)
- **Docker Compose 2.0+** - Included with Docker Desktop

## Three Deployment Environments

This project supports three distinct deployment configurations:

| Environment | Docker Compose File | Env File | Use Case |
|-------------|---------------------|----------|----------|
| **Development** | `docker-compose.dev.yml` | `.env.development` | Local development with hot reload |
| **Production** | `docker-compose.yml` | `.env.production` | Single server with SSL |
| **Core + Edge** | `docker-compose.core.yml` + `docker-compose.edge.yml` | `.env.core` + `.env.edge` | Enterprise multi-VM deployment |

---

## 1. Development Environment Setup (Recommended for Local Dev)

### Quick Start with Docker

```bash
# 1. Clone repository
git clone <repository-url>
cd <repository-directory>

# 2. Environment is already configured in .env.development
# Create local secrets file if needed (gitignored)
cp .env.development .env.development.local

# 3. Start development environment
npm run docker:dev:build

# 4. Access at http://localhost:5000
```

### Quick Start without Docker

```bash
# 1. Install dependencies
npm install

# 2. Ensure PostgreSQL is running on port 5432 or 5433
# 3. Start development server
npm run dev
```

### Development Environment Features

- Hot module replacement (HMR) enabled
- Source code mounted as volumes
- PostgreSQL on port `5433` (avoids conflicts with local DB)
- Keycloak in dev mode (`start-dev`)
- Debug logging enabled
- No SSL/TLS required

---

## 2. Production Environment Setup (Single Server)

### Quick Start

```bash
# 1. Clone repository
git clone <repository-url>
cd <repository-directory>

# 2. Configure production environment
cp .env.example .env.production
nano .env.production  # Edit with your settings

# 3. Start production environment
npm run docker:prod:build

# 4. Access via your domain (with SSL via Let's Encrypt)
```

See `DOCKER.md` in the root directory for comprehensive Docker setup guide including:
- SSL certificate configuration with Let's Encrypt
- Database backups
- Troubleshooting

---

## 3. Core + Edge Enterprise Setup

For enterprise deployments with network isolation:

**Core VM (No Internet):**
```bash
cp .env.core.example .env.core
docker compose -f docker-compose.core.yml --env-file .env.core up -d
```

**Edge VM (Internet-Facing):**
```bash
cp .env.edge.example .env.edge
docker compose -f docker-compose.edge.yml --env-file .env.edge up -d
```

See `DOCKER.md` for detailed Core + Edge setup instructions.

---

## Environment Configuration

### Development (`.env.development`)

The development environment file is committed with safe defaults:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ecssr_events_dev

# Keycloak
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=ecssr-events
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin

# Default admin
SUPERADMIN_USERNAME=admin
SUPERADMIN_PASSWORD=admin123
```

For secrets, create `.env.development.local` (gitignored).

### Production (`.env.production`)

Required values for production:

```env
# Database
POSTGRES_DB=ecssr_events
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here

# Session
SESSION_SECRET=generate_random_32_character_string

# Admin Account
SUPERADMIN_USERNAME=admin
SUPERADMIN_PASSWORD=change_this_password

# Email (choose one)
# Option 1: Resend
RESEND_API_KEY=your_resend_api_key
FROM_EMAIL=noreply@yourdomain.com

# Option 2: SMTP
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASSWORD=your-app-password
# SMTP_FROM=your-email@gmail.com
```

### Generate Secrets

```bash
# Generate SESSION_SECRET
openssl rand -base64 32

# Generate secure password
openssl rand -base64 16
```

---

## 2. Local Development Setup

### Step 1: Install PostgreSQL

**macOS (using Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download installer from [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)

### Step 2: Create Database

```bash
# Login to PostgreSQL
psql postgres

# Create database and user
CREATE DATABASE ecssr_events;
CREATE USER ecssr_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE ecssr_events TO ecssr_user;

# Exit
\q
```

### Step 3: Clone and Install

```bash
# Clone repository
git clone <repository-url>
cd <repository-directory>

# Install dependencies
npm install
```

### Step 4: Configure Environment

Copy the committed defaults and place secrets in the ignored override file:

```bash
cp .env.development .env.development.local
```

Edit `.env.development.local` and set the values shown below (they match the committed defaults but keep your real secrets out of git):

```env
# Database Connection
DATABASE_URL=postgresql://ecssr_user:your_password@localhost:5432/ecssr_events

# Session Secret (generate with: openssl rand -base64 32)
SESSION_SECRET=your_random_secret_here

# Application Port
PORT=5000
NODE_ENV=development

# Admin Account (created on first run)
SUPERADMIN_USERNAME=admin
SUPERADMIN_PASSWORD=admin123

# Email Configuration - Option 1: Resend (recommended)
RESEND_API_KEY=your_resend_api_key
FROM_EMAIL=noreply@yourdomain.com

# Email Configuration - Option 2: SMTP (alternative)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASSWORD=your-app-password
# SMTP_FROM=your-email@gmail.com

# WhatsApp (optional)
WHATSAPP_ENABLED=false
```

### Step 5: Initialize Database

```bash
# Push database schema
npm run db:push
```

> Need a clean slate? Run `npm run db:reset` to drop the configured schemas
> (defaults to `public,keycloak`) and automatically reapply the latest Drizzle
> schema using `drizzle-kit push`.

### Step 6: Start Development Server

```bash
npm run dev
```

Application will be available at `http://localhost:5000`

---

## 3. Replit Setup

This application works on Replit but **does not depend on Replit infrastructure**.

### Setup on Replit

1. **Import repository** to Replit
2. **Secrets/Environment Variables:**
   - Add secrets via Replit Secrets panel (same as `.env` variables)
   - `DATABASE_URL` will be auto-configured if using Replit's PostgreSQL
3. **Database:**
   - Use Replit's built-in PostgreSQL, or
   - Connect to external PostgreSQL (Neon, Supabase, etc.)
4. **Run:**
   - Click "Run" button
   - Application starts with `npm run dev`

### Replit-Specific Features (Optional)

The application includes optional Replit development plugins:
- **Cartographer** - Code navigation tool
- **Dev Banner** - Development mode indicator  
- **Runtime Error Modal** - Better error display

These plugins:
- Only load when `REPL_ID` environment variable exists
- Only run in development mode (`NODE_ENV=development`)
- Are completely optional - app works without them
- Do not affect production builds

**To disable:** Remove or comment out in `vite.config.ts`

---

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `SESSION_SECRET` | Secret for encrypting sessions | 32+ random characters |
| `SUPERADMIN_USERNAME` | Initial admin username | `admin` |
| `SUPERADMIN_PASSWORD` | Initial admin password | `securePassword123` |

### Email Configuration (Required - Choose One)

**Option 1: Resend**

| Variable | Description | Example |
|----------|-------------|---------|
| `RESEND_API_KEY` | Your Resend API key | `re_xxxxxxxxxxxxx` |
| `FROM_EMAIL` | Sender email address | `noreply@yourdomain.com` |

**Option 2: SMTP**

| Variable | Description | Example |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | `your-email@gmail.com` |
| `SMTP_PASSWORD` | SMTP password/app password | `app-specific-password` |
| `SMTP_FROM` | Sender email address | `your-email@gmail.com` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Application port | `5000` |
| `NODE_ENV` | Environment mode | `development` |
| `WHATSAPP_ENABLED` | Enable WhatsApp features | `false` |
| `POSTGRES_DB` | Database name (Docker) | `ecssr_events` |
| `POSTGRES_USER` | Database user (Docker) | `postgres` |
| `POSTGRES_PASSWORD` | Database password (Docker) | `postgres` |

---

## Email Provider Setup

### Resend Setup (Recommended)

1. **Sign up:** https://resend.com/
2. **Verify domain** (for production)
3. **Generate API key:**
   - Go to API Keys section
   - Create new key
   - Copy to `RESEND_API_KEY`
4. **Set sender email:**
   - Use verified domain email
   - Set in `FROM_EMAIL`

**Advantages:**
- Better deliverability
- Modern API
- Free tier available
- Easy to set up

### SMTP Setup (Gmail Example)

1. **Enable 2-Step Verification** in Google Account
2. **Generate App Password:**
   - Google Account → Security → 2-Step Verification → App passwords
   - Select "Mail" and device
   - Copy generated password
3. **Configure environment:**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   SMTP_FROM=your-email@gmail.com
   ```

**Other SMTP providers:**
- **Office 365:** `smtp.office365.com:587`
- **SendGrid:** `smtp.sendgrid.net:587`
- **Mailgun:** `smtp.mailgun.org:587`

---

## WhatsApp Setup (Optional)

WhatsApp integration is optional and uses **Baileys** (WhatsApp Web API) running as a separate microservice.

### How It Works

1. Application generates QR code
2. Scan QR code with WhatsApp on phone
3. Session saved locally (persists across restarts)
4. Can send messages and notifications

### Enable WhatsApp

```env
WHATSAPP_ENABLED=true
```

### First-Time Setup

1. Login to admin panel
2. Navigate to Communications → WhatsApp
3. Click "Generate QR Code"
4. Scan with WhatsApp on phone (Link Device)
5. Wait for "Connected" status

### Session Persistence

- Session stored in `whatsapp-session/` directory
- Persists across application restarts
- To reconnect different account: Click "Logout" first

---

## Elasticsearch Setup

Elasticsearch provides full-text search, analytics, and autocomplete capabilities.

### Development Setup (Docker)

Elasticsearch is included in the Docker development stack:

```bash
# Start with Docker Compose
npm run docker:dev:build

# Verify ES is running
curl -u elastic:eventcal-dev-password-2024 http://localhost:9200/_cluster/health
```

**Access Kibana:** http://localhost:5601
- Username: `elastic`
- Password: `eventcal-dev-password-2024`

### First-Time Security Setup

Run the security setup script to configure users and roles:

```bash
./scripts/setup-es-security.sh
```

This creates:
- `kibana_system` user for Kibana
- `eventcal_app` user for the application
- Index patterns and roles

### Environment Variables

**Development (`.env.development`):**
```env
ELASTICSEARCH_URL=http://elasticsearch:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=eventcal-dev-password-2024
ELASTICSEARCH_ENABLED=true
ES_INDEX_PREFIX=eventcal
ES_INDEX_SUFFIX=dev
```

**Production (`.env.production`):**
```env
ELASTICSEARCH_URL=https://elasticsearch:9200
ELASTICSEARCH_USERNAME=eventcal_app
ELASTICSEARCH_PASSWORD=<secure-password>
ELASTICSEARCH_ENABLED=true
ES_INDEX_PREFIX=eventcal
ES_INDEX_SUFFIX=prod
KIBANA_PASSWORD=<kibana-system-password>
KIBANA_DOMAIN=kibana.eventcal.app
KIBANA_ENCRYPTION_KEY=<32-character-key>
```

### Initialize Indices

After ES is running, initialize the search indices:

```bash
# Via API
curl -X POST http://localhost:5000/api/search/admin/initialize

# Or trigger initial sync
curl -X POST http://localhost:5000/api/search/admin/sync
```

### Verify Installation

```bash
# Check cluster health
curl -u elastic:eventcal-dev-password-2024 http://localhost:9200/_cluster/health

# List EventVue indices
curl -u elastic:eventcal-dev-password-2024 "http://localhost:9200/_cat/indices/eventcal-*?v"

# Verify ICU plugin (required for Arabic)
curl -u elastic:eventcal-dev-password-2024 http://localhost:9200/_cat/plugins
```

### Production DNS (Subdomains)

Production uses dedicated subdomains:

| Subdomain | Service | SSL |
|-----------|---------|-----|
| `eventcal.app` | Main app | Let's Encrypt |
| `auth.eventcal.app` | Keycloak | Let's Encrypt |
| `kibana.eventcal.app` | Kibana | Let's Encrypt |
| `storage.eventcal.app` | MinIO | Let's Encrypt |

Configure in nginx or reverse proxy. See [ELASTICSEARCH_SETUP.md](./ELASTICSEARCH_SETUP.md) for details.

### Related Documentation

- [ELASTICSEARCH_SETUP.md](./ELASTICSEARCH_SETUP.md) - Complete setup guide
- [ELASTICSEARCH_ARCHITECTURE.md](./ELASTICSEARCH_ARCHITECTURE.md) - System design
- [ELASTICSEARCH_MAINTENANCE.md](./ELASTICSEARCH_MAINTENANCE.md) - Operations

---

## Database Setup Options

### Option 1: Local PostgreSQL

See "Local Development Setup" section above.

### Option 2: Neon (Serverless PostgreSQL)

1. **Sign up:** https://neon.tech/
2. **Create project**
3. **Copy connection string:**
   ```
   postgresql://user:password@host.neon.tech/database?sslmode=require
   ```
4. **Add to `.env`:**
   ```env
   DATABASE_URL=your_neon_connection_string
   ```

**Advantages:**
- Serverless (pay per use)
- Auto-scaling
- Built-in connection pooling
- Free tier available

### Option 3: Supabase PostgreSQL

1. **Sign up:** https://supabase.com/
2. **Create project**
3. **Get connection string:**
   - Settings → Database → Connection string
   - Use "Session mode" connection string
4. **Add to `.env`:**
   ```env
   DATABASE_URL=your_supabase_connection_string
   ```

### Option 4: Docker PostgreSQL

See `DOCKER.md` for containerized PostgreSQL setup.

---

## Verification Steps

After setup, verify everything works:

### 1. Check Database Connection

```bash
# Local development
npm run db:push

# Docker
docker-compose exec app npm run db:push
```

Should complete without errors.

### 2. Access Application

Open browser: `http://localhost:5000`

Should see login page.

### 3. Login

Use credentials from `.env`:
- Username: `SUPERADMIN_USERNAME`
- Password: `SUPERADMIN_PASSWORD`

### 4. Test Email

1. Go to Settings
2. Scroll to Email Test section
3. Enter your email
4. Click "Send Test Email"
5. Check inbox

### 5. Check Logs

**Local development:**
```bash
# See console output
```

**Docker:**
```bash
docker-compose logs -f app
```

Look for:
- ✅ Database connected
- ✅ Server listening on port 5000
- ❌ No error messages

---

## Troubleshooting

### Database Connection Issues

**Error:** `Connection refused` or `ECONNREFUSED`

**Solutions:**
- Check PostgreSQL is running: `systemctl status postgresql`
- Verify connection string in `DATABASE_URL`
- Check firewall/network settings
- For Docker: Ensure `db` service is healthy

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::5000`

**Solutions:**
- Change `PORT` in `.env` to different value
- Kill process using port: `lsof -ti:5000 | xargs kill`
- For Docker: Change port mapping in `docker-compose.yml`

### Missing Dependencies

**Error:** `Cannot find module 'xyz'`

**Solutions:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# For Docker
docker-compose build --no-cache
```

### Database Schema Issues

**Error:** Table or column not found

**Solutions:**
```bash
# Reset and push schema
npm run db:push

# For Docker
docker-compose run --rm migrate
```

### Email Not Working

**Resend:**
- Verify API key is correct
- Check domain is verified (for production)
- Check Resend dashboard for errors

**SMTP:**
- Verify credentials are correct
- Check "Less secure apps" or app password
- Verify SMTP host and port
- Check firewall allows SMTP traffic

### WhatsApp Issues

- Delete `whatsapp-session/` directory
- Restart application
- Generate new QR code
- Ensure phone has internet connection

---

## Development Workflow

### Starting Development

```bash
# Pull latest changes
git pull

# Install dependencies (if package.json changed)
npm install

# Push database changes (if schema changed)
npm run db:push

# Start development server
npm run dev
```

### Making Database Changes

```bash
# 1. Edit shared/schema.ts
# 2. Push changes
npm run db:push
```

### Building for Production

```bash
# Build frontend and backend
npm run build

# Start production server
npm start
```

### Running with Docker

```bash
# Development (hot reload)
docker-compose -f docker-compose.dev.yml up

# Production
docker-compose up -d
```

---

## IDE Setup

### VS Code (Recommended)

**Extensions:**
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript and JavaScript Language Features

**Settings** (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### Other IDEs

The project uses standard TypeScript/Node.js tooling and should work with any modern IDE:
- WebStorm
- Sublime Text
- Vim/Neovim

---

## Next Steps

After setup:

1. **Read documentation:** Start with `docs/AI_AGENT_GUIDE.md`
2. **Explore codebase:** See `docs/ARCHITECTURE.md`
3. **Make changes:** Follow `docs/GIT_WORKFLOW.md`
4. **Deploy:** Use Docker for production (see `DOCKER.md`)

---

## Support

**Documentation:**
- `docs/AI_AGENT_GUIDE.md` - Overview and guidelines
- `docs/ARCHITECTURE.md` - Technical architecture
- `docs/DEPENDENCIES.md` - Package information
- `docs/GIT_WORKFLOW.md` - Version control
- `DOCKER.md` - Docker deployment

**Common Issues:**
See Troubleshooting section above or search Git history:
```bash
git log --all --grep="keyword"
```
