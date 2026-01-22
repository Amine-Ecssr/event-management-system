# Routes Directory

This directory contains modular route handlers for the EventVue API. Routes are organized by domain and follow a consistent naming convention.

## Naming Convention

All route files follow **kebab-case** naming with a `.routes.ts` suffix:

```
[domain].routes.ts
```

Examples:
- `health.routes.ts` - Health check and dashboard endpoints
- `category.routes.ts` - Event category management
- `event-files.routes.ts` - Event file/folder management
- `stakeholder.routes.ts` - Stakeholder/department management

## Directory Structure

```
server/routes/\n├── index.ts                 # Barrel file - exports all route modules\n├── utils.ts                 # Shared middleware, helpers, and types\n├── README.md                # This file\n│\n├── health.routes.ts         # Health checks, dashboard stats\n├── category.routes.ts       # Event category CRUD\n├── event.routes.ts          # Event CRUD operations\n├── event-files.routes.ts    # Event files and folders\n├── organization.routes.ts   # Organizations, positions, contacts\n├── stakeholder.routes.ts    # Stakeholder/department management\n├── task.routes.ts           # Task management and workflows\n├── archive.routes.ts        # Archived events\n├── settings.routes.ts       # Application settings\n├── admin.routes.ts          # Admin user management, Keycloak sync\n├── partnership.routes.ts    # Partner management\n├── lead.routes.ts           # Lead tracking\n├── integration.routes.ts    # External integrations (scraper, reminders, updates)\n└── invitation.routes.ts     # Attendees, invitees, invitation emails\n```

## Route Module Pattern

Each route module follows this pattern:

```typescript
/**
 * [Domain] Routes
 *
 * API endpoints description...
 *
 * @module routes/[domain]
 */

import { Router } from "express";
import { storage } from "../repositories";
// Other imports...

const router = Router();

// Route definitions
router.get("/api/example", async (req, res) => {
  // Implementation
});

export default router;
```

## Shared Utilities (`utils.ts`)

Common middleware and helpers used across route modules:

### Role Checks
- `isDepartmentScopedRole(role)` - Check if role is department or department_admin
- `isDepartmentOrStakeholderRole(role)` - Check if role is department-scoped or stakeholder
- `isAdminRole(role)` - Check if role is admin or superadmin

### Middleware
- `canManageAttendees` - Check if user can manage event attendees

### Helper Functions
- `parseBooleanField(value, default)` - Parse boolean from form data
- `normalizeOptionalString(value)` - Convert empty strings to undefined
- `normalizeEventPayload(data, files, defaults)` - Normalize event creation/update data
- `cleanupAgendaFiles(files)` - Delete uploaded agenda files
- `generateReminderSchedule(event)` - Generate reminder schedule for event
- `resolveRange(date, range)` - Resolve date range for updates
- `getDepartmentEmails(departmentId)` - Get all emails for a department
- `ensureArchiveEnabled(res)` - Check if archive feature is enabled

### Types
- `AgendaFiles` - Type for agenda file uploads

## Adding New Routes

1. **Identify the domain** - Group related endpoints together
2. **Create the file** - `server/routes/[domain].routes.ts`
3. **Follow the pattern** - Use Router, import from utils
4. **Export from index** - Add to `server/routes/index.ts`
5. **Mount in routes.ts** - Import and use `app.use()`
6. **Add tests** - Create/update E2E tests

### Example: Adding a new route module

```typescript
// server/routes/example.routes.ts
import { Router } from "express";
import { storage } from "../repositories";
import { isAuthenticated, isAdminOrSuperAdmin } from "../auth";

const router = Router();

router.get("/api/examples", async (req, res) => {
  const items = await storage.getExamples();
  res.json(items);
});

router.post("/api/examples", isAdminOrSuperAdmin, async (req, res) => {
  const item = await storage.createExample(req.body);
  res.status(201).json(item);
});

export default router;
```

Then in `server/routes/index.ts`:
```typescript
export { default as exampleRoutes } from './example.routes';
```

And in `server/routes.ts`:
```typescript
import exampleRoutes from './routes/example.routes';
// ...
app.use(exampleRoutes);
```

## Current Route Modules

| Module | Description | Endpoints |
|--------|-------------|-----------|
| `health.routes.ts` | System health and dashboard | `/api/health`, `/api/dashboard/stats` |
| `category.routes.ts` | Event categories | `/api/categories/*` |
| `event.routes.ts` | Event CRUD operations | `/api/events/*` |
| `event-files.routes.ts` | File/folder management | `/api/events/:id/folders/*`, `/api/files/*` |
| `task.routes.ts` | Task management and workflows | `/api/events/:id/tasks/*`, `/api/tasks/*` |
| `stakeholder.routes.ts` | Stakeholder/department management | `/api/stakeholders/*` |
| `organization.routes.ts` | Organizations, positions, contacts | `/api/organizations/*`, `/api/contacts/*` |
| `partnership.routes.ts` | Partnership management | `/api/partnerships/*` |
| `lead.routes.ts` | Lead tracking | `/api/leads/*` |
| `invitation.routes.ts` | Attendees, invitees, emails | `/api/events/:id/attendees/*`, `/api/invitees/*` |
| `archive.routes.ts` | Archived events | `/api/archives/*` |
| `settings.routes.ts` | Application settings | `/api/settings/*` |
| `admin.routes.ts` | Admin user management, Keycloak sync | `/api/users/*`, `/api/keycloak/*` |
| `integration.routes.ts` | Scraper, reminders, updates | `/api/scraper/*`, `/api/reminders/*`, `/api/updates/*` |

## Migration Status

✅ **Migration Complete!** All routes have been extracted from the monolithic `routes.ts` to modular route files.

The main `server/routes.ts` now serves as a central router that mounts all route modules:

```typescript
import eventRoutes from "./routes/event.routes";
import taskRoutes from "./routes/task.routes";
// ... other imports

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);
  app.use(eventRoutes);
  app.use(taskRoutes);
  // ... other routes
}
```

## Testing

Each route module should have corresponding E2E tests in `server/__tests__/`:

```bash
# Run all E2E tests
npm run test:e2e

# Run specific module tests
npm test -- categories.e2e.test.ts
```

## Best Practices

1. **Use shared utilities** - Don't duplicate middleware or helpers
2. **Keep modules focused** - One domain per file
3. **Document routes** - Add JSDoc comments for each endpoint
4. **Handle errors consistently** - Use try/catch with appropriate status codes
5. **Validate input** - Use Zod schemas for request validation
6. **Test thoroughly** - Create E2E tests for all endpoints
