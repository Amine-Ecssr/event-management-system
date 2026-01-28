# Routes.ts Refactoring Implementation Plan

## Overview

This document provides a step-by-step implementation plan for breaking down the monolithic `server/routes.ts` file (9,060 lines, 280 routes) into smaller, maintainable route modules **with comprehensive E2E testing**.

## Current State

- **File**: `server/routes.ts`
- **Lines of code**: 9,060
- **Number of routes**: 280
- **Problem**: Single massive file mixing multiple domains (events, partnerships, tasks, contacts, admin operations, etc.)
- **Existing pattern**: `server/eventFileRoutes.ts` already follows the Router pattern we want to adopt
- **Testing**: Existing E2E tests in `server/__tests__/` with mocked storage

## Target State

Break down into 17 focused route modules organized in `server/routes/` directory with comprehensive E2E test coverage:

### Core Domain Routes
1. `eventRoutes.ts` - Event CRUD operations (~800 lines)
2. `taskRoutes.ts` - Task management and comments (~600 lines)
3. `stakeholderRoutes.ts` - Stakeholder/department management (~500 lines)
4. `organizationRoutes.ts` - Organization/contact management (~600 lines)

### Feature Domain Routes
5. `partnershipRoutes.ts` - Partnership management (~1500 lines)
6. `leadRoutes.ts` - Lead management (~600 lines)
7. `invitationRoutes.ts` - Event invitations and attendees (~500 lines)
8. `archiveRoutes.ts` - Archive operations (~400 lines)

### Integration Routes
9. `keycloakRoutes.ts` - Keycloak sync operations (~200 lines)
10. `whatsappRoutes.ts` - WhatsApp integration (~150 lines)
11. `scraperRoutes.ts` - Scraper operations (~100 lines)

### System Routes
12. `healthRoutes.ts` - Health checks and dashboard (~50 lines)
13. `settingsRoutes.ts` - Settings and updates (~800 lines)
14. `workflowRoutes.ts` - Workflow management (~200 lines)
15. `reminderRoutes.ts` - Reminder operations (~100 lines)
16. `adminRoutes.ts` - Admin-only operations (~400 lines)
17. `categoryRoutes.ts` - Event category management (~80 lines)

### Shared Utilities
18. `routes/utils.ts` - Shared middleware, helpers, and types

## Implementation Strategy

### Principle: Programmatic Copy/Paste with E2E Testing
- **DO NOT REWRITE** - Copy code blocks directly from routes.ts
- Preserve existing logic, comments, and error handling
- Only modify: import statements and router wrapping
- Zero behavior changes - maintain all existing functionality
- **Create/update E2E tests for each module**
- **Run tests after each extraction to ensure no regressions**

### Pattern to Follow (from eventFileRoutes.ts)

```typescript
import { Router, type RequestHandler } from "express";
import { /* necessary imports */ } from "./module";

const router = Router();

// Copy middleware and helpers here

// Copy route definitions here, changing app.METHOD to router.METHOD
router.get("/api/example", async (req, res) => {
  // existing implementation
});

export default router;
```

## Step-by-Step Implementation

### Phase 1: Setup and Shared Utilities

#### Step 1.1: Create routes directory
```bash
mkdir -p /home/runner/work/eventcal/eventcal/server/routes
```

#### Step 1.2: Extract shared utilities to `routes/utils.ts`

**Lines to extract from routes.ts**:
- Lines 43-106: Helper functions and middleware
  - `isDepartmentScopedRole` (line 43)
  - `isDepartmentOrStakeholderRole` (line 44)
  - `canManageAttendees` (lines 47-86)
  - `AgendaFiles` type (lines 88-92)
  - `parseBooleanField` (lines 94-101)
  - `normalizeOptionalString` (lines 103-106)
  - `normalizeEventPayload` (lines 108-141)
  - `cleanupAgendaFiles` (lines 143-146)
  - `cleanupAgendaFilesByName` (lines 148-150)
  - `generateReminderSchedule` (lines 153-308)
  - `resolveRange` (lines 310-319)

**Create file**: `server/routes/utils.ts`
```typescript
import type { Express, RequestHandler } from "express";
import { storage } from "../storage";
import type { Event } from "@shared/schema.mssql";
import { deleteAgendaFile } from '../fileUpload';

// Copy helper functions and types here
export const isDepartmentScopedRole = (role?: string) => role === 'department' || role === 'department_admin';

export const isDepartmentOrStakeholderRole = (role?: string) => isDepartmentScopedRole(role) || role === 'stakeholder';

// ... copy rest of the utilities
```

