# ECSSR Events Calendar - Technical Architecture

## System Overview

The ECSSR Events Calendar is a full-stack web application built with a clear separation between frontend (React SPA) and backend (Express API server). The architecture emphasizes type safety, maintainability, and role-based access control.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Pages      │  │  Components  │  │   Hooks      │       │
│  │  (Routes)    │  │  (shadcn/ui) │  │  (TanStack)  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│         │                   │                  │             │
│         └───────────────────┴──────────────────┘             │
│                             │                                │
│                    ┌────────▼────────┐                       │
│                    │  TanStack Query │                       │
│                    │  (State Mgmt)   │                       │
│                    └────────┬────────┘                       │
└─────────────────────────────┼──────────────────────────────┘
                              │ HTTP/REST
                              │
┌─────────────────────────────▼──────────────────────────────┐
│                    Backend (Express)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Routes     │─▶│   Storage    │─▶│  PostgreSQL  │     │
│  │  (API + Auth)│  │ (Repository) │  │   Database   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                                                    │
│  ┌──────▼──────┐                                           │
│  │  Services   │  (WhatsApp, Email, Scheduler)             │
│  └─────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend Layer

**Core Framework:**
- **React 18** - Component-based UI framework
- **TypeScript** - Type-safe JavaScript superset
- **Vite 5** - Modern build tool with HMR

**State Management:**
- **TanStack Query v5** - Server state synchronization
  - Automatic caching and invalidation
  - Optimistic updates
  - Background refetching
  - No Redux needed - server state is separate from UI state

**Routing:**
- **Wouter** - Lightweight client-side router (~1KB)
  - Pattern: `<Route path="/events" component={Events} />`

**UI & Styling:**
- **shadcn/ui** - Composable component library (New York style)
- **Radix UI** - Unstyled accessible primitives
- **Tailwind CSS 3** - Utility-first CSS framework
- **Lucide React** - Icon library

**Forms & Validation:**
- **React Hook Form** - Performant form library
- **Zod** - TypeScript-first schema validation
- **@hookform/resolvers** - Zod integration for forms

**Rich Text:**
- **ReactQuill** - WYSIWYG editor for updates feature

### Backend Layer

**Runtime & Framework:**
- **Node.js 20** - JavaScript runtime
- **Express.js** - Web application framework
- **TypeScript** - Compiled with esbuild for production

**Database:**
- **PostgreSQL 16** - Relational database
- **Drizzle ORM** - Type-safe SQL ORM
  - Schema-first design
  - Type inference from schema
  - No code generation needed

**Authentication:**
- **Passport.js** - Authentication middleware
  - Local strategy (username/password)
  - Scrypt for password hashing (Node.js built-in crypto)
- **Express-session** - Session management
  - PostgreSQL session store (connect-pg-simple)
  - HTTP-only cookies

**Services:**
- **Baileys** - WhatsApp Web API integration
- **Resend** - Transactional email service
- **Nodemailer** - SMTP email alternative

### Shared Layer

**Type System:**
- `shared/schema.ts` - Single source of truth for:
  - Database schema (Drizzle tables)
  - Validation schemas (Zod)
  - TypeScript types (inferred from Drizzle)

**Pattern:**
```typescript
// Database table definition
export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  // ...
});

// Zod validation schema
export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
});

// TypeScript types (auto-inferred)
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;
```

## Data Flow

### Frontend → Backend (Write Operations)

1. **User interacts** with form/button
2. **React Hook Form** validates with Zod schema
3. **TanStack Mutation** sends request via `apiRequest()` helper
4. **Express route** receives and validates with same Zod schema
5. **Storage layer** performs database operation
6. **Response** sent back to frontend
7. **Cache invalidation** triggers refetch of related queries

Example:
```typescript
// Frontend
const mutation = useMutation({
  mutationFn: (data) => apiRequest('POST', '/api/events', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/events'] });
  },
});

// Backend
app.post('/api/events', isAdminOrSuperAdmin, async (req, res) => {
  const data = insertEventSchema.parse(req.body);
  const event = await storage.createEvent(data);
  res.json(event);
});
```

