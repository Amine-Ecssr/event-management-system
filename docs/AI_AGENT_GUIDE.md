# AI Agent Guide - ECSSR Events Calendar

## 🤖 CRITICAL: Documentation Priority

**All AI agents working on this project MUST:**
1. **Read this folder first** - The `docs/` directory contains authoritative documentation
2. **Update documentation** - Keep docs synchronized with code changes
3. **Check Git history** - Review commit messages and changes before making modifications
4. **Consult existing docs** - Before asking questions, check if the answer exists in:
   - `docs/ARCHITECTURE.md` - Technical architecture and design decisions
   - `docs/SETUP.md` - Environment setup and configuration
   - `docs/DEPENDENCIES.md` - Package dependencies and Replit alternatives
   - `docs/GIT_WORKFLOW.md` - Version control guidelines
   - `DOCKER.md` - Docker deployment instructions
   - `replit.md` - Project overview and recent changes

## Project Overview

**EventVue (ECSSR Annual Events Calendar)** is a full-stack event management system with microservices architecture:
- Event calendar with multiple views (monthly, quarterly, bi-annually, yearly)
- Task management with stakeholder assignments
- Automated reminders (WhatsApp & Email)
- Weekly/monthly organizational updates
- Role-based access control (Superadmin, Admin, Department, Department Admin)
- SSO Integration with Keycloak (LDAP support)

## Technology Stack

### Frontend
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite 5
- **Routing:** Wouter
- **State Management:** TanStack Query v5
- **UI Components:** shadcn/ui + Radix UI
- **Styling:** Tailwind CSS 3
- **Forms:** React Hook Form + Zod validation

### Backend
- **Runtime:** Node.js 20
- **Framework:** Express.js + TypeScript
- **Database:** PostgreSQL 16
- **ORM:** Drizzle ORM
- **Authentication:** Keycloak (SSO) + Passport.js (local)
- **Session:** Express-session with PostgreSQL store

### Key Libraries
- **Email:** Resend or Nodemailer (SMTP)
- **WhatsApp:** Baileys (WhatsApp Web API)
- **CSV:** PapaParse
- **Date Handling:** date-fns
- **Rich Text:** ReactQuill
- **Storage:** MinIO (S3-compatible)

## Three Deployment Environments

This project supports three distinct deployment configurations.

### 1. Development Environment
**File:** `docker-compose.dev.yml` | **Env:** `.env.development` (+ `.env.development.local` for secrets)

```bash
npm run docker:dev        # Start (uses .env.development)
npm run docker:dev:build  # Rebuild and start
npm run docker:dev:down   # Stop
npm run dev               # Run locally without Docker
```

### 2. Production Environment (Single Server)
**File:** `docker-compose.yml` | **Env:** `.env.production`

```bash
npm run docker:prod       # Start
npm run docker:prod:build # Rebuild and start
npm run docker:prod:down  # Stop
```

### 3. Core + Edge Environment (Enterprise Multi-VM)
**Files:** `docker-compose.core.yml` + `docker-compose.edge.yml`

- **Core VM (Isolated):** reverse-proxy, db, keycloak, server, client, minio
- **Edge VM (Internet-Facing):** whatsapp-service, scraper-service

## File Structure

```
.
├── client/               # Frontend React application
│   └── src/
│       ├── components/   # React components (UI components in ui/)
│       ├── pages/        # Page components (routes)
│       ├── lib/          # Utilities and configurations
│       ├── hooks/        # Custom React hooks
│       └── contexts/     # React contexts
├── server/               # Backend Express application
│   ├── index.ts          # Main server entry point
│   ├── routes.ts         # Central router (mounts all route modules)
│   ├── routes/           # Modular route handlers by domain
│   │   ├── index.ts      # Barrel file exporting all routes
│   │   ├── utils.ts      # Shared middleware and helpers
│   │   ├── event.routes.ts
│   │   ├── task.routes.ts
│   │   └── ...           # Other domain routes
│   ├── storage.ts        # Storage facade (backward compatibility)
│   ├── repositories/     # Domain-specific data access
│   │   ├── index.ts      # Storage class composing all repos
│   │   ├── base.ts       # Base repository class
│   │   ├── event-repository.ts
│   │   └── ...           # Other domain repositories
│   ├── services/         # Business logic services
│   └── templates/        # Email templates
├── shared/               # Shared code between frontend and backend
│   └── schema.ts         # Database schema and Zod validators (SOURCE OF TRUTH)
├── migrations/           # Database migration files
├── uploads/              # File uploads (not in Git/Docker image)
├── whatsapp-service/     # WhatsApp microservice (Baileys)
├── scraper-service/      # Web scraping microservice
├── docs/                 # **THIS FOLDER - Critical documentation**
├── Dockerfile            # Production Docker build
├── docker-compose.yml    # Production Docker orchestration
├── docker-compose.dev.yml    # Development environment
├── docker-compose.core.yml   # Core VM (enterprise)
├── docker-compose.edge.yml   # Edge VM (enterprise)
└── package.json          # NPM dependencies and scripts
```