#### Step 1.3: Test shared utilities compile
```bash
cd /home/runner/work/eventcal/eventcal
npm run check
```

### Phase 2: Extract Route Modules (One at a Time)

For each module below, follow this process:
1. Create the file in `server/routes/`
2. Copy imports needed for those routes
3. Copy route definitions (change `app.METHOD` to `router.METHOD`)
4. Import and use shared utilities from `./utils`
5. Export default router
6. Update `server/routes.ts` to import and mount the module
7. Test compilation: `npm run check`
8. Commit the change

---

#### Module 1: healthRoutes.ts

**Create**: `server/routes/healthRoutes.ts`

**Lines to copy from routes.ts**:
- Lines 367-369: Health check endpoint
- Lines 372-439: Dashboard stats endpoint

**Route paths**:
- `GET /api/health`
- `GET /api/dashboard/stats`

**Template**:
```typescript
import { Router } from "express";
import { storage } from "../storage";

const router = Router();

// Copy lines 367-369
router.get("/api/health", (req, res) => {
  // ... existing implementation
});

// Copy lines 372-439
router.get("/api/dashboard/stats", async (req, res) => {
  // ... existing implementation
});

export default router;
```

---

#### Module 2: categoryRoutes.ts

**Create**: `server/routes/categoryRoutes.ts`

**Lines to copy from routes.ts**:
- Lines 1196-1273: All category endpoints

**Route paths**:
- `GET /api/categories`
- `GET /api/categories/:id`
- `POST /api/categories`
- `PUT /api/categories/:id`
- `DELETE /api/categories/:id`

**Imports needed**:
```typescript
import { Router } from "express";
import { storage } from "../storage";
import { isAdminOrSuperAdmin } from "../auth";
```

---

#### Module 3: eventRoutes.ts

**Create**: `server/routes/eventRoutes.ts`

**Lines to copy from routes.ts**:
- Lines 442-553: Event listing and detail endpoints (GET /api/events, GET /api/events/:id, GET /api/events/:id/ics, GET /api/events/:id/agenda/:lang)
- Lines 555-902: Event creation endpoint (POST /api/events)
- Lines 904-1161: Event update endpoint (PATCH /api/events/:id)
- Lines 1163-1194: Event deletion endpoints (DELETE /api/events/:id, DELETE /api/events)