### Backend → Frontend (Read Operations)

1. **Component mounts** or dependencies change
2. **TanStack Query** checks cache
3. If stale/missing, sends GET request
4. **Express route** queries database via storage layer
5. **Data returned** and cached
6. **Component re-renders** with data

Example:
```typescript
// Frontend
const { data, isLoading } = useQuery({
  queryKey: ['/api/events'],
  // queryFn is set globally to fetch from queryKey
});

// Backend
app.get('/api/events', async (req, res) => {
  const events = await storage.getAllEvents();
  res.json(events);
});
```

## Database Architecture

### Schema Design

**Core Tables:**
- `events` - Calendar events
- `users` - User accounts (admin/stakeholder)
- `stakeholders` - Stakeholder organizations
- `stakeholder_accounts` - Links users to stakeholders
- `event_stakeholders` - Event assignments
- `reminder_queue` - Scheduled reminders
- `updates` - Weekly/monthly updates
- `sessions` - User sessions

**Key Relationships:**
- Users → Stakeholders (many-to-one via stakeholder_accounts)
- Events → Stakeholders (many-to-many via event_stakeholders)
- Events → Reminder Queue (one-to-many)

### ORM Pattern (Drizzle)

**Repository Pattern** (`server/repositories/`):

The data access layer uses a repository pattern with domain-specific repositories:

```typescript
// Base repository (server/repositories/base.ts)
export abstract class BaseRepository {
  protected db = db;
  
  protected async findOne<T>(query: any): Promise<T | undefined> {
    const [result] = await query;
    return result || undefined;
  }
}

// Domain repository (server/repositories/event-repository.ts)
export class EventRepository extends BaseRepository {
  async getAllEvents(): Promise<Event[]> {
    return db.query.events.findMany();
  }
  
  async createEvent(data: InsertEvent): Promise<Event> {
    const [event] = await db.insert(events).values(data).returning();
    return event;
  }
}

// Storage facade (server/repositories/index.ts)
export class Storage {
  private eventRepo = new EventRepository();
  private userRepo = new UserRepository();
  // ... other repositories
  
  // Delegate to repositories
  getAllEvents = () => this.eventRepo.getAllEvents();
  createEvent = (data: InsertEvent) => this.eventRepo.createEvent(data);
}

export const storage = new Storage();
```

**Available Repositories:**
- `UserRepository` - User management
- `EventRepository` - Event CRUD operations
- `CategoryRepository` - Event categories
- `DepartmentRepository` - Stakeholder/department management
- `TaskRepository` - Task operations
- `ArchiveRepository` - Archive operations
- `PartnershipRepository` - Partnership management
- `LeadRepository` - Lead management
- `ContactRepository` - Contact/speaker management
- `SettingsRepository` - Application settings
- `ReminderRepository` - Reminder queue operations
- `UpdateRepository` - Weekly/monthly updates
- `WorkflowRepository` - Task workflows
- `InvitationRepository` - Event invitations
- `MediaRepository` - Event media/photos
- `AuthRepository` - Keycloak authentication

**Benefits:**
- Abstraction layer for easier testing
- Centralized database queries
- Type-safe database operations
- Easy to switch database implementations

## Authentication & Authorization

### Authentication Flow

1. User submits credentials via login form
2. Passport.js verifies username/password
   - Password hashed with scrypt
   - Compared against stored hash
3. On success, session created in PostgreSQL
4. Session ID stored in HTTP-only cookie
5. Subsequent requests include cookie
6. Express-session retrieves user from database

### Authorization Model

**Role-Based Access Control (RBAC):**

| Role | Permissions |
|------|-------------|
| **Superadmin** | All permissions, cannot be deleted, user management |
| **Admin** | Event CRUD, stakeholder management, task creation, reminders |
| **Stakeholder** | View assigned events, update tasks, add comments |