## Development Guidelines

### 1. Code Modifications

**Before making changes:**
- Read the relevant documentation in `docs/`
- Check Git history for context: `git log --oneline -- <file>`
- Review the architecture decisions in `docs/ARCHITECTURE.md`

**When making changes:**
- Follow existing patterns and conventions
- Update documentation if architecture/API changes
- Add TypeScript types (never use `any` without justification)
- Use Zod schemas for validation (shared between frontend/backend)
- Add data-testid attributes to interactive elements

**After making changes:**
- Test locally or with Docker
- Update `replit.md` Recent Changes section with date and description
- Update relevant docs in `docs/` folder if needed
- Commit with descriptive message (see `docs/GIT_WORKFLOW.md`)

### 2. Database Changes

**Schema modifications:**
1. Edit `shared/schema.ts` (source of truth)
2. Run `npm run db:push` to apply changes
3. Update related Zod schemas and types
4. Update API routes and frontend queries

### 3. API Development

**Adding new endpoints:**
1. Define Zod schemas in `shared/schema.ts`
2. Add repository methods in appropriate `server/repositories/*-repository.ts`
3. Expose via `server/repositories/index.ts` (Storage class)
4. Create or update route module in `server/routes/[domain].routes.ts`
5. Export route from `server/routes/index.ts` and mount in `server/routes.ts`
6. Add frontend query/mutation using TanStack Query

**Pattern to follow:**
```typescript
// server/routes/resource.routes.ts
import { Router } from "express";
import { storage } from "../repositories";
import { isAuthenticated, isAdminOrSuperAdmin } from "../auth";
import { insertResourceSchema } from "@shared/schema.mssql";

const router = Router();

router.post('/api/resource', isAdminOrSuperAdmin, async (req, res) => {
  const data = insertResourceSchema.parse(req.body);
  const result = await storage.createResource(data);
  res.json(result);
});

export default router;

// client/src/pages/Resource.tsx
const mutation = useMutation({
  mutationFn: (data) => apiRequest('POST', '/api/resource', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/resource'] });
  },
});
```

### 4. Frontend Development

**Component guidelines:**
- Use shadcn/ui components from `@/components/ui/*`
- Apply `data-testid` attributes for testing
- Use TanStack Query for data fetching (no manual fetch)
- Handle loading/error states
- Implement proper TypeScript types

**Form handling:**
```typescript
const form = useForm({
  resolver: zodResolver(insertSchema),
  defaultValues: { /* ... */ },
});
```

### 5. Styling

**Tailwind CSS conventions:**
- Use semantic color tokens (e.g., `bg-background`, `text-foreground`)
- Follow mobile-first responsive design
- Use `hover-elevate` and `active-elevate-2` for interactions
- Never override Button/Badge hover states manually

### 6. Authentication & Authorization

**Role hierarchy:**
- **Superadmin:** Full system access (cannot be deleted)
- **Admin:** Event/task management, stakeholder assignments
- **Stakeholder:** View assigned events, update tasks, add comments

**Middleware:**
- `isAuthenticated` - Requires any logged-in user
- `isAdminOrSuperAdmin` - Requires admin or superadmin role
- `isSuperAdmin` - Requires superadmin role only

## Common Tasks

### Adding a new page

1. Create page component in `client/src/pages/NewPage.tsx`
2. Add route in `client/src/App.tsx`:
   ```tsx
   <Route path="/new-page" component={NewPage} />
   ```
3. Add navigation link in sidebar if needed

### Adding a database table