**Route paths**:
- `GET /api/events` - Get all events
- `GET /api/events/:id` - Get single event
- `GET /api/events/:id/ics` - Export event as ICS
- `GET /api/events/:id/agenda/:lang` - Download agenda PDF
- `POST /api/events` - Create event
- `PATCH /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event
- `DELETE /api/events` - Delete all events (superadmin)

**Key imports needed**:
```typescript
import { Router } from "express";
import { storage } from "../storage";
import { insertEventSchema, type Event } from "@shared/schema.mssql";
import { fromError } from "zod-validation-error";
import { isAuthenticated, isSuperAdmin, isAdminOrSuperAdmin } from "../auth";
import { emailService } from "../email";
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { minioService } from '../services/minio';
import { eventFileService } from '../services/eventFileService';
import { generateIcsFile } from '../icsGenerator';
import { getAgendaFilePath, deleteAgendaFile } from '../fileUpload';
import { 
  normalizeEventPayload, 
  cleanupAgendaFiles, 
  cleanupAgendaFilesByName,
  generateReminderSchedule,
  AgendaFiles 
} from './utils';
```

**Special notes**:
- Includes multer upload configuration (lines 556-584)
- Includes `getDepartmentEmails` helper function (lines 341-361) - should go in utils or inline
- Contains complex stakeholder assignment logic
- Integrates with WhatsApp, email, and reminder services

---

#### Module 4: organizationRoutes.ts

**Create**: `server/routes/organizationRoutes.ts`

**Lines to copy from routes.ts**:
- Lines 1278-1488: Organizations, positions, partnership types, agreement types, countries, contacts

**Route paths**:
- `GET /api/organizations`
- `GET /api/organizations/:id`
- `POST /api/organizations`
- `PUT /api/organizations/:id`
- `DELETE /api/organizations/:id`
- `GET /api/positions`
- `GET /api/positions/:id`
- `POST /api/positions`
- `PUT /api/positions/:id`
- `DELETE /api/positions/:id`
- `GET /api/partnership-types`
- `GET /api/partnership-types/:id`
- `POST /api/partnership-types`
- `PUT /api/partnership-types/:id`
- `DELETE /api/partnership-types/:id`
- `GET /api/agreement-types`
- `GET /api/agreement-types/:id`
- `POST /api/agreement-types`
- `PUT /api/agreement-types/:id`
- `DELETE /api/agreement-types/:id`
- `GET /api/countries`
- `GET /api/contacts` (and all contact-related routes)
- Plus contact CRUD operations and CSV import/export

---

#### Module 5: stakeholderRoutes.ts

**Create**: `server/routes/stakeholderRoutes.ts`

**Lines to copy from routes.ts**:
- Lines 1900-2290: Stakeholder/department management endpoints

**Route paths**:
- `GET /api/stakeholders`
- `GET /api/stakeholders/:id`
- `POST /api/stakeholders`
- `PUT /api/stakeholders/:id`
- `DELETE /api/stakeholders/:id`
- All stakeholder email and requirement routes
- Department account routes

**Includes**:
- Stakeholder requirements with prerequisites
- Department emails management
- Stakeholder account management

---

#### Module 6: taskRoutes.ts

**Create**: `server/routes/taskRoutes.ts`

**Lines to copy from routes.ts**:
- Lines 2292-2900: Task management endpoints
- Includes event department tasks, task comments, and attachments

**Route paths**:
- `GET /api/tasks/:taskId`
- `POST /api/tasks/:taskId`
- `PUT /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`
- `GET /api/tasks/:taskId/comments`
- `POST /api/tasks/:taskId/comments`
- `DELETE /api/tasks/:taskId/comments/:commentId`
- `GET /api/event-departments/:eventDepartmentId/tasks`
- `POST /api/event-departments/:eventDepartmentId/tasks`
- Task comment attachments routes

---

#### Module 7: workflowRoutes.ts

**Create**: `server/routes/workflowRoutes.ts`

**Lines to copy from routes.ts**:
- Lines 2902-3100: Workflow management endpoints

**Route paths**:
- `GET /api/workflows`
- `GET /api/workflows/:workflowId`
- `PUT /api/workflows/:workflowId`
- `GET /api/my-workflows`
- `GET /api/events/:eventId/workflows`
- `GET /api/departments/:departmentId/workflows`
- Task template routes

---

#### Module 8: archiveRoutes.ts

**Create**: `server/routes/archiveRoutes.ts`

**Lines to copy from routes.ts**:
- Lines 3102-3500: Archive management endpoints

**Route paths**:
- `GET /api/archive`
- `GET /api/archive/:id`
- `POST /api/archive`
- `PUT /api/archive/:id`
- `DELETE /api/archive/:id`
- `POST /api/archive/from-event/:eventId`
- `POST /api/archive/:id/unarchive`
- Archive photo management routes
- Archive speaker routes
- Archive CSV import/export

**Includes**:
- Photo upload/management with MinIO
- Speaker management
- CSV import/export functionality

---

#### Module 9: invitationRoutes.ts

**Create**: `server/routes/invitationRoutes.ts`

**Lines to copy from routes.ts**:
- Lines 3502-4000: Invitation and attendee management

**Route paths**:
- `GET /api/events/:eventId/invitees`
- `POST /api/events/:eventId/invitees`
- `DELETE /api/events/:eventId/invitees/:contactId`
- `POST /api/events/:eventId/invitees/bulk`
- `GET /api/events/:eventId/invitees/download`
- `POST /api/events/:eventId/invitees/upload`
- `GET /api/events/invitees/csv-template`
- `POST /api/events/:eventId/send-invitations`
- `POST /api/events/:eventId/send-test-invitation`
- Attendee management routes
- Custom email routes
- Invitation job routes

---

#### Module 10: settingsRoutes.ts

**Create**: `server/routes/settingsRoutes.ts`

**Lines to copy from routes.ts**:
- Lines 4002-4800: Settings and updates management

**Route paths**:
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/settings/admin`
- `PUT /api/settings/admin`
- Email preview routes
- Email test routes
- Updates routes (`/api/updates`, `/api/updates/:type/:periodStart`, etc.)

---

#### Module 11: reminderRoutes.ts

**Create**: `server/routes/reminderRoutes.ts`

**Lines to copy from routes.ts**:
- Lines 4802-4900: Reminder management endpoints

**Route paths**:
- `GET /api/reminders`
- `GET /api/reminders/:id`
- `POST /api/reminders/:id/resend`