**Middleware Guards:**
```typescript
// Require any authenticated user
app.get('/api/profile', isAuthenticated, handler);

// Require admin or superadmin
app.post('/api/events', isAdminOrSuperAdmin, handler);

// Require superadmin only
app.delete('/api/users/:id', isSuperAdmin, handler);
```

**Frontend Protection:**
- Conditional rendering based on user role
- Redirect stakeholders from admin pages
- Role checks in hooks (`useUser()`)

## Service Layer

### Background Scheduler

**Purpose:** Send automated reminders (WhatsApp/Email)

**Implementation:**
- Polls `reminder_queue` table every minute
- Checks for due reminders (1 week / 1 day before event at 8 AM GST)
- Sends via WhatsApp and/or Email
- Updates reminder status
- Retry logic on failures

**Code location:** `server/services/scheduler.ts`

### WhatsApp Service

**Integration:** Baileys (WhatsApp Web API) - runs as isolated microservice

**Features:**
- QR code authentication via admin UI
- Session persistence in `auth_info/` directory
- Message queuing and retry logic
- Connection monitoring with health checks
- Reset/logout functionality
- Bilingual message templates (EN/AR)

**Architecture:**
- Runs as separate Docker container (`whatsapp-service`)
- Communicates with main server via HTTP
- Session data persisted via Docker volumes

**Code location:** `whatsapp-service/src/` (microservice) and `server/whatsapp-client.ts` (HTTP client)

### Email Service

**Providers:**
1. **Resend** (recommended) - Modern API, better deliverability
2. **Nodemailer** (SMTP) - Fallback for custom mail servers

**Features:**
- Template system with variable replacement
- CC list support
- HTML email formatting
- Stakeholder-specific customization

**Code location:** `server/services/email.ts`

## Elasticsearch Architecture

EventVue uses Elasticsearch 8.12.0 for advanced full-text search, analytics, and autocomplete functionality.

### Overview

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
│  ┌─────────────┐    │   │ ...12 more indices      │   │   │
│  │   Sync      │    │   └─────────────────────────┘   │   │
│  │   Layer     │    │                                 │   │
│  └─────────────┘    └─────────────────────────────────┘   │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **ES Client** | Connection management | `server/elasticsearch/client.ts` |
| **Index Service** | Index CRUD operations | `server/services/elasticsearch-index.service.ts` |
| **Search Service** | Query execution | `server/services/elasticsearch-search.service.ts` |
| **Suggest Service** | Autocomplete | `server/services/elasticsearch-suggest.service.ts` |
| **Analytics Service** | Aggregations | `server/services/elasticsearch-analytics.service.ts` |
| **Sync Service** | PostgreSQL → ES sync | `server/services/elasticsearch-sync.service.ts` |
| **Kibana** | Visualization | https://kibana.eventcal.app |

### Index Structure

**15 Domain Indices:**
- `eventcal-events-{env}` - Calendar events
- `eventcal-tasks-{env}` - Task assignments
- `eventcal-contacts-{env}` - Speakers, attendees
- `eventcal-partnerships-{env}` - Partnership records
- `eventcal-leads-{env}` - Sales leads
- `eventcal-departments-{env}` - Organizations
- `eventcal-users-{env}` - User accounts
- `eventcal-archives-{env}` - Archived events
- Plus 7 more specialized indices

### Bilingual Analyzers

Custom analyzers handle English and Arabic text:

```json
{
  "eventcal_english": {
    "tokenizer": "standard",
    "filter": ["lowercase", "asciifolding", "english_stemmer", "english_stop"]
  },
  "eventcal_arabic": {
    "tokenizer": "icu_tokenizer",
    "filter": ["icu_normalizer", "icu_folding", "arabic_normalization", "arabic_stemmer"]
  }
}
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/search` | POST | Full-text search |
| `/api/search/events` | GET | Event search with filters |
| `/api/suggest` | GET | Search suggestions |
| `/api/autocomplete/:entity` | GET | Entity autocomplete |
| `/api/search/analytics/*` | GET | Dashboard analytics |
| `/api/search/health` | GET | Health check |

### Subdomain Architecture

Production uses dedicated subdomains:

| Subdomain | Service |
|-----------|---------|
| `eventcal.app` | Main application |
| `auth.eventcal.app` | Keycloak SSO |
| `kibana.eventcal.app` | ES visualization |
| `storage.eventcal.app` | MinIO (S3) |

### Data Flow

1. **Write Path:** PostgreSQL → Sync Service → Elasticsearch
2. **Read Path:** API → Search Service → Elasticsearch → Response
3. **Analytics:** API → Analytics Service → Aggregations → Dashboard

### Related Documentation

- [ELASTICSEARCH_ARCHITECTURE.md](./ELASTICSEARCH_ARCHITECTURE.md) - Detailed ES architecture
- [ELASTICSEARCH_API.md](./ELASTICSEARCH_API.md) - API reference
- [ELASTICSEARCH_QUERIES.md](./ELASTICSEARCH_QUERIES.md) - Query examples
- [ELASTICSEARCH_MAINTENANCE.md](./ELASTICSEARCH_MAINTENANCE.md) - Operations guide

## Frontend Architecture

### Component Organization

```
client/src/
├── components/
│   ├── ui/              # shadcn/ui base components
│   ├── Calendar.tsx     # Feature components
│   └── Sidebar.tsx
├── pages/               # Route components (one per page)
│   ├── Home.tsx
│   ├── Tasks.tsx
│   └── Updates.tsx
├── lib/
│   └── queryClient.ts   # TanStack Query configuration
└── hooks/
    └── use-toast.ts     # Custom hooks
```

### State Management Strategy

**Server State** (TanStack Query):
- API data (events, users, tasks)
- Automatic caching and invalidation
- Background refetching

**UI State** (React useState):
- Form inputs
- Modal open/close
- Filter selections
- UI-only toggles

**No global UI state** (Redux not needed):
- Props drilling avoided with composition
- Context used sparingly (Theme)

### Styling Architecture