1. Define table in `shared/schema.ts`:
   ```typescript
   export const newTable = pgTable('new_table', {
     id: serial('id').primaryKey(),
     name: text('name').notNull(),
   });
   
   export const insertNewTableSchema = createInsertSchema(newTable);
   export type InsertNewTable = z.infer<typeof insertNewTableSchema>;
   export type NewTable = typeof newTable.$inferSelect;
   ```

2. Create repository in `server/repositories/newtable-repository.ts`
3. Add to Storage class in `server/repositories/index.ts`
4. Push schema: `npm run db:push`
5. Add route module in `server/routes/newtable.routes.ts`
6. Mount route in `server/routes.ts`
7. Add frontend queries

### Debugging

**Check logs:**
```bash
# Application logs
docker-compose logs -f app

# Database logs
docker-compose logs -f db

# All logs
docker-compose logs -f
```

**Common issues:**
- Database connection: Check `DATABASE_URL` in `.env`
- Session errors: Verify `SESSION_SECRET` is set
- Build errors: Check for TypeScript errors with `npm run check`

## Testing

### Playwright End-to-End Testing (PREFERRED METHOD)

⚠️ **CRITICAL: Always use Playwright for testing whenever possible!**

**Testing Environment:**
- **Docker Compose file:** `docker-compose.dev.yml`
- **Environment file:** `.env.development`
- **Application URL:** `http://localhost:5050`
- (Frontend and Backend API both served from same port)

**Setup and Execution:**
```bash
# 1. Start development environment
npm run docker:dev:build    # Build and start (first time or after changes)
npm run docker:dev          # Start existing containers

# 2. Verify services are running
docker compose -f docker-compose.dev.yml ps

# 3. Run Playwright tests using available tools:
# - browser_navigate: Navigate to URLs
# - browser_click: Click elements
# - browser_type: Type text into inputs
# - browser_wait_for: Wait for content
# - browser_evaluate: Run JavaScript
# - browser_screenshot: Capture screenshots
# - browser_accessibility_snapshot: Check accessibility
```

**Critical User Flows to Test:**

1. **Authentication Flow:**
   ```typescript
   // Navigate to login
   await browser_navigate({ url: 'http://localhost:5050/login' });
   
   // Enter credentials
   await browser_type({ element: 'Username', ref: 'input[name="username"]', text: 'testuser' });
   await browser_type({ element: 'Password', ref: 'input[name="password"]', text: 'password' });
   
   // Submit and verify
   await browser_click({ element: 'Login button', ref: 'button[type="submit"]' });
   await browser_wait_for({ text: 'Welcome' });
   ```

2. **Event Management:**
   - Create new event
   - Edit existing event
   - Delete event
   - Upload event media
   - Verify event appears in calendar views

3. **Task Management:**
   - Create task for event
   - Assign stakeholders
   - Update task status
   - Add comments
   - Verify notifications sent

4. **Role-Based Access:**
   - Test as Superadmin (full access)
   - Test as Admin (event/task management)
   - Test as Department Admin (department scope)
   - Test as Stakeholder (view only, task updates)

5. **Updates Feature:**
   - Create weekly/monthly update
   - Add events to update
   - Publish update
   - Verify email notifications

**Playwright Testing Best Practices:**
- ✅ Always test in development environment (faster iteration, better debugging)
- ✅ Use data-testid attributes for reliable element selection
- ✅ Test error states and edge cases
- ✅ Verify loading states and spinners
- ✅ Check form validation (client-side and server-side)
- ✅ Test responsive design at different viewport sizes
- ✅ Verify accessibility with browser_accessibility_snapshot
- ✅ Capture screenshots for visual regression testing
- ✅ Test with realistic data volumes
- ✅ Verify API responses and error handling

**Common Testing Patterns:**

```typescript
// Wait for API response after action
await browser_click({ element: 'Save button', ref: 'button[type="submit"]' });
await browser_wait_for({ text: 'Saved successfully' });

// Check for error messages
await browser_type({ element: 'Email input', ref: 'input[type="email"]', text: 'invalid' });
await browser_click({ element: 'Submit', ref: 'button[type="submit"]' });
await browser_wait_for({ text: 'Invalid email' });

// Test navigation
await browser_click({ element: 'Events link', ref: 'a[href="/events"]' });
await browser_wait_for({ text: 'Events Calendar' });

// Verify form submission
const formData = { title: 'Test Event', date: '2025-12-25' };
await browser_type({ element: 'Title', ref: 'input[name="title"]', text: formData.title });
await browser_click({ element: 'Create', ref: 'button[type="submit"]' });
await browser_wait_for({ text: 'Event created' });
```