---

#### Module 12: keycloakRoutes.ts

**Create**: `server/routes/keycloakRoutes.ts`

**Lines to copy from routes.ts**:
- Lines 4902-5100: Keycloak sync endpoints

**Route paths**:
- `GET /api/keycloak/groups`
- `POST /api/keycloak/sync/all`
- `POST /api/keycloak/sync/groups`
- `POST /api/keycloak/sync/group/:groupPath`

---

#### Module 13: whatsappRoutes.ts

**Create**: `server/routes/whatsappRoutes.ts`

**Lines to copy from routes.ts**:
- Lines 5102-5250: WhatsApp integration endpoints

**Route paths**:
- `GET /api/whatsapp/status`
- `POST /api/whatsapp/logout`
- `POST /api/whatsapp/test`
- `GET /api/whatsapp/chats`
- `GET /api/whatsapp/groups`

---

#### Module 14: scraperRoutes.ts

**Create**: `server/routes/scraperRoutes.ts`

**Lines to copy from routes.ts**:
- Lines 5252-5350: Scraper endpoints

**Route paths**:
- `POST /api/scraper/all`
- `POST /api/scraper/adnec`
- `POST /api/scraper/abu-dhabi`

---

#### Module 15: adminRoutes.ts

**Create**: `server/routes/adminRoutes.ts`

**Lines to copy from routes.ts**:
- Lines 5352-5750: Admin-only operations

**Route paths**:
- `GET /api/admin/users/:id`
- `PUT /api/admin/users/:id`
- `DELETE /api/admin/users/:id`
- `POST /api/admin/users/:id/reset-password`
- `POST /api/admin/create-user`
- `GET /api/users`
- `GET /api/admin/tasks`
- `GET /api/admin/event-stakeholders`
- `GET /api/admin/all-attachments`
- `POST /api/admin/sample-data`
- `DELETE /api/admin/sample-data`

---

#### Module 16: partnershipRoutes.ts

**Create**: `server/routes/partnershipRoutes.ts`

**Lines to copy from routes.ts**:
- Lines 5752-8502: Partnership management (LARGE - ~2750 lines)

**Route paths**: (70+ routes)
- Partnership CRUD
- Partnership agreements and attachments
- Partnership activities
- Partnership contacts
- Partnership comments
- Partnership interactions
- Partnership tasks
- Partner events
- Inactivity monitoring

**Note**: This is the largest module - consider splitting further if needed:
- `partnershipRoutes.ts` - Main CRUD
- `partnershipAgreementRoutes.ts` - Agreements and attachments
- `partnershipActivityRoutes.ts` - Activities and interactions

---

#### Module 17: leadRoutes.ts

**Create**: `server/routes/leadRoutes.ts`

**Lines to copy from routes.ts**:
- Lines 8504-9057: Lead management endpoints

**Route paths**:
- `GET /api/leads`
- `GET /api/leads/:id`
- `POST /api/leads`
- `PUT /api/leads/:id`
- `DELETE /api/leads/:id`
- Lead interactions routes
- Lead tasks routes
- Lead task comments routes
- Interaction attachments routes

---

### Phase 3: Update Main routes.ts

#### Step 3.1: Import all route modules

At the top of `server/routes.ts`, after existing imports, add:

```typescript
// Route modules
import healthRoutes from './routes/healthRoutes';
import categoryRoutes from './routes/categoryRoutes';
import eventRoutes from './routes/eventRoutes';
import organizationRoutes from './routes/organizationRoutes';
import stakeholderRoutes from './routes/stakeholderRoutes';
import taskRoutes from './routes/taskRoutes';
import workflowRoutes from './routes/workflowRoutes';
import archiveRoutes from './routes/archiveRoutes';
import invitationRoutes from './routes/invitationRoutes';
import settingsRoutes from './routes/settingsRoutes';
import reminderRoutes from './routes/reminderRoutes';
import keycloakRoutes from './routes/keycloakRoutes';
import whatsappRoutes from './routes/whatsappRoutes';
import scraperRoutes from './routes/scraperRoutes';
import adminRoutes from './routes/adminRoutes';
import partnershipRoutes from './routes/partnershipRoutes';
import leadRoutes from './routes/leadRoutes';
```

#### Step 3.2: Mount all route modules

In the `registerRoutes` function, after `setupAuth(app)` and mounting `eventFileRoutes`, add:

