# CLAUDE.md - AI Assistant Guide for EventVue

## 🤖 Purpose of This Document

This file is specifically designed for AI assistants (like Claude, GitHub Copilot, Cursor, etc.) working on the EventVue (ECSSR Events Calendar) codebase. It provides a comprehensive overview of the project structure, conventions, workflows, and key patterns to follow when making code changes.

**Last Updated:** December 31, 2025
**Branch:** development

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Critical Guidelines for AI Assistants](#critical-guidelines-for-ai-assistants)
3. [Technology Stack](#technology-stack)
4. [Architecture Overview](#architecture-overview)
5. [Repository Structure](#repository-structure)
6. [Development Workflows](#development-workflows)
7. [Key Patterns & Conventions](#key-patterns--conventions)
8. [Testing Strategy](#testing-strategy)
9. [Security Considerations](#security-considerations)
10. [Common Tasks](#common-tasks)
11. [Git Conventions](#git-conventions)
12. [Deployment Environments](#deployment-environments)
13. [Additional Resources](#additional-resources)

---

## Project Overview

**EventVue** is a comprehensive event management system for the ECSSR (Emirates Center for Strategic Studies and Research). It's a full-stack TypeScript application with a microservices architecture designed for managing events, tasks, departments, partnerships, leads, and organizational communications.

### Core Features
- **Event Management:** Calendar with multiple views (monthly, quarterly, bi-annual, yearly)
- **Task Management:** Workflow-based task assignments with dependencies
- **Department System:** Stakeholder/department assignments and requirements
- **Partnership Management (ORM):** Partner organizations, agreements, activities, and contacts
- **Lead Management (CRM):** Sales pipeline with interactions and status tracking
- **Contact Database:** Centralized contact and speaker management
- **Automated Reminders:** WhatsApp & Email notifications
- **Updates System:** Weekly/monthly organizational updates
- **Archive System:** Event archival with media galleries
- **File Management:** Folder-based file storage with permissions
- **Email Invitations:** Bulk invitation emails with custom templates
- **🆕 AI Chat Assistant:** RAG-powered chatbot for natural language queries
- **🆕 AI Intake Assistant:** Text-to-form extraction for events, tasks, partnerships, leads
- **🆕 Elasticsearch:** Full-text search, analytics, and autocomplete
- **🆕 Advanced Search:** Multi-entity search with filters and facets
- **🆕 Excel Export:** Export data to Excel with custom formatting

### User Roles
- **Superadmin:** Full system access, user management, settings
- **Admin:** Event/task/department management
- **Department Admin:** Department-scoped admin with communication permissions
- **Department:** View assigned events, update tasks, add comments

---

## Critical Guidelines for AI Assistants

### 🚨 ALWAYS Do This First

1. **Read the `docs/` folder** - Contains authoritative documentation
   - `docs/AI_AGENT_GUIDE.md` - Essential development guidelines
   - `docs/ARCHITECTURE.md` - Technical architecture details
   - `docs/AI_FEATURES.md` - AI assistant and intake features
   - `docs/ELASTICSEARCH_ARCHITECTURE.md` - Search infrastructure
   - `docs/RBAC_AND_SECURITY.md` - Security and permissions
   - `docs/GIT_WORKFLOW.md` - Git conventions

2. **Check Git history** before making changes:
   ```bash
   git log --oneline -- path/to/file
   ```

3. **Understand the repository pattern** - All database access goes through repositories in `server/repositories/`

4. **Never use `any` types** - This is a TypeScript project with strict typing

5. **All user input must be validated** with Zod schemas from `shared/schema.ts`

6. **Use Playwright for testing** - Always prefer automated E2E tests over manual testing

### 🚫 NEVER Do This

1. **Don't modify `shared/schema.ts` without understanding implications** - It's the single source of truth
2. **Don't bypass the repository pattern** - Always use `storage.methodName()` for database access
3. **Don't add direct SQL queries** - Use Drizzle ORM query builder
4. **Don't commit secrets or `.env` files** - Use `.env.*.local` for local secrets
5. **Don't create duplicate route files** - Add to existing modular route files
6. **Don't skip authentication middleware** - All protected routes need `isAuthenticated`, `isAdminOrSuperAdmin`, or `isSuperAdmin`
7. **Don't modify authentication logic without security review**
8. **Don't bypass Elasticsearch for search** - Use the search service layer
9. **Don't commit OpenAI API keys** - Always use environment variables

### 📝 Code Quality Standards

- **TypeScript strict mode** is enabled
- **ESM modules** are used throughout (not CommonJS)
- **Zod validation** for all API inputs
- **TanStack Query** for all frontend data fetching
- **React Hook Form** for all forms
- **Tailwind CSS** for styling (no inline styles or CSS-in-JS)
- **No `console.log` in production code** - Use proper logging
- **Playwright testing first** - Always write automated tests when possible

---

## Technology Stack

### Frontend (Client)
```
client/
├── React 18.3.1           # UI framework
├── TypeScript 5.6.3       # Type safety
├── Vite 5.4.20            # Build tool with HMR
├── TanStack Query 5.60.5  # Server state management
├── Wouter 3.3.5           # Lightweight routing (~1KB)
├── shadcn/ui              # Component library (copy-paste)
├── Radix UI               # Accessible primitives
├── Tailwind CSS 3.4.17    # Utility-first styling
├── React Hook Form 7.55.0 # Form management
├── Zod 3.24.2             # Schema validation
└── i18next 25.6.1         # Internationalization (EN/AR)
```

### Backend (Server)
```
server/
├── Node.js 20+            # Runtime
├── Express 4.21.2         # Web framework
├── TypeScript 5.6.3       # Type safety
├── Drizzle ORM 0.39.1     # Type-safe SQL ORM
├── PostgreSQL 16          # Database
├── Elasticsearch 8.12.0   # 🆕 Full-text search engine
├── Passport.js 0.7.0      # Authentication
├── Keycloak Connect 23.0.4 # SSO integration
├── Express Session 1.18.1  # Session management
├── OpenAI 6.15.0          # 🆕 AI features (LLM)
├── Resend 6.4.1           # Email service
├── Nodemailer 7.0.11      # SMTP fallback
├── Puppeteer 24.30.0      # Web scraping
├── ExcelJS 4.4.0          # 🆕 Excel generation
├── PDFKit 0.17.2          # 🆕 PDF generation
└── node-cron 4.2.1        # 🆕 Scheduled tasks
```

### Microservices
```
whatsapp-service/  # Baileys (WhatsApp Web API)
scraper-service/   # Puppeteer-based event scraping
```

### Infrastructure
```
├── Docker & Docker Compose  # Containerization
├── nginx-proxy              # Reverse proxy
├── Let's Encrypt           # Auto SSL
├── MinIO                   # S3-compatible storage
├── Keycloak                # SSO server
├── Elasticsearch 8.12.0    # 🆕 Search & analytics
└── Kibana (optional)       # 🆕 ES visualization
```

---

## Architecture Overview

### System Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React SPA)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Pages   │  │Components│  │  Hooks   │  │ Contexts │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       └─────────────┴──────────────┴─────────────┘         │
│                          │                                   │
│                  ┌───────▼────────┐                         │
│                  │ TanStack Query │                         │
│                  │ (State + Cache)│                         │
│                  └───────┬────────┘                         │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTP/REST API
┌──────────────────────────▼──────────────────────────────────┐
│                    Backend (Express)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Routes  │─▶│ Repos    │─▶│ Storage  │─▶│PostgreSQL│   │
│  │ (18 mods)│  │(20 repos)│  │ (Facade) │  │    DB    │   │
│  └────┬─────┘  └──────────┘  └──────────┘  └──────────┘   │
│       │                          │                          │
│  ┌────▼─────┐  ┌──────────┐  ┌──▼──────┐  ┌──────────┐   │
│  │   Auth   │  │ Services │  │Elastic-  │  │ Keycloak │   │
│  │ Passport │  │ Email/WS │  │ search  │  │   SSO    │   │
│  └──────────┘  └──────────┘  └─────────┘  └──────────┘   │
│                                   │                         │
│  ┌────────────────────────────────▼──────────────────────┐ │
│  │         AI Services (RAG Architecture)                 │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │ │
│  │  │ OpenAI   │  │  Tools   │  │ Orchestrator      │   │ │
│  │  │ Provider │  │  System  │  │ (Query → Response)│   │ │
│  │  └──────────┘  └──────────┘  └──────────────────┘   │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Database Architecture
- **50+ tables** organized by domain (events, tasks, departments, partnerships, leads, contacts, etc.)
- **Repository Pattern** for data access abstraction
- **Drizzle ORM** with type inference
- **Single source of truth:** `shared/schema.ts`
- **Elasticsearch indices** - 15+ domain indices synced from PostgreSQL

### Authentication Flow
```
User Login → Keycloak (SSO) or Local (Passport.js)
          ↓
    Verify Credentials
          ↓
  Create Session (PostgreSQL-backed)
          ↓
  Set HTTP-only Cookie (7 days)
          ↓
Subsequent Requests → Session Cookie → Load User
```

### Elasticsearch Architecture
```
┌────────────────────────────────────────────────────────────┐
│                    Search Architecture                      │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────────────────────────┐   │
│  │  PostgreSQL │    │       Elasticsearch 8.12        │   │
│  │  (Primary)  │───▶│   ┌─────────────────────────┐   │   │
│  └─────────────┘    │   │ eventcal-events-*       │   │   │
│        │            │   │ eventcal-tasks-*        │   │   │
│        │ sync       │   │ eventcal-contacts-*     │   │   │
│        ▼            │   │ eventcal-partnerships-* │   │   │
│  ┌─────────────┐    │   │ ...15+ indices          │   │   │
│  │   Sync      │    │   └─────────────────────────┘   │   │
│  │   Service   │    │                                 │   │
│  └─────────────┘    └─────────────────────────────────┘   │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```
eventcal/
├── client/                      # Frontend React application
│   ├── public/                  # Static assets
│   └── src/
│       ├── components/          # React components
│       │   ├── ui/             # shadcn/ui components (48 files)
│       │   ├── analytics/      # Analytics widgets
│       │   ├── contacts/       # Contact management
│       │   ├── email/          # Email configuration
│       │   ├── events/         # Event components
│       │   ├── leads/          # Lead management
│       │   ├── partnerships/   # Partnership components
│       │   ├── ai/             # 🆕 AI chat/intake components
│       │   └── workflows/      # Workflow components
│       ├── pages/              # Route components (33+ pages)
│       ├── hooks/              # Custom React hooks
│       ├── contexts/           # React context providers
│       ├── lib/                # Utilities & helpers
│       └── i18n/               # Internationalization
│
├── server/                      # Backend Express application
│   ├── routes/                 # API route modules (18+ files)
│   │   ├── event.routes.ts
│   │   ├── task.routes.ts
│   │   ├── stakeholder.routes.ts
│   │   ├── partnership.routes.ts
│   │   ├── lead.routes.ts
│   │   ├── search.routes.ts    # 🆕 Elasticsearch search
│   │   ├── ai.routes.ts        # 🆕 AI chat/intake
│   │   └── ... (12+ more)
│   ├── repositories/           # Data access layer (20+ files)
│   │   ├── base.ts            # Abstract base repository
│   │   ├── index.ts           # Storage facade
│   │   ├── event-repository.ts
│   │   ├── task-repository.ts
│   │   └── ... (16+ more)
│   ├── services/              # Business logic services
│   │   ├── elasticsearch-*.service.ts  # 🆕 ES services
│   │   ├── ai-*.service.ts             # 🆕 AI services
│   │   ├── configService.ts
│   │   ├── eventFileService.ts
│   │   └── ... (10+ more)
│   ├── elasticsearch/          # 🆕 ES client and utilities
│   ├── ai/                     # 🆕 AI providers and tools
│   ├── __tests__/             # Test suites
│   ├── migrations/            # Data migrations
│   ├── scripts/               # Utility scripts
│   ├── templates/             # Email templates
│   ├── auth.ts                # Authentication setup
│   ├── routes.ts              # Route registration
│   ├── db.ts                  # Database connection
│   └── index.ts               # Server entry point
│
├── shared/                     # Shared between client/server
│   └── schema.ts              # Database schema + Zod validators
│                              # 2076+ lines - SOURCE OF TRUTH!
│
├── whatsapp-service/          # WhatsApp microservice
│   └── src/
│       ├── whatsapp-manager.ts
│       └── baileys-manager.ts
│
├── scraper-service/           # Web scraping microservice
│   └── src/
│       ├── index.ts
│       └── sources/
│
├── scripts/                   # 🆕 Utility scripts
│   ├── es-reindex.ts         # Elasticsearch reindexing
│   └── test-analyzers.ts     # Test ES analyzers
│
├── migrations/                # Drizzle migrations
├── docs/                      # 📚 Comprehensive documentation
│   ├── AI_AGENT_GUIDE.md     # Start here!
│   ├── ARCHITECTURE.md        # Technical deep dive
│   ├── AI_FEATURES.md         # 🆕 AI setup & usage
│   ├── ELASTICSEARCH_*.md     # 🆕 6 ES guides
│   ├── RBAC_AND_SECURITY.md  # Security guide
│   ├── SETUP.md              # Environment setup
│   ├── DEPENDENCIES.md       # Package info
│   └── GIT_WORKFLOW.md       # Git conventions
│
├── docker-compose.yml         # Production deployment
├── docker-compose.dev.yml     # Development environment
├── docker-compose.core.yml    # Enterprise core services
├── docker-compose.edge.yml    # Enterprise edge services
├── package.json               # Dependencies & scripts
├── tsconfig.json              # TypeScript config
├── vite.config.ts             # Vite config
├── drizzle.config.ts          # Drizzle ORM config
└── .env.example               # Environment template
```

---

## Development Workflows

### Starting Development

```bash
# Option 1: Docker (recommended) - runs on port 5050
npm run docker:dev:build    # Start dev environment
docker-compose -f docker-compose.dev.yml logs -f  # View logs

# Option 2: Local (requires PostgreSQL + Elasticsearch)
npm install
npm run dev                 # Starts on port 5000

# Access at http://localhost:5050 (Docker) or http://localhost:5000 (local)
```

### Making Code Changes

1. **Read relevant documentation** in `docs/` folder
2. **Check Git history** for context
3. **Follow existing patterns** in similar files
4. **Update tests** - Use Playwright for E2E tests
5. **Update documentation** if changing architecture/API

### Database Changes

```bash
# 1. Edit shared/schema.ts (add/modify table)
# 2. Push schema changes to database
npm run db:push

# 3. For production, generate migration
npx drizzle-kit generate

# 4. Apply migration
npm run db:migrate
```

### Elasticsearch Reindexing

```bash
# Reindex all indices (after schema changes)
npm run es:reindex

# Test analyzers
npm run test:analyzers
```

### Adding API Endpoints

1. **Define schema** in `shared/schema.ts`:
   ```typescript
   export const myTable = pgTable('my_table', {
     id: varchar('id').primaryKey(),
     name: text('name').notNull(),
   });

   export const insertMyTableSchema = createInsertSchema(myTable);
   export type InsertMyTable = z.infer<typeof insertMyTableSchema>;
   export type MyTable = typeof myTable.$inferSelect;
   ```

2. **Create repository** in `server/repositories/mytable-repository.ts`:
   ```typescript
   export class MyTableRepository extends BaseRepository {
     async getAll(): Promise<MyTable[]> {
       return db.query.myTable.findMany();
     }
   }
   ```

3. **Expose in Storage** (`server/repositories/index.ts`):
   ```typescript
   export class Storage {
     private myTableRepo = new MyTableRepository();
     getMyTables = () => this.myTableRepo.getAll();
   }
   ```

4. **Create route** in `server/routes/mytable.routes.ts`:
   ```typescript
   import { Router } from "express";
   import { storage } from "../repositories";
   import { isAdminOrSuperAdmin } from "../auth";

   const router = Router();

   router.get('/api/mytable', isAdminOrSuperAdmin, async (req, res) => {
     const items = await storage.getMyTables();
     res.json(items);
   });

   export default router;
   ```

5. **Mount route** in `server/routes.ts`:
   ```typescript
   import myTableRoutes from "./routes/mytable.routes";
   app.use(myTableRoutes);
   ```

6. **Add frontend query** in component:
   ```typescript
   const { data, isLoading } = useQuery({
     queryKey: ['/api/mytable'],
   });
   ```

### Running Tests

```bash
# Run Vitest unit tests
npm test

# Run specific test file
npm test -- event.routes.test.ts

# Watch mode
npm test -- --watch

# Type checking
npm run check
```

### Playwright E2E Testing (CRITICAL)

**🚨 ALWAYS use Playwright for testing whenever possible!**

```bash
# 1. Start development environment (port 5050)
npm run docker:dev:build

# 2. Use Playwright browser tools:
# - browser_navigate: Navigate to URLs
# - browser_click: Click elements
# - browser_type: Type text
# - browser_wait_for: Wait for content
# - browser_evaluate: Run JavaScript
# - browser_screenshot: Capture screenshots
# - browser_accessibility_snapshot: Check accessibility

# Example test flow:
# Navigate to http://localhost:5050/login
# Type username and password
# Click login button
# Wait for dashboard to load
# Verify user is authenticated
```

See `docs/AI_AGENT_GUIDE.md` for comprehensive Playwright testing guidelines.

---

## Key Patterns & Conventions

### Repository Pattern

**All database access MUST go through repositories:**

```typescript
// ❌ BAD - Direct database access
const events = await db.query.events.findMany();

// ✅ GOOD - Use repository via storage facade
const events = await storage.getAllEvents();
```

### Elasticsearch Service Pattern

**All search operations MUST go through search services:**

```typescript
// ❌ BAD - Direct ES client usage
const results = await esClient.search({ index: 'events', query: {...} });

// ✅ GOOD - Use search service
import { searchService } from '../services/elasticsearch-search.service';
const results = await searchService.search('events', query, filters);
```

### AI Service Pattern

**All AI operations MUST go through AI services:**

```typescript
// ❌ BAD - Direct OpenAI API calls
const response = await openai.chat.completions.create({...});

// ✅ GOOD - Use AI orchestrator
import { aiOrchestrator } from '../ai/orchestrator';
const response = await aiOrchestrator.chat(userQuery, conversationId);
```

### Type-Safe Schema Pattern

**Single source of truth in `shared/schema.ts`:**

```typescript
// 1. Define database table
export const events = pgTable('events', {
  id: varchar('id').primaryKey(),
  name: text('name').notNull(),
  nameAr: text('name_ar').notNull(),
  dateFrom: timestamp('date_from').notNull(),
});

// 2. Generate Zod schema
export const insertEventSchema = createInsertSchema(events).omit({
  id: true,  // Auto-generated
});

// 3. Infer TypeScript types
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
```

### Modular Route Organization

**One route file per domain (kebab-case):**

```
server/routes/
├── event.routes.ts        # Event CRUD
├── task.routes.ts         # Task management
├── stakeholder.routes.ts  # Department/stakeholder
├── partnership.routes.ts  # Partnership ORM
├── lead.routes.ts         # Lead CRM
├── search.routes.ts       # 🆕 Elasticsearch search
├── ai.routes.ts           # 🆕 AI chat/intake
└── ... (12+ more)
```

### TanStack Query Pattern (Frontend)

**Always use TanStack Query for data fetching:**

```typescript
// ❌ BAD - Manual fetch
const [data, setData] = useState(null);
useEffect(() => {
  fetch('/api/events').then(r => r.json()).then(setData);
}, []);

// ✅ GOOD - TanStack Query
const { data, isLoading, error } = useQuery({
  queryKey: ['/api/events'],
  // Global queryFn uses queryKey as URL
});

// Mutations
const mutation = useMutation({
  mutationFn: (data) => apiRequest('POST', '/api/events', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/events'] });
  },
});
```

### Form Pattern (Frontend)

**Use React Hook Form + Zod:**

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEventSchema } from "@shared/schema.mssql";

const form = useForm({
  resolver: zodResolver(insertEventSchema),
  defaultValues: {
    name: "",
    nameAr: "",
  },
});

const onSubmit = (data) => {
  mutation.mutate(data);
};
```

### Authentication Middleware

**Three levels of protection:**

```typescript
// 1. Any authenticated user (including department role)
router.get('/api/profile', isAuthenticated, handler);

// 2. Admin or Superadmin only
router.post('/api/events', isAdminOrSuperAdmin, handler);

// 3. Superadmin only
router.delete('/api/users/:id', isSuperAdmin, handler);
```

### Bilingual Support

**All user-facing content has EN/AR fields:**

```typescript
// Database schema
{
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar').notNull(),
}

// Frontend rendering
const { i18n } = useTranslation();
const name = i18n.language === 'ar' ? event.nameAr : event.nameEn;
```

### Error Handling

**Backend:**
```typescript
try {
  const data = insertEventSchema.parse(req.body);
  const event = await storage.createEvent(data);
  res.json(event);
} catch (error) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: fromZodError(error).message });
  }
  res.status(500).json({ error: 'Internal server error' });
}
```

**Frontend:**
```typescript
const { data, error, isLoading } = useQuery({ queryKey: ['/api/events'] });

if (isLoading) return <div>Loading...</div>;
if (error) return <div>Error: {error.message}</div>;
return <div>{/* Render data */}</div>;
```

---

## Testing Strategy

### 🎭 Playwright E2E Testing (PREFERRED)

**🚨 CRITICAL: Always use Playwright for testing whenever possible!**

**Environment:**
- **Docker Compose:** `docker-compose.dev.yml`
- **Environment file:** `.env.development`
- **Application URL:** `http://localhost:5050`

**Setup:**
```bash
# Start development environment
npm run docker:dev:build

# Verify services are running
docker compose -f docker-compose.dev.yml ps
```

**Critical User Flows:**

1. **Authentication:**
   - Login with different roles
   - Session persistence
   - Logout

2. **Event Management:**
   - Create, edit, delete events
   - Upload media
   - Verify calendar views

3. **Task Management:**
   - Create tasks
   - Assign stakeholders
   - Update status
   - Add comments

4. **AI Features:**
   - Chat assistant queries
   - Intake assistant extraction
   - Conversation history

5. **Search:**
   - Full-text search
   - Filters and facets
   - Autocomplete

See `docs/AI_AGENT_GUIDE.md` section on Playwright testing for comprehensive guidelines.

### Vitest Unit Tests

```
server/__tests__/
├── routes/                 # Route tests
│   ├── event.routes.test.ts
│   ├── task.routes.test.ts
│   └── ... (13+ more)
├── setup.ts               # Test utilities
└── *.e2e.test.ts         # Legacy E2E tests
```

**Running tests:**
```bash
npm test                    # Run all tests
npm test -- --watch         # Watch mode
npm run check              # TypeScript type check
```

---

## Security Considerations

### Authentication
- **Password Hashing:** Scrypt (32-byte salt, 64-byte hash)
- **Session Storage:** PostgreSQL (not memory)
- **Session Cookie:** HTTP-only, secure in production, 7-day expiry
- **SSO:** Keycloak integration with group-based role mapping

### Authorization (RBAC)
- **Superadmin:** Full system access, user management, settings
- **Admin:** Event/task/department management
- **Department Admin:** Department-scoped admin with update email permissions
- **Department:** View assigned events, update tasks

### Input Validation
- **All API inputs** validated with Zod schemas
- **SQL injection prevention** via Drizzle parameterized queries
- **XSS prevention** via React auto-escaping and isomorphic-dompurify

### File Uploads
- **Global toggle** (can be disabled by superadmin)
- **Type restrictions:** Images (jpg, png, gif, webp), PDF, ZIP
- **Size limit:** 10MB per file
- **Access control:** Authenticated users only
- **Storage:** Outside web root, served via API endpoint

### AI Security
- **API key protection:** Never commit OpenAI API keys
- **Rate limiting:** 20 requests/minute per user for AI chat
- **Input sanitization:** DOMPurify for markdown rendering
- **Cost monitoring:** Track token usage and implement limits

### Elasticsearch Security
- **Authentication:** API key or basic auth
- **Network isolation:** ES not exposed publicly in production
- **Index access control:** Only via API endpoints
- **Query sanitization:** All user input validated

### Best Practices
- **Never commit secrets** (use `.env.*.local` files)
- **Use HTTPS in production**
- **Enable security headers** (helmet middleware)
- **Regular dependency updates** (`npm audit`)
- **Monitor failed login attempts**
- **Backup database regularly**
- **Monitor AI API usage and costs**

### Known Limitations
- ⚠️ No rate limiting on non-AI endpoints (implement for production)
- ⚠️ No 2FA (recommended for admins)
- ⚠️ No audit logging (user actions not tracked)
- ⚠️ No account lockout after failed logins
- ⚠️ Basic password requirements (6 chars minimum)

See `docs/RBAC_AND_SECURITY.md` for comprehensive security guide.

---

## Common Tasks

### Adding a New Page

1. Create component in `client/src/pages/NewPage.tsx`
2. Add route in `client/src/App.tsx`:
   ```typescript
   <Route path="/new-page" component={NewPage} />
   ```
3. Add to sidebar navigation if needed

### Adding a New Database Table

1. Define in `shared/schema.ts`:
   ```typescript
   export const newTable = pgTable('new_table', {
     id: varchar('id').primaryKey(),
     name: text('name').notNull(),
     createdAt: timestamp('created_at').defaultNow(),
   });

   export const insertNewTableSchema = createInsertSchema(newTable);
   export type NewTable = typeof newTable.$inferSelect;
   export type InsertNewTable = z.infer<typeof insertNewTableSchema>;
   ```

2. Create repository in `server/repositories/newtable-repository.ts`
3. Add to `server/repositories/index.ts` (Storage class)
4. Push schema: `npm run db:push`
5. Create route file: `server/routes/newtable.routes.ts`
6. Mount in `server/routes.ts`
7. Add frontend queries in components
8. (Optional) Add Elasticsearch index and sync

### Adding Elasticsearch Index

1. Define mapping in `server/elasticsearch/mappings/`
2. Create sync function in `server/services/elasticsearch-sync.service.ts`
3. Add to reindex script
4. Test with `npm run es:reindex`

### Adding AI Tool

1. Create tool in `server/ai/tools/`
2. Implement ITool interface
3. Register in `server/ai/registry.ts`
4. Add to orchestrator tool selection
5. Test with sample queries

### Adding Environment Variable

1. Add to `.env.example` with description
2. Add to `.env.development` (for dev)
3. Add to `.env.production` (for prod)
4. Document in `docs/SETUP.md` or `docs/AI_FEATURES.md`
5. Use in code: `process.env.VAR_NAME`

### Debugging

**Backend logs:**
```bash
# Docker
docker-compose -f docker-compose.dev.yml logs -f server

# Local
npm run dev  # Watch terminal output
```

**Database inspection:**
```bash
# Connect to PostgreSQL
docker exec -it eventcal-db psql -U postgres -d eventcal

# View tables
\dt

# Query data
SELECT * FROM events LIMIT 10;
```

**Elasticsearch debugging:**
```bash
# Check cluster health
curl http://localhost:9200/_cluster/health

# List indices
curl http://localhost:9200/_cat/indices

# Query index
curl http://localhost:9200/eventcal-events-dev/_search?pretty
```

**Frontend debugging:**
- Use React DevTools
- Check Network tab for API calls
- Use TanStack Query DevTools (included in dev mode)
- Check browser console for errors

---

## Git Conventions

### Commit Message Format

Follow **Conventional Commits**:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code formatting
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Adding tests
- `chore` - Build/tooling changes

**Examples:**
```bash
git commit -m "feat(events): add recurring events support"
git commit -m "feat(ai): add intake assistant for events"
git commit -m "feat(search): add Elasticsearch autocomplete"
git commit -m "fix(auth): prevent session timeout on active users"
git commit -m "docs: update AI features documentation"
git commit -m "refactor(storage): implement repository pattern"
```

### Workflow

```bash
# Start of day
git pull origin development

# Make changes
git add .
git commit -m "feat(feature): description"

# Push
git push origin development

# View history
git log --oneline
git log --oneline -- path/to/file
```

### Branch Strategy

- **development** - Active development branch
- **main** - Production-ready code
- **feature/name** - Large features (merge back to development)

See `docs/GIT_WORKFLOW.md` for comprehensive guide.

---

## Deployment Environments

### 1. Development (docker-compose.dev.yml)

```bash
npm run docker:dev:build    # Start with build
npm run docker:dev          # Start without build
npm run docker:dev:down     # Stop

# Or run locally
npm run dev                 # http://localhost:5000
```

**Features:**
- Hot module replacement (HMR)
- Source code mounted as volumes
- PostgreSQL on port 5433
- Elasticsearch on port 9200
- Keycloak in dev mode
- Application on port 5050
- No SSL required

### 2. Production (docker-compose.yml)

```bash
npm run docker:prod:build   # Start with build
npm run docker:prod         # Start without build
npm run docker:prod:down    # Stop
```

**Services:**
- `reverse-proxy` - nginx-proxy (ports 80, 443)
- `acme-companion` - Let's Encrypt SSL
- `db` - PostgreSQL 16
- `elasticsearch` - Elasticsearch 8.12
- `keycloak` - SSO server
- `server` - Express API
- `client` - Nginx serving React SPA
- `whatsapp-service` - WhatsApp messaging
- `scraper-service` - Event scraping
- `minio` - Object storage

**Subdomains:**
- `eventcal.app` - Main application
- `auth.eventcal.app` - Keycloak SSO
- `kibana.eventcal.app` - Elasticsearch visualization (optional)
- `storage.eventcal.app` - MinIO S3

**Features:**
- Automatic SSL via Let's Encrypt
- Production build optimizations
- Health checks
- Restart policies
- Volume persistence

### 3. Core + Edge (Enterprise Multi-VM)

**Core VM (Isolated):**
```bash
docker-compose -f docker-compose.core.yml up -d
```

**Edge VM (Internet-Facing):**
```bash
docker-compose -f docker-compose.edge.yml up -d
```

**Architecture:**
- Core: Backend services (DB, API, Keycloak, MinIO, Elasticsearch)
- Edge: Frontend + microservices (Client, WhatsApp, Scraper)
- Network isolation for security

See `DOCKER.md` for comprehensive deployment guide.

---

## Additional Resources

### Documentation Files (Priority Order)

1. **CLAUDE.md** (this file) - AI assistant guide
2. **docs/AI_AGENT_GUIDE.md** - Development guidelines
3. **docs/ARCHITECTURE.md** - Technical deep dive
4. **docs/AI_FEATURES.md** - 🆕 AI setup and usage
5. **docs/ELASTICSEARCH_ARCHITECTURE.md** - 🆕 Search infrastructure
6. **docs/ELASTICSEARCH_API.md** - 🆕 Search API reference
7. **docs/ELASTICSEARCH_QUERIES.md** - 🆕 Query examples
8. **docs/ELASTICSEARCH_MAINTENANCE.md** - 🆕 ES operations
9. **docs/RBAC_AND_SECURITY.md** - Security guide
10. **docs/SETUP.md** - Environment setup
11. **docs/DEPENDENCIES.md** - Package information
12. **docs/GIT_WORKFLOW.md** - Version control
13. **DOCKER.md** - Docker deployment
14. **replit.md** - Project overview and recent changes

### External Documentation

- [React](https://react.dev/) - UI framework
- [TanStack Query](https://tanstack.com/query/latest) - Data fetching
- [Drizzle ORM](https://orm.drizzle.team/) - Database ORM
- [shadcn/ui](https://ui.shadcn.com/) - Component library
- [Express](https://expressjs.com/) - Web framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Zod](https://zod.dev/) - Schema validation
- [Keycloak](https://www.keycloak.org/documentation) - SSO
- [Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/8.12/index.html) - Search engine
- [OpenAI API](https://platform.openai.com/docs/api-reference) - LLM API
- [Playwright](https://playwright.dev/) - E2E testing

### Quick Reference Commands

```bash
# Development
npm run dev                 # Local development
npm run docker:dev:build    # Docker development

# Testing
npm test                    # Run Vitest tests
npm run check              # TypeScript check
# Use Playwright browser tools for E2E testing

# Database
npm run db:push            # Push schema changes
npm run db:migrate         # Run migrations
npm run db:reset           # Reset database (dev only)

# Elasticsearch
npm run es:reindex         # Reindex all indices
npm run test:analyzers     # Test ES analyzers

# Production
npm run build              # Build for production
npm start                  # Start production server
npm run docker:prod:build  # Docker production

# Utilities
npm run seed:sample-data   # Seed sample data
```

---

## 📌 Summary for AI Assistants

### Key Takeaways

1. **Documentation First** - Always read `docs/` before making changes
2. **Repository Pattern** - All database access via `storage.methodName()`
3. **Service Layer** - Use ES and AI services, don't call directly
4. **Type Safety** - Use Zod schemas from `shared/schema.ts`
5. **No Direct SQL** - Use Drizzle ORM query builder
6. **Modular Routes** - Add to existing route files (18+ modules)
7. **TanStack Query** - For all frontend data fetching
8. **Authentication** - Use middleware guards on all protected routes
9. **Playwright First** - Always prefer automated E2E tests
10. **Git Conventions** - Follow Conventional Commits format
11. **Security** - Never commit secrets, validate all inputs
12. **AI Best Practices** - Monitor costs, rate limit, sanitize inputs
13. **ES Best Practices** - Use services, don't bypass abstraction

### Before Making Changes

- [ ] Read relevant documentation in `docs/`
- [ ] Check Git history for context: `git log --oneline -- file`
- [ ] Review existing patterns in similar files
- [ ] Understand the architecture (Routes → Services → Repos → DB/ES)
- [ ] Plan which repository/service to modify/create
- [ ] Ensure proper authentication middleware
- [ ] Add Zod validation for new schemas
- [ ] Write Playwright tests for user flows
- [ ] Update documentation if needed

### After Making Changes

- [ ] Test locally or with Docker (port 5050)
- [ ] Run TypeScript check: `npm run check`
- [ ] Run Vitest tests: `npm test`
- [ ] Write Playwright E2E tests for critical flows
- [ ] Update `replit.md` Recent Changes section
- [ ] Update relevant docs in `docs/` folder
- [ ] Commit with conventional format
- [ ] Verify no secrets committed
- [ ] Check Elasticsearch indices if schema changed
- [ ] Verify AI features still work if modified

---

**Last Updated:** December 31, 2025
**Branch:** development

**Maintained By:** AI Assistants working on EventVue

**Questions?** Check `docs/AI_AGENT_GUIDE.md` or Git history for answers.