**Design Tokens** (in `index.css`):
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  /* ... */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... */
}
```

**Utility Classes:**
- `hover-elevate` - Subtle background elevation on hover
- `active-elevate-2` - Stronger elevation on click
- Semantic colors: `bg-background`, `text-foreground`, `border-border`

**Responsive Design:**
- Mobile-first approach
- Breakpoints: `sm:640px`, `md:768px`, `lg:1024px`, `xl:1280px`

## Build & Deployment

### Development Build

```bash
npm run dev
```

**Process:**
1. TSX runs `server/index.ts` with watch mode
2. Express starts on port 5000
3. Vite middleware serves frontend with HMR
4. Hot reload for both frontend and backend

### Production Build

```bash
npm run build
```

**Process:**
1. Vite builds React app → `dist/public/`
2. Esbuild bundles Express server → `dist/index.js`
3. Express serves static files from `dist/public/`

### Docker Deployment

**Multi-stage build:**

**Stage 1 (builder):**
- Install all dependencies
- Run `npm run build`

**Stage 2 (runtime):**
- Copy only production dependencies
- Copy built artifacts
- Run as non-root user
- Expose port 5000

**Services:**
- `db` - PostgreSQL 16
- `migrate` - Run migrations (one-time)
- `app` - Express application

See `DOCKER.md` for complete details.

## Security Considerations

### Authentication Security
- Passwords hashed with scrypt (32-byte salt, 64-byte hash)
- HTTP-only session cookies
- CSRF protection (same-origin policy)
- Session stored in PostgreSQL (not memory)

### Authorization Security
- All admin routes protected with middleware
- Role checks on both frontend and backend
- Stakeholders can only access their assigned data

### Input Validation
- Zod schemas validate all user input
- Same schemas used on frontend and backend
- SQL injection prevented by Drizzle parameterized queries

### Environment Security
- Secrets in `.env` (never committed)
- Docker secrets via environment variables
- SESSION_SECRET required for production

### File Upload Security
- File type validation
- Size limits (10MB)
- Stored outside web root
- Served via API endpoint (not direct access)

## Performance Optimizations

### Frontend
- Code splitting by route (Vite automatic)
- TanStack Query caching reduces API calls
- Optimistic updates for better UX
- Image lazy loading

### Backend
- Database connection pooling (Neon serverless or pg pool)
- Indexed foreign keys
- Pagination for large lists
- Efficient queries via Drizzle ORM

### Database
- Indexes on frequently queried columns
- Foreign key constraints for referential integrity
- Session cleanup (automatic via connect-pg-simple)

## Testing Strategy

### Manual Testing
- Playwright for E2E tests (when applicable)
- Test critical flows (login, event CRUD, task updates)
- Responsive testing on multiple viewports

### Type Safety
- TypeScript strict mode
- Zod runtime validation
- Drizzle type inference

## Monitoring & Debugging

### Logs
- Console logs in development
- Docker logs in production
- Structured logging for services (scheduler, WhatsApp, email)

### Health Checks
- `/api/health` endpoint (basic)
- Docker health checks for app and database

### Error Handling
- Try-catch in async routes
- Zod validation errors with friendly messages
- Frontend error boundaries (React)

## Scalability Considerations

### Current Architecture
- Single server (Express)
- Single database (PostgreSQL)
- Suitable for thousands of events/users

### Future Scaling Options
1. **Horizontal scaling:**
   - Multiple app containers behind load balancer
   - Shared PostgreSQL instance
   - Redis for session store

2. **Database scaling:**
   - Read replicas for queries
   - Write to primary
   - Connection pooling (PgBouncer)

3. **Service isolation:**
   - Separate scheduler service
   - Queue system for emails/WhatsApp (Bull/BullMQ)
   - Microservices for heavy operations

## Design Decisions

### Why Drizzle ORM?
- Type-safe without code generation
- SQL-like syntax (easier to understand)
- Lightweight (~10KB runtime)
- Great TypeScript integration

### Why TanStack Query?
- Industry standard for server state
- Built-in caching and invalidation
- Optimistic updates
- Better than Redux for API data

### Why Wouter over React Router?
- Tiny bundle size (~1KB vs ~15KB)
- All features we need
- Simple API
- Better performance

### Why Express over Next.js?
- Full control over backend
- Easier to integrate WhatsApp/Email services
- No vendor lock-in
- Better for API-first architecture

### Why shadcn/ui over MUI?
- Full ownership of components (copy-paste)
- Tailwind-first styling
- Better customization
- Smaller bundle size
- Radix UI accessibility

## Migration Guide

### Adding New Features

1. **Database changes:** Edit `shared/schema.ts`, run `npm run db:push`
2. **Repository methods:** Add to appropriate `server/repositories/*-repository.ts`
3. **Storage facade:** Expose in `server/repositories/index.ts`
4. **API endpoints:** Add to appropriate `server/routes/*.routes.ts`
5. **Mount routes:** Export from `server/routes/index.ts` and mount in `server/routes.ts`
6. **Frontend pages:** Add to `client/src/pages/`, register in App.tsx
7. **Documentation:** Update relevant docs in `docs/` folder

### Upgrading Dependencies

**Major version updates:**
1. Check breaking changes in changelog
2. Update types if needed
3. Test critical flows
4. Update documentation if API changes

**Keep updated:**
- React, TanStack Query, Drizzle (active development)
- Security packages (passport, express-session)
- Database drivers

## Troubleshooting

### Common Issues

**Database connection errors:**
- Check `DATABASE_URL` format
- Verify PostgreSQL is running
- Check network access (Docker network)

**Build errors:**
- Run `npm run check` for TypeScript errors
- Clear `dist/` and `.vite/` folders
- Reinstall node_modules

**Authentication issues:**
- Verify `SESSION_SECRET` is set
- Check session table in database
- Clear browser cookies

**WhatsApp not connecting:**
- Delete session files in `whatsapp-service/auth_info/` and re-authenticate
- Check WhatsApp service logs: `docker logs ecssr-whatsapp-service`
- Verify network access and `WHATSAPP_SERVICE_URL` environment variable

See `docs/AI_AGENT_GUIDE.md` for more troubleshooting tips.