```typescript
export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Mount event file routes (existing)
  app.use("/api", eventFileRoutes);

  // Mount all other route modules
  app.use(healthRoutes);
  app.use(categoryRoutes);
  app.use(eventRoutes);
  app.use(organizationRoutes);
  app.use(stakeholderRoutes);
  app.use(taskRoutes);
  app.use(workflowRoutes);
  app.use(archiveRoutes);
  app.use(invitationRoutes);
  app.use(settingsRoutes);
  app.use(reminderRoutes);
  app.use(keycloakRoutes);
  app.use(whatsappRoutes);
  app.use(scraperRoutes);
  app.use(adminRoutes);
  app.use(partnershipRoutes);
  app.use(leadRoutes);

  // Keep only helper functions and server creation at the end
  const httpServer = createServer(app);
  return httpServer;
}
```

#### Step 3.3: Remove extracted code from routes.ts

After all modules are created and mounted, remove the corresponding route definitions from `routes.ts`. Keep only:
- Import statements needed for remaining code
- The `registerRoutes` function wrapper
- The `getDepartmentEmails` helper (if not moved to utils)
- The server creation at the end

### Phase 4: E2E Testing and Validation

## E2E Testing Strategy for Routes Refactoring

### Overview

E2E tests ensure that after breaking down routes.ts, all API endpoints continue to work identically. The existing E2E test infrastructure in `server/__tests__/` uses Vitest with mocked storage and services.

### Testing Approach

**Test Pattern**: Mock storage and external services, test API endpoints through HTTP requests

**Existing E2E Tests**:
- `events.e2e.test.ts` - Event endpoints
- `categories.e2e.test.ts` - Category endpoints
- `stakeholders.e2e.test.ts` - Stakeholder endpoints
- `tasks.e2e.test.ts` - Task endpoints
- `users.e2e.test.ts` - User endpoints
- `settings.e2e.test.ts` - Settings endpoints
- `whatsapp.e2e.test.ts` - WhatsApp endpoints
- `misc.e2e.test.ts` - Miscellaneous endpoints

### Step 4.0: Setup E2E Testing Infrastructure

Before starting the refactoring, ensure E2E tests are working:

```bash
# Run existing E2E tests to establish baseline
npm run test:e2e

# Or run specific test file
npm test -- events.e2e.test.ts
```

**Expected**: All existing tests should pass before refactoring begins.

---

### Step 4.1: Create E2E Tests for Each Route Module

As you extract each route module, create or update corresponding E2E tests to validate the routes work correctly.

#### E2E Test Template

**File pattern**: `server/__tests__/[module].e2e.test.ts`

