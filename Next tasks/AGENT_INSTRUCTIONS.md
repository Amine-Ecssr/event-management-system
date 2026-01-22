# Agent Instructions - EventVue Elasticsearch Implementation

> **Purpose**: Starting point for AI agents continuing development on the Elasticsearch features.
> **Project**: EventVue (ECSSR Events Calendar)
> **Created**: December 20, 2025

---

## 🎯 Quick Start for New Agents

1. **Read the tracker first**: Check [TASK_TRACKER.md](TASK_TRACKER.md) for current progress
2. **Understand the project**: Review `/.github/copilot-instructions.md` for project conventions
3. **Check environment status**: The project uses Docker - check if containers are running
4. **Continue from last task**: Pick up where the previous agent left off

---

## 📂 Project Context

### What is EventVue?
A full-stack event management system with:
- Event Calendar (multiple views)
- Task Management with stakeholder assignments
- Partnerships & CRM features
- Role-Based Access Control (RBAC)
- SSO via Keycloak

### What are we building?
Adding **Elasticsearch** infrastructure for:
- Advanced full-text search (Arabic + English)
- Real-time analytics dashboards
- Aggregations and reporting
- Kibana visualization

---

## 🔧 Development Environment

### Starting the Environment
```bash
# With Docker (recommended)
npm run docker:dev:build

# Check if running
docker ps

# View logs
docker compose -f docker-compose.dev.yml logs -f

# Stop
npm run docker:dev:down
```

### Key Services & Ports
| Service | Port | URL |
|---------|------|-----|
| App | 5000 | http://localhost:5000 |
| PostgreSQL | 5433 | localhost:5433 |
| Keycloak | 8080 | http://localhost:8080 |
| MinIO | 9000/9001 | http://localhost:9001 |
| Elasticsearch | 9200 | http://localhost:9200 |
| Kibana | 5601 | http://localhost:5601 |

### Database Commands (Docker)
```bash
# ALWAYS run inside container when using Docker
docker compose -f docker-compose.dev.yml exec app npm run db:migrate
docker compose -f docker-compose.dev.yml exec app npm run db:push
```

---

## 📋 Current Task List

The `Next tasks/` folder contains 20 tasks organized by priority:

### Infrastructure (Must do first)
1. **01-infrastructure-elasticsearch-docker-setup.md** - Add ES to Docker
2. **02-infrastructure-elasticsearch-backend-client.md** - Node.js ES client
3. **03-infrastructure-elasticsearch-analyzers.md** - Arabic/English analyzers
4. **04-infrastructure-elasticsearch-index-management.md** - Index definitions

### Core Features
5. **05-feature-realtime-elasticsearch-indexing.md** - Real-time sync
6. **06-feature-elasticsearch-scheduled-sync.md** - Batch sync jobs
7. **07-feature-elasticsearch-search-service.md** - Search API
8. **08-feature-advanced-search-ui.md** - Frontend search

### Analytics (After core is done)
9-14. Various dashboard features

### Advanced
15-20. Kibana, export, admin tools, documentation

---

## 🏗️ Architecture Guidelines

### File Structure for ES Features
```
server/
├── elasticsearch/           # NEW - ES integration
│   ├── client.ts           # ES client singleton
│   ├── config.ts           # Index names, settings
│   ├── health.ts           # Health checks
│   ├── analyzers/          # Arabic/English analyzers
│   │   └── index.ts
│   ├── indices/            # Index definitions
│   │   ├── index-manager.ts
│   │   ├── events.ts
│   │   ├── tasks.ts
│   │   └── ...
│   ├── services/           # Search/index services
│   │   ├── search-service.ts
│   │   ├── index-service.ts
│   │   └── aggregation-service.ts
│   └── sync/               # Sync logic
│       ├── realtime-sync.ts
│       └── scheduled-sync.ts
```

### Docker Files to Modify
- `docker-compose.dev.yml` - Development ES
- `docker-compose.yml` - Production ES
- `docker-compose.core.yml` - Core/Edge ES

### Key Patterns
1. **Single source of truth**: Types from `shared/schema.ts`
2. **TanStack Query**: For all frontend data fetching
3. **Repository pattern**: Data access in `server/repositories/`
4. **Zod validation**: All inputs validated

---

## ⚠️ Important Rules

### DO:
- ✅ Update TASK_TRACKER.md after completing work
- ✅ Run containers and test changes
- ✅ Follow existing code patterns
- ✅ Add i18n keys for all UI text
- ✅ Use TypeScript strictly

### DON'T:
- ❌ Hardcode credentials (use env vars)
- ❌ Skip the tracker updates
- ❌ Run DB commands outside container (when Docker is running)
- ❌ Create files without checking existing patterns

---

## 🔄 Handover Protocol

When finishing a session:

1. **Update TASK_TRACKER.md**:
   - Mark completed tasks
   - Add session progress log entry
   - Note any blockers or issues
   - List files created/modified

2. **Test your changes**:
   - Ensure containers start
   - Verify health checks pass
   - Check for TypeScript errors

3. **Commit if appropriate**:
   ```bash
   git add .
   git commit -m "feat(elasticsearch): [description of work]"
   ```

---

## 🧪 Testing ES Setup

After implementing Task 01:
```bash
# Check ES health
curl -u elastic:eventcal-dev-password-2024 http://localhost:9200/_cluster/health

# Expected: {"status":"green"} or {"status":"yellow"}

# Check ICU plugin
curl -u elastic:eventcal-dev-password-2024 http://localhost:9200/_cat/plugins

# Expected: analysis-icu in the list

# Test Arabic tokenization
curl -X POST "localhost:9200/_analyze" \
  -u elastic:eventcal-dev-password-2024 \
  -H "Content-Type: application/json" \
  -d '{"tokenizer": "icu_tokenizer", "text": "مؤتمر الشرق الأوسط"}'
```

---

## 📚 Reference Documentation

- **Project README**: `/docs/README.md`
- **Architecture**: `/docs/ARCHITECTURE.md`
- **Docker Guide**: `/DOCKER.md`
- **AI Agent Guide**: `/docs/AI_AGENT_GUIDE.md`
- **Copilot Instructions**: `/.github/copilot-instructions.md`

---

## 💡 Tips for Success

1. **Read task files thoroughly** - They contain complete implementation code
2. **Check existing patterns** - Look at how MinIO/Keycloak are configured
3. **Small commits** - Commit after each major change
4. **Test incrementally** - Verify each step before moving on
5. **Update the tracker** - It's the handover lifeline

---

## 🆘 Troubleshooting

### ES won't start
```bash
# Check logs
docker logs ecssr-events-elasticsearch-dev

# Common fix: increase vm.max_map_count
# On Linux:
sudo sysctl -w vm.max_map_count=262144

# On macOS: Increase Docker Desktop memory to 4GB+
```

### Kibana can't connect
- Wait for ES to be healthy first (can take 60+ seconds)
- Check ES logs for errors
- Verify passwords match in .env files

### App can't reach ES
- Ensure ES is in same Docker network
- Check `ELASTICSEARCH_URL` env var
- Verify ES health endpoint responds

---

**Good luck! Check TASK_TRACKER.md for your starting point.**
