# GitHub Copilot Instructions for EventVue (ECSSR Events Calendar)

## Project Overview
EventVue is a full-stack event management system with microservices architecture. It manages events, tasks, departments, partnerships, leads, and contacts with role-based access control and automated notifications.

## Architecture Overview
- **Frontend:** React 18 + TypeScript + Vite, TanStack Query for state, shadcn/ui components
- **Backend:** Express + TypeScript, PostgreSQL with Drizzle ORM, repository pattern
- **Services:** Elasticsearch for search, Keycloak for SSO, WhatsApp/Baileys for messaging
- **Pattern:** Routes → Storage (repository facade) → PostgreSQL; all data access through repositories

## Critical Workflows

### Development Setup
```bash
npm run docker:dev:build    # Start dev environment (port 5050)
npm run docker:dev          # Quick start without rebuild
npm run dev                 # Local development (port 5000)
```

### Database Changes
1. Edit `shared/schema.ts` (single source of truth)
2. Run `npm run db:push` to apply schema changes
3. Update Zod schemas and TypeScript types automatically inferred

### Testing (Playwright Preferred)
```bash
# Start dev environment first
npm run docker:dev:build

# Use Playwright browser tools for E2E testing:
# - Navigate to http://localhost:5050/login
# - Type credentials, click login
# - Verify dashboard loads
```

## Key Patterns & Conventions

### Repository Pattern (MANDATORY)
```typescript
// ❌ BAD - Direct database access
const events = await db.query.events.findMany();

// ✅ GOOD - Use repository via storage facade
const events = await storage.getAllEvents();
```

### TanStack Query for Data Fetching
```typescript
// Frontend data fetching pattern
const { data, isLoading, error } = useQuery({
  queryKey: ['/api/events'],  // URL as query key
});

// Mutations with cache invalidation
const mutation = useMutation({
  mutationFn: (data) => apiRequest('POST', '/api/events', data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/events'] }),
});
```

### Zod Validation (Single Source of Truth)
```typescript
// Define in shared/schema.ts
export const events = pgTable('events', {
  id: varchar('id').primaryKey(),
  name: text('name').notNull(),
  nameAr: text('name_ar').notNull(),  // Bilingual support
});

// Auto-generated Zod schema
export const insertEventSchema = createInsertSchema(events).omit({ id: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
```

### Authentication Middleware
```typescript
// Three protection levels
router.get('/api/profile', isAuthenticated, handler);           // Any logged-in user
router.post('/api/events', isAdminOrSuperAdmin, handler);       // Admin roles only
router.delete('/api/users/:id', isSuperAdmin, handler);         // Superadmin only
```

### Bilingual Support
All user-facing content requires EN/AR fields:
```typescript
// Database schema
nameEn: text('name_en').notNull(),
nameAr: text('name_ar').notNull(),

// Frontend rendering
const name = i18n.language === 'ar' ? item.nameAr : item.nameEn;
```

### Modular Route Organization
Add to existing domain-specific route files (18+ modules):
```
server/routes/
├── event.routes.ts        # Event CRUD operations
├── task.routes.ts         # Task management
├── search.routes.ts       # Elasticsearch queries
├── ai.routes.ts           # AI chat/intake endpoints
```

## Integration Points

### Elasticsearch Search
```typescript
// Use search service, never direct ES client
import { searchService } from '../services/elasticsearch-search.service';
const results = await searchService.search('events', query, filters);
```

### AI Features
```typescript
// Use AI orchestrator for chat/intake
import { aiOrchestrator } from '../ai/orchestrator';
const response = await aiOrchestrator.chat(userQuery, conversationId);
```

### WhatsApp Service
Microservice using Baileys library for automated messaging.

## Development Best Practices

- **Read docs/ first** - Authoritative documentation in docs/ folder
- **Check Git history** - `git log --oneline -- path/to/file` for context
- **TypeScript strict** - No `any` types, full type safety
- **ESM modules** - No CommonJS, modern import/export
- **Conventional commits** - `feat(scope): description`, `fix(scope): description`
- **Playwright E2E first** - Prefer automated testing over manual
- **Never commit secrets** - Use `.env.*.local` files for local secrets

## Common Tasks

### Adding API Endpoint
1. Define schema in `shared/schema.ts`
2. Add repository method in `server/repositories/[domain]-repository.ts`
3. Expose via Storage class in `server/repositories/index.ts`
4. Create/update route in `server/routes/[domain].routes.ts`
5. Add frontend TanStack Query in component

### Adding Database Table
1. Add to `shared/schema.ts`
2. Run `npm run db:push`
3. Create repository class extending BaseRepository
4. Add to Storage facade

## File References
- `shared/schema.ts` - Database schema + Zod validators (source of truth)
- `server/repositories/index.ts` - Storage facade for all data access
- `docs/ARCHITECTURE.md` - Technical architecture details
- `docs/AI_AGENT_GUIDE.md` - Development guidelines
- `CLAUDE.md` - Comprehensive AI assistant guide</content>
<parameter name="filePath">.github/copilot-instructions.md