**Testing Checklist:**
- [ ] Authentication (login/logout, session persistence)
- [ ] Event CRUD operations (create, read, update, delete)
- [ ] Task management (create, assign, update, complete)
- [ ] Media upload and management
- [ ] Partnerships management
- [ ] Leads management
- [ ] Updates publishing (weekly/monthly)
- [ ] Role-based access control
- [ ] Form validation (all forms)
- [ ] Error handling and messages
- [ ] Loading states and spinners
- [ ] Responsive design (mobile/tablet/desktop)
- [ ] Internationalization (English/Arabic)
- [ ] WhatsApp/Email notifications (check logs)
- [ ] Calendar views (monthly, quarterly, yearly)
- [ ] Search and filtering
- [ ] Bulk operations
- [ ] Export functionality

### Manual Testing (When Playwright Not Available)

**Only use manual testing when Playwright tools are unavailable.**

- [ ] Login/logout functionality
- [ ] Event CRUD operations
- [ ] Task assignment and updates
- [ ] WhatsApp/Email notifications
- [ ] Updates (weekly/monthly) creation and viewing
- [ ] Responsive design on different screen sizes

## Deployment

### Docker Deployment (Recommended)

See `DOCKER.md` for comprehensive instructions.

**Quick start:**
```bash
cp .env.example .env
# Edit .env with configuration
docker-compose up -d
```

### Environment Variables

See `docs/SETUP.md` for complete list.

**Critical variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `SUPERADMIN_USERNAME` - Initial admin username
- `SUPERADMIN_PASSWORD` - Initial admin password

## Replit Independence

**This project does NOT depend on Replit infrastructure.**

The application uses a few Replit development plugins (cartographer, dev-banner, runtime-error-modal) that:
- Only load when `REPL_ID` environment variable exists
- Only run in development mode
- Are completely optional and enhance DX in Replit
- Do not affect production builds or non-Replit environments

**To run outside Replit:**
1. Use Docker (recommended) - see `DOCKER.md`
2. Or install Node.js 20+ and PostgreSQL locally - see `docs/SETUP.md`
3. No Replit-specific configuration needed

See `docs/DEPENDENCIES.md` for details on all dependencies.

## Git Workflow

See `docs/GIT_WORKFLOW.md` for complete guidelines.

**Quick reference:**
```bash
# Check status
git status

# Stage and commit
git add .
git commit -m "feat: description of changes"

# View history
git log --oneline
git log --oneline -- path/to/file
```

## Documentation Updates

**When to update documentation:**

1. **Architecture changes** → Update `docs/ARCHITECTURE.md`
2. **New dependencies** → Update `docs/DEPENDENCIES.md`
3. **Setup changes** → Update `docs/SETUP.md`
4. **Git workflow changes** → Update `docs/GIT_WORKFLOW.md`
5. **Recent features** → Update `replit.md` (Recent Changes section)
6. **Docker changes** → Update `DOCKER.md`

## Support & Resources

**Documentation files (in order of importance):**
1. `docs/AI_AGENT_GUIDE.md` (this file) - Start here
2. `docs/ARCHITECTURE.md` - Technical deep dive
3. `docs/SETUP.md` - Environment setup
4. `docs/DEPENDENCIES.md` - Package information
5. `docs/GIT_WORKFLOW.md` - Version control
6. `DOCKER.md` - Docker deployment
7. `replit.md` - Project overview and recent changes

**External documentation:**
- React: https://react.dev/
- TanStack Query: https://tanstack.com/query/latest
- Drizzle ORM: https://orm.drizzle.team/
- shadcn/ui: https://ui.shadcn.com/
- Express: https://expressjs.com/

## Remember

1. ✅ **Documentation is critical** - Keep it updated
2. ✅ **Git history matters** - Read it before making changes
3. ✅ **This folder first** - Check `docs/` before asking questions
4. ✅ **Replit-independent** - Project works anywhere
5. ✅ **Types are required** - Use TypeScript properly
6. ✅ **Test your changes** - **Use Playwright whenever possible** in dev mode (`docker-compose.dev.yml` + `.env.development`)
7. ✅ **Follow conventions** - Match existing code patterns
8. ✅ **Playwright first** - Always prefer automated E2E testing over manual testing