**Template**:
```typescript
/**
 * E2E tests for [Module Name] Routes
 * 
 * Tests routes defined in server/routes/[module]Routes.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAllMocks,
  withServer,
  baseSettings,
  getMockedModules,
  type MockedStorage,
  type MockedEmailService,
} from './setup';

// Setup all mocks before dynamic imports
setupAllMocks();

// Import mocked modules
const { storageMock, emailServiceMock } = await getMockedModules();

beforeEach(() => {
  vi.clearAllMocks();
  
  // Setup default mock implementations
  storageMock.getSettings.mockResolvedValue(baseSettings);
  // Add other common mocks
});

describe('[Module] Routes E2E Tests', () => {
  describe('GET /api/[route]', () => {
    it('should return [expected result]', async () => {
      // Setup test data
      storageMock.getSomething.mockResolvedValue([/* test data */]);
      
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/[route]`, {
          method: 'GET',
          headers: { 'content-type': 'application/json' },
        });
        
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toEqual([/* expected data */]);
      });
    });
    
    it('should handle errors gracefully', async () => {
      storageMock.getSomething.mockRejectedValue(new Error('Database error'));
      
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/[route]`, {
          method: 'GET',
        });
        
        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data).toHaveProperty('error');
      });
    });
  });
  
  describe('POST /api/[route]', () => {
    it('should create new resource', async () => {
      storageMock.createSomething.mockResolvedValue({ id: 123, /* data */ });
      
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/[route]`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ /* request data */ }),
        });
        
        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data).toHaveProperty('id');
      });
    });
  });
});
```

---

#### Example: Health Routes E2E Tests

**File**: `server/__tests__/health.e2e.test.ts`

```typescript
/**
 * E2E tests for Health and Dashboard Routes
 * 
 * Tests routes defined in server/routes/healthRoutes.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupAllMocks,
  withServer,
  baseSettings,
  getMockedModules,
} from './setup';

setupAllMocks();

const { storageMock } = await getMockedModules();

beforeEach(() => {
  vi.clearAllMocks();
  storageMock.getSettings.mockResolvedValue(baseSettings);
});

describe('Health Routes E2E Tests', () => {
  describe('GET /api/health', () => {
    it('should return health status', async () => {
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/health`);
        
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toHaveProperty('status', 'ok');
        expect(data).toHaveProperty('timestamp');
      });
    });
  });
  
  describe('GET /api/dashboard/stats', () => {
    it('should return dashboard statistics for public users', async () => {
      storageMock.getAllEvents.mockResolvedValue([
        { id: '1', title: 'Event 1', startDate: '2024-06-01', endDate: '2024-06-02', category: 'Conference' },
        { id: '2', title: 'Event 2', startDate: '2024-07-01', endDate: '2024-07-02', category: 'Workshop' },
      ]);
      
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/dashboard/stats`);
        
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toHaveProperty('totalEvents', 2);
        expect(data).toHaveProperty('upcomingEvents');
        expect(data).toHaveProperty('eventsByCategory');
      });
    });
  });
});
```

---

#### Example: Category Routes E2E Tests

**File**: Update existing `server/__tests__/categories.e2e.test.ts`

Verify it tests all category routes after extraction to `categoryRoutes.ts`:
- `GET /api/categories`
- `GET /api/categories/:id`
- `POST /api/categories`
- `PUT /api/categories/:id`
- `DELETE /api/categories/:id`

---

### Step 4.2: E2E Test Coverage by Module

Create or verify E2E tests exist for each route module:

#### Module 1: healthRoutes.ts
**Test file**: `health.e2e.test.ts` (create new)
**Routes to test**:
- `GET /api/health`
- `GET /api/dashboard/stats`

#### Module 2: categoryRoutes.ts
**Test file**: `categories.e2e.test.ts` (exists - verify coverage)
**Routes to test**:
- All category CRUD operations

#### Module 3: eventRoutes.ts
**Test file**: `events.e2e.test.ts` (exists - verify coverage)
**Routes to test**:
- `GET /api/events`
- `GET /api/events/:id`
- `POST /api/events`
- `PATCH /api/events/:id`
- `DELETE /api/events/:id`
- `DELETE /api/events` (superadmin)
- `GET /api/events/:id/ics`
- `GET /api/events/:id/agenda/:lang`

#### Module 4: organizationRoutes.ts
**Test file**: `organizations.e2e.test.ts` (create new)
**Routes to test**:
- Organization CRUD
- Position CRUD
- Partnership types CRUD
- Agreement types CRUD
- Contact CRUD operations
- Contact CSV import/export

#### Module 5: stakeholderRoutes.ts
**Test file**: `stakeholders.e2e.test.ts` (exists - verify coverage)
**Routes to test**:
- Stakeholder CRUD
- Department emails
- Department requirements
- Department accounts

#### Module 6: taskRoutes.ts
**Test file**: `tasks.e2e.test.ts` (exists - verify coverage)
**Routes to test**:
- Task CRUD
- Task comments
- Task attachments

#### Module 7: workflowRoutes.ts
**Test file**: `workflows.e2e.test.ts` (create new)
**Routes to test**:
- Workflow CRUD
- Task templates
- Prerequisites

#### Module 8: archiveRoutes.ts
**Test file**: `archive.e2e.test.ts` (create new)
**Routes to test**:
- Archive CRUD
- Archive from event
- Unarchive
- Archive photos
- Archive speakers
- Archive CSV import/export

#### Module 9: invitationRoutes.ts
**Test file**: `invitations.e2e.test.ts` (create new)
**Routes to test**:
- Event invitees CRUD
- Event attendees CRUD
- Send invitations
- Send test invitation
- Custom emails
- CSV upload/download

#### Module 10: settingsRoutes.ts
**Test file**: `settings.e2e.test.ts` (exists - verify coverage)
**Routes to test**:
- Settings CRUD
- Email previews
- Email tests
- Updates CRUD

#### Module 11: reminderRoutes.ts
**Test file**: `reminders.e2e.test.ts` (create new)
**Routes to test**:
- Get all reminders
- Get reminder by ID
- Resend reminder

#### Module 12: keycloakRoutes.ts
**Test file**: `keycloak.e2e.test.ts` (create new)
**Routes to test**:
- Get Keycloak groups
- Sync all users
- Sync groups
- Sync specific group

#### Module 13: whatsappRoutes.ts
**Test file**: `whatsapp.e2e.test.ts` (exists - verify coverage)
**Routes to test**:
- WhatsApp status
- WhatsApp logout
- WhatsApp test
- Get chats
- Get groups

#### Module 14: scraperRoutes.ts
**Test file**: `scraper.e2e.test.ts` (create new)
**Routes to test**:
- Scrape all sources
- Scrape ADNEC
- Scrape Abu Dhabi events

#### Module 15: adminRoutes.ts
**Test file**: `users.e2e.test.ts` (exists - update/expand)
**Routes to test**:
- User CRUD
- User password reset
- Create user
- Admin tasks
- Admin event stakeholders
- Admin attachments
- Sample data

#### Module 16: partnershipRoutes.ts
**Test file**: `partnerships.e2e.test.ts` (create new)
**Routes to test**:
- Partnership CRUD
- Agreements CRUD
- Agreement attachments
- Activities CRUD
- Contacts CRUD
- Comments CRUD
- Interactions CRUD
- Tasks CRUD
- Inactivity monitoring

#### Module 17: leadRoutes.ts
**Test file**: `leads.e2e.test.ts` (create new)
**Routes to test**:
- Lead CRUD
- Lead interactions CRUD
- Lead tasks CRUD
- Lead task comments
- Interaction attachments

---

### Step 4.3: Running E2E Tests During Refactoring

**After extracting each route module:**

1. **Create/update E2E test file** for that module
2. **Run the specific test**:
   ```bash
   npm test -- [module].e2e.test.ts
   ```
3. **Verify all tests pass** before moving to next module
4. **Run all E2E tests** periodically:
   ```bash
   npm run test:e2e
   ```

**Example workflow for eventRoutes.ts**:
```bash
# 1. Extract eventRoutes.ts from routes.ts
# 2. Update server/routes.ts to import and mount eventRoutes
# 3. Run TypeScript check
npm run check

# 4. Run event-specific E2E tests
npm test -- events.e2e.test.ts

# 5. If tests pass, commit
git add .
git commit -m "Extract eventRoutes.ts with E2E tests passing"

# 6. Run all E2E tests to ensure no regressions
npm run test:e2e
```

---

### Step 4.4: E2E Test Scripts

Add to `package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:e2e": "vitest run --testNamePattern='e2e'",
    "test:e2e:watch": "vitest watch --testNamePattern='e2e'",
    "test:e2e:module": "vitest run --testNamePattern='e2e'",
    "test:coverage": "vitest run --coverage"
  }
}
```

Usage:
```bash
# Run all E2E tests
npm run test:e2e

# Run specific module E2E tests
npm test -- events.e2e.test.ts

# Watch mode for active development
npm run test:e2e:watch
```

---

### Step 4.5: CI/CD Integration

**GitHub Actions Workflow** for E2E testing:

**File**: `.github/workflows/test-routes.yml`

```yaml
name: Routes E2E Tests

on:
  push:
    branches: [main, develop]
    paths:
      - 'server/routes/**'
      - 'server/__tests__/**'
  pull_request:
    branches: [main, develop]
    paths:
      - 'server/routes/**'
      - 'server/__tests__/**'

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run TypeScript check
        run: npm run check
        
      - name: Run E2E tests
        run: npm run test:e2e
        
      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

---

### Step 4.6: TypeScript Compilation

```bash
cd /home/runner/work/eventcal/eventcal
npm run check
```

**Expected**: No TypeScript errors after each module extraction.

---

### Step 4.7: Build the Application

```bash
npm run build
```

**Expected**: Application builds successfully with all route modules.

---

### Step 4.8: Start Application and Manual Smoke Test

```bash
# For Docker
npm run docker:dev

# Or locally
npm run dev
```

**Smoke test checklist**:
- [ ] Application starts without errors
- [ ] Health endpoint: `GET /api/health`
- [ ] Events listing: `GET /api/events`
- [ ] Create event: `POST /api/events`
- [ ] Categories: `GET /api/categories`
- [ ] Stakeholders: `GET /api/stakeholders`
- [ ] Settings: `GET /api/settings`

---

### Step 4.9: E2E Test Coverage Report

After all routes are extracted, generate coverage report:

```bash
npm run test:coverage -- --testNamePattern='e2e'
```

**Target Coverage**:
- All 280 routes should be covered by E2E tests
- Each route module should have corresponding E2E tests
- Critical paths (CRUD operations) should have 100% coverage
- Error cases should be tested

---

### Step 4.10: Regression Testing Checklist

Before finalizing the refactoring, verify:

- [ ] All existing E2E tests pass
- [ ] New E2E tests created for new route modules
- [ ] All 280 routes tested
- [ ] TypeScript compilation succeeds
- [ ] Application builds successfully
- [ ] Application starts without errors
- [ ] Manual smoke tests pass
- [ ] No breaking changes in API responses
- [ ] Error handling remains consistent
- [ ] Authentication/authorization still works

### Phase 5: Documentation

#### Step 5.1: Create routes/README.md

```markdown
# Routes Directory

This directory contains modular route handlers for the EventVue API.

## Structure

- `utils.ts` - Shared middleware, helpers, and types
- `healthRoutes.ts` - Health checks and dashboard statistics
- `eventRoutes.ts` - Event CRUD operations
- `categoryRoutes.ts` - Event category management
- ... (list all modules)

## Adding New Routes

1. Determine which module the route belongs to
2. Add the route to the appropriate file
3. Use shared utilities from `utils.ts` when applicable
4. Follow the existing pattern (Router pattern)
5. Update tests accordingly

## Pattern

All route modules follow this pattern:
...
```

#### Step 5.2: Update AI_AGENT_GUIDE.md

Add section about new route structure:

```markdown
## Route Structure

Routes are organized in `server/routes/` directory:
- Each domain has its own route file
- Shared utilities in `routes/utils.ts`
- All routes use Express Router pattern
- Main `routes.ts` imports and mounts all modules

When adding new routes:
1. Identify the correct route module
2. Add route definition following existing patterns
3. Use shared middleware from utils.ts
```

## Critical Success Factors

### ✅ DO
- Copy code blocks verbatim from routes.ts
- Preserve all comments and error handling
- **Create/update E2E tests for each module**
- **Run E2E tests after each module extraction**
- Test after each module extraction
- Commit incrementally with clear messages
- Use `report_progress` after each successful module
- Follow the existing eventFileRoutes.ts pattern exactly
- **Verify CI/CD passes before moving to next module**

### ❌ DON'T
- Rewrite or refactor logic while extracting
- Change error handling or response formats
- Skip testing between modules
- **Skip E2E test creation/verification**
- Make multiple changes before validating
- Change function signatures or return types
- Remove comments or logging statements
- **Ignore failing E2E tests**

## Rollback Plan

If issues arise:
1. Identify the problematic module
2. Check the commit before that module was added
3. Revert to that commit: `git revert <commit-hash>`
4. Fix the issue in isolation
5. Re-apply the module correctly

## Success Metrics

- ✅ All 280 routes still work identically
- ✅ TypeScript compiles without errors
- ✅ Application starts successfully
- ✅ No behavior changes in any endpoint
- ✅ **All E2E tests pass** (existing and new)
- ✅ **E2E test coverage for all route modules**
- ✅ **CI/CD pipeline passes**
- ✅ Manual smoke tests pass

## Estimated Timeline

- Phase 1 (Setup + Utils): 30-60 minutes
- Phase 2 (17 modules): 4-6 hours (15-20 min per module)
- Phase 3 (Update main routes.ts): 30 minutes
- Phase 4 (E2E Testing + Validation): 3-5 hours
  - E2E test creation/updates: 2-3 hours
  - Running tests and validation: 1-2 hours
- Phase 5 (Documentation): 30 minutes

**Total**: 8-13 hours of focused work

## Support

If you encounter issues:
1. Check TypeScript errors first: `npm run check`
2. Verify imports are correct
3. Ensure all middleware is imported
4. Check that route paths are unchanged
5. Validate that all dependencies are available
6. Review the eventFileRoutes.ts pattern

## Conclusion

This refactoring will make the codebase significantly more maintainable while preserving all existing functionality. The comprehensive E2E testing strategy ensures that all 280 routes continue to work identically after the refactoring.

### Key Highlights

✅ **Comprehensive E2E Testing**: Every route module has corresponding E2E tests
✅ **Automated CI/CD**: GitHub Actions workflow ensures tests run on every change
✅ **Incremental Validation**: Test after each module extraction to catch issues early
✅ **Zero Downtime**: All routes work identically before and after refactoring
✅ **Maintainable**: Organized structure makes future changes easier

Follow the plan step-by-step, create E2E tests as you go, and commit incrementally. The automated testing ensures confidence in every change.
