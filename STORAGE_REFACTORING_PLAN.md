# Storage.ts Refactoring Implementation Plan with Testing Strategy

## Overview

This document provides a comprehensive plan for breaking down the monolithic `server/storage.ts` file (5,699 lines, 743 methods) into smaller, domain-specific repository modules with a complete testing methodology.

## Current State

- **File**: `server/storage.ts`
- **Lines of code**: 5,699
- **Number of methods**: 743+ (including helper methods)
- **Problem**: Single massive class (`DatabaseStorage`) implementing all data access across all domains
- **Testing**: Some E2E tests exist in `server/__tests__/` but limited unit test coverage

## Target State

Break down into domain-specific repository classes organized in `server/repositories/` directory with comprehensive unit and integration tests:

### Core Domain Repositories
1. `userRepository.ts` - User management (~150 lines)
2. `eventRepository.ts` - Event CRUD operations (~300 lines)
3. `categoryRepository.ts` - Event categories (~100 lines)
4. `departmentRepository.ts` - Department/stakeholder management (~400 lines)
5. `taskRepository.ts` - Task operations (~300 lines)

### Feature Domain Repositories
6. `archiveRepository.ts` - Archive operations (~400 lines)
7. `partnershipRepository.ts` - Partnership management (~800 lines)
8. `leadRepository.ts` - Lead management (~400 lines)
9. `contactRepository.ts` - Contact/speaker management (~500 lines)

### System Repositories
10. `settingsRepository.ts` - Settings management (~100 lines)
11. `reminderRepository.ts` - Reminder queue operations (~200 lines)
12. `updateRepository.ts` - Updates (weekly/monthly) (~200 lines)
13. `workflowRepository.ts` - Task workflows (~300 lines)
14. `invitationRepository.ts` - Event invitations (~300 lines)
15. `authRepository.ts` - Authentication/Keycloak (~200 lines)

### Shared Infrastructure
16. `repositories/index.ts` - Storage facade that composes all repositories
17. `repositories/base.ts` - Base repository class with common operations
18. `repositories/types.ts` - Shared types and interfaces

## Implementation Strategy

### Principle: Extract and Compose
- **DO NOT REWRITE** - Extract methods directly from storage.ts
- Create focused repository classes for each domain
- Maintain a storage facade that composes all repositories for backward compatibility
- Zero behavior changes - all methods work identically
- Add comprehensive unit and integration tests

### Pattern: Repository Pattern

```typescript
// Base repository with common utilities
export abstract class BaseRepository {
  protected db = db;
  
  protected async findOne<T>(query: any): Promise<T | undefined> {
    const [result] = await query;
    return result || undefined;
  }
}

// Domain-specific repository
export class EventRepository extends BaseRepository {
  async getAllEvents(): Promise<Event[]> {
    // Existing implementation from storage.ts
  }
  
  async getEvent(id: string): Promise<Event | undefined> {
    // Existing implementation from storage.ts
  }
  
  // ... other event-related methods
}

// Storage facade for backward compatibility
export class DatabaseStorage implements IStorage {
  private eventRepo = new EventRepository();
  private userRepo = new UserRepository();
  // ... other repositories
  
  // Delegate to repositories
  async getAllEvents(): Promise<Event[]> {
    return this.eventRepo.getAllEvents();
  }
  
  async getEvent(id: string): Promise<Event | undefined> {
    return this.eventRepo.getEvent(id);
  }
}
```

## Testing Strategy

### Test Pyramid

```
       /\
      /  \    E2E Tests (10%)
     /----\   - Full API integration
    /      \  - Real database (test DB)
   /--------\ Integration Tests (30%)
  /          \ - Repository + Database
 /------------\ - Mock external services
/              \ Unit Tests (60%)
----------------  - Individual methods
                  - Mock database calls
```

### Test Categories

#### 1. Unit Tests (60% coverage target)
**File pattern**: `server/repositories/__tests__/[repository].test.ts`

Test each repository method in isolation with mocked database calls.

**Example**: `eventRepository.test.ts`
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventRepository } from '../eventRepository';
import { db } from '../../db';

// Mock the database
vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}));

describe('EventRepository', () => {
  let repository: EventRepository;
  
  beforeEach(() => {
    vi.clearAllMocks();
    repository = new EventRepository();
  });
  
  describe('getAllEvents', () => {
    it('should return all events with categories', async () => {
      const mockEvents = [
        { id: 'evt-1', title: 'Test Event', categoryId: 1 }
      ];
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockEvents)
          })
        })
      });
      
      const events = await repository.getAllEvents();
      
      expect(events).toEqual(mockEvents);
      expect(db.select).toHaveBeenCalled();
    });
    
    it('should handle empty results', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([])
          })
        })
      });
      
      const events = await repository.getAllEvents();
      
      expect(events).toEqual([]);
    });
  });
  
  describe('getEvent', () => {
    it('should return event by id', async () => {
      const mockEvent = { id: 'evt-1', title: 'Test Event' };
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockEvent])
          })
        })
      });
      
      const event = await repository.getEvent('evt-1');
      
      expect(event).toEqual(mockEvent);
    });
    
    it('should return undefined for non-existent event', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([])
          })
        })
      });
      
      const event = await repository.getEvent('non-existent');
      
      expect(event).toBeUndefined();
    });
  });
  
  describe('createEvent', () => {
    it('should create and return new event', async () => {
      const eventData = {
        title: 'New Event',
        startDate: '2024-01-01',
        endDate: '2024-01-02'
      };
      const createdEvent = { id: 'evt-new', ...eventData };
      
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdEvent])
        })
      });
      
      const event = await repository.createEvent(eventData);
      
      expect(event).toEqual(createdEvent);
      expect(db.insert).toHaveBeenCalled();
    });
  });
});
```

#### 2. Integration Tests (30% coverage target)
**File pattern**: `server/repositories/__tests__/[repository].integration.test.ts`

Test repositories with real database connection (test database).

**Setup**: Use a separate test database that's reset before each test.

**Example**: `eventRepository.integration.test.ts`
```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { EventRepository } from '../eventRepository';
import { db } from '../../db';
import { events, categories } from '@shared/schema.mssql';
import { sql } from 'drizzle-orm';

describe('EventRepository Integration', () => {
  let repository: EventRepository;
  
  beforeAll(async () => {
    // Ensure we're using test database
    if (!process.env.TEST_DATABASE_URL) {
      throw new Error('TEST_DATABASE_URL not set');
    }
    repository = new EventRepository();
  });
  
  beforeEach(async () => {
    // Clean up test data
    await db.delete(events);
    await db.delete(categories);
  });
  
  afterAll(async () => {
    // Final cleanup
    await db.delete(events);
  });
  
  describe('Event CRUD operations', () => {
    it('should create, read, update, and delete event', async () => {
      // Create
      const eventData = {
        title: 'Integration Test Event',
        titleAr: 'حدث اختبار التكامل',
        startDate: '2024-06-15',
        endDate: '2024-06-16',
        isPublished: true
      };
      
      const created = await repository.createEvent(eventData);
      expect(created).toMatchObject(eventData);
      expect(created.id).toBeDefined();
      
      // Read
      const retrieved = await repository.getEvent(created.id);
      expect(retrieved).toMatchObject(eventData);
      
      // Update
      const updated = await repository.updateEvent(created.id, {
        title: 'Updated Event'
      });
      expect(updated?.title).toBe('Updated Event');
      
      // Delete
      const deleted = await repository.deleteEvent(created.id);
      expect(deleted).toBe(true);
      
      // Verify deletion
      const notFound = await repository.getEvent(created.id);
      expect(notFound).toBeUndefined();
    });
    
    it('should handle events with categories', async () => {
      // Create category first
      const [category] = await db.insert(categories).values({
        nameEn: 'Test Category',
        nameAr: 'فئة الاختبار'
      }).returning();
      
      // Create event with category
      const event = await repository.createEvent({
        title: 'Categorized Event',
        startDate: '2024-07-01',
        endDate: '2024-07-02',
        categoryId: category.id,
        isPublished: true
      });
      
      // Retrieve and verify category is included
      const retrieved = await repository.getEvent(event.id);
      expect(retrieved?.category).toBe(category.nameEn);
      expect(retrieved?.categoryAr).toBe(category.nameAr);
    });
  });
  
  describe('Event queries', () => {
    beforeEach(async () => {
      // Seed test data
      await db.insert(events).values([
        {
          id: 'evt-1',
          title: 'Event 1',
          startDate: '2024-01-01',
          endDate: '2024-01-02',
          isPublished: true
        },
        {
          id: 'evt-2',
          title: 'Event 2',
          startDate: '2024-02-01',
          endDate: '2024-02-02',
          isPublished: true
        },
        {
          id: 'evt-3',
          title: 'Event 3',
          startDate: '2024-03-01',
          endDate: '2024-03-02',
          isPublished: false
        }
      ]);
    });
    
    it('should return all events ordered by date', async () => {
      const allEvents = await repository.getAllEvents();
      
      expect(allEvents).toHaveLength(3);
      expect(allEvents[0].title).toBe('Event 1');
      expect(allEvents[2].title).toBe('Event 3');
    });
  });
});
```

#### 3. E2E Tests (10% coverage target)
**File pattern**: `server/__tests__/[domain].e2e.test.ts` (already exists)

Test complete API workflows with mocked storage (current approach) or real database.

**Keep existing E2E tests** and update them as needed when refactoring.

### Test Configuration

#### vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./server/__tests__/setup.ts'],
    include: [
      'server/**/*.test.ts',
      'server/**/*.integration.test.ts',
      'server/**/*.e2e.test.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['server/repositories/**/*.ts'],
      exclude: [
        'server/repositories/**/*.test.ts',
        'server/repositories/**/*.integration.test.ts',
        'server/repositories/index.ts',
        'server/repositories/types.ts'
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70
      }
    }
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
      '@': path.resolve(__dirname, './server')
    }
  }
});
```

#### Test Database Setup

Create `.env.test` for test database:
```bash
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/eventcal_test
```

**Migration script for test database**: `scripts/setup-test-db.sh`
```bash
#!/bin/bash
# Setup test database

# Create test database if it doesn't exist
psql -U postgres -c "CREATE DATABASE eventcal_test;" 2>/dev/null || true

# Run migrations
DATABASE_URL=$TEST_DATABASE_URL npm run db:migrate

echo "Test database ready!"
```

### Testing Workflow Scripts

Add to `package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run --testNamePattern='((?!integration|e2e).)*$'",
    "test:integration": "vitest run --testNamePattern='integration'",
    "test:e2e": "vitest run --testNamePattern='e2e'",
    "test:watch": "vitest watch",
    "test:coverage": "vitest run --coverage",
    "test:db:setup": "bash scripts/setup-test-db.sh",
    "test:db:reset": "DATABASE_URL=$TEST_DATABASE_URL npm run db:reset"
  }
}
```

## Step-by-Step Implementation with Testing

### Phase 0: Setup Testing Infrastructure

#### Step 0.1: Install testing dependencies
```bash
npm install -D @vitest/coverage-v8
```

#### Step 0.2: Create test database setup script
```bash
mkdir -p scripts
# Create scripts/setup-test-db.sh with content above
chmod +x scripts/setup-test-db.sh
```

#### Step 0.3: Update vitest.config.ts
Add coverage configuration and test patterns.

#### Step 0.4: Create .env.test
Set TEST_DATABASE_URL for integration tests.

#### Step 0.5: Setup test database
```bash
npm run test:db:setup
```

---

### Phase 1: Create Base Infrastructure

#### Step 1.1: Create repositories directory
```bash
mkdir -p /home/runner/work/eventcal/eventcal/server/repositories
mkdir -p /home/runner/work/eventcal/eventcal/server/repositories/__tests__
```

#### Step 1.2: Create base repository class

**File**: `server/repositories/base.ts`
```typescript
import { db } from '../db';

export abstract class BaseRepository {
  protected db = db;
  
  /**
   * Helper to return first result or undefined
   */
  protected async findOne<T>(query: Promise<T[]>): Promise<T | undefined> {
    const [result] = await query;
    return result || undefined;
  }
  
  /**
   * Helper to check if a record exists
   */
  protected async exists(query: Promise<any[]>): Promise<boolean> {
    const result = await query;
    return result.length > 0;
  }
}
```

#### Step 1.3: Create shared types

**File**: `server/repositories/types.ts`
```typescript
// Re-export types from schema for convenience
export type {
  User, InsertUser,
  Event, InsertEvent,
  Department, InsertDepartment,
  Task, InsertTask, UpdateTask,
  // ... other types
} from '@shared/schema.mssql';

// Repository-specific types
export interface IStorage {
  // Will be populated with all repository methods
}
```

#### Step 1.4: Write tests for base repository
```bash
# Create server/repositories/__tests__/base.test.ts
```

---

### Phase 2: Extract Repositories One by One

For each repository:
1. Create repository file
2. Write unit tests
3. Write integration tests
4. Extract methods from storage.ts
5. Run tests
6. Commit

---

#### Repository 1: UserRepository

**File**: `server/repositories/userRepository.ts`

**Lines to extract from storage.ts**:
- Lines 737-771: User CRUD operations
  - `getUser` (line 737)
  - `getUserByUsername` (line 742)
  - `getAllUsers` (line 747)
  - `createUser` (line 751)
  - `updateUserPassword` (line 759)
  - `updateUserRole` (line 766)
  - `deleteUser` (line 1404)

**Template**:
```typescript
import { BaseRepository } from './base';
import { users, type User, type InsertUser } from '@shared/schema.mssql';
import { eq } from 'drizzle-orm';

export class UserRepository extends BaseRepository {
  async getUser(id: number): Promise<User | undefined> {
    // Copy implementation from storage.ts line 737-740
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    // Copy implementation from storage.ts line 742-745
  }
  
  // ... other methods
}
```

**Unit tests**: `server/repositories/__tests__/userRepository.test.ts`
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRepository } from '../userRepository';

vi.mock('../../db');

describe('UserRepository', () => {
  let repository: UserRepository;
  
  beforeEach(() => {
    vi.clearAllMocks();
    repository = new UserRepository();
  });
  
  describe('getUser', () => {
    it('should return user by id', async () => {
      // Test implementation
    });
    
    it('should return undefined for non-existent user', async () => {
      // Test implementation
    });
  });
  
  describe('createUser', () => {
    it('should create new user', async () => {
      // Test implementation
    });
    
    it('should hash password before storing', async () => {
      // Test implementation
    });
  });
  
  // ... more tests for each method
});
```

**Integration tests**: `server/repositories/__tests__/userRepository.integration.test.ts`
```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { UserRepository } from '../userRepository';
import { db } from '../../db';
import { users } from '@shared/schema.mssql';

describe('UserRepository Integration', () => {
  let repository: UserRepository;
  
  beforeEach(async () => {
    repository = new UserRepository();
    await db.delete(users); // Clean slate
  });
  
  afterAll(async () => {
    await db.delete(users);
  });
  
  it('should perform full CRUD cycle', async () => {
    // Create
    const user = await repository.createUser({
      username: 'testuser',
      password: 'hashed_password',
      role: 'admin'
    });
    expect(user.id).toBeDefined();
    
    // Read
    const retrieved = await repository.getUser(user.id);
    expect(retrieved?.username).toBe('testuser');
    
    // Update
    await repository.updateUserRole(user.id, 'superadmin');
    const updated = await repository.getUser(user.id);
    expect(updated?.role).toBe('superadmin');
    
    // Delete
    await repository.deleteUser(user.id);
    const deleted = await repository.getUser(user.id);
    expect(deleted).toBeUndefined();
  });
});
```

**Run tests**:
```bash
npm run test:unit -- userRepository
npm run test:integration -- userRepository
```

---

#### Repository 2: EventRepository

**File**: `server/repositories/eventRepository.ts`

**Lines to extract from storage.ts**:
- Lines 774-841: Event CRUD operations
  - `getAllEvents` (line 774)
  - `getEvent` (line 792)
  - `createEvent` (line 813)
  - `updateEvent` (line 821)
  - `deleteEvent` (line 830)
  - `deleteAllEvents` (line 838)

**Methods**: ~10 methods

**Unit tests**: Test each method with mocked database
**Integration tests**: Test with real database operations

---

#### Repository 3: CategoryRepository

**File**: `server/repositories/categoryRepository.ts`

**Lines to extract from storage.ts**:
- Lines 843-878: Category operations
  - `getCategories` (line 843)
  - `getCategoryById` (line 847)
  - `getCategoryByName` (line 852)
  - `createCategory` (line 857)
  - `updateCategory` (line 862)
  - `deleteCategory` (line 871)

**Methods**: ~6 methods

---

#### Repository 4: DepartmentRepository

**File**: `server/repositories/departmentRepository.ts`

**Lines to extract from storage.ts**:
- Lines 1023-1165: Department operations
- Lines 1083-1115: Department emails
- Lines 1117-1165: Department requirements
- Lines 1166-1333: Event departments

**Methods**: ~35 methods

**This is a LARGE repository - consider splitting**:
- `departmentRepository.ts` - Core department CRUD
- `departmentEmailRepository.ts` - Email management
- `departmentRequirementRepository.ts` - Requirements management
- `eventDepartmentRepository.ts` - Event assignments

---

#### Repository 5: TaskRepository

**File**: `server/repositories/taskRepository.ts`

**Lines to extract from storage.ts**:
- Lines 1412-1551: Task operations
- Lines 1489-1551: Task comments and attachments
- Lines 1730-1963: Admin task queries

**Methods**: ~25 methods

---

#### Repository 6: SettingsRepository

**File**: `server/repositories/settingsRepository.ts`

**Lines to extract from storage.ts**:
- Lines 880-889: Settings operations
  - `getSettings` (line 880)
  - `updateSettings` (line 885)

**Methods**: ~2 methods

---

#### Repository 7: ReminderRepository

**File**: `server/repositories/reminderRepository.ts`

**Lines to extract from storage.ts**:
- Lines 891-1021: Reminder queue operations
  - `enqueueReminder` (line 891)
  - `getPendingReminders` (line 918)
  - `markReminderSent` (line 947)
  - `markReminderError` (line 958)
  - `deleteRemindersForEvent` (line 970)
  - `getAllRemindersWithEvents` (line 976)
  - `getReminder` (line 989)
  - `resetReminderForResend` (line 997)
  - `deleteReminder` (line 1014)

**Methods**: ~9 methods

---

#### Repository 8: UpdateRepository

**File**: `server/repositories/updateRepository.ts`

**Lines to extract from storage.ts**:
- Lines 1964-2069: Update operations (weekly/monthly)

**Methods**: ~10 methods

---

#### Repository 9: ArchiveRepository

**File**: `server/repositories/archiveRepository.ts`

**Lines to extract from storage.ts**:
- Lines 2236-2600: Archive operations
- Archived event CRUD
- Archive media management
- Archive speaker management

**Methods**: ~30 methods

---

#### Repository 10: ContactRepository

**File**: `server/repositories/contactRepository.ts`

**Lines to extract from storage.ts**:
- Lines 2601-3300: Contact/speaker operations
- Organization management
- Position management
- Contact CRUD
- Event speakers
- Event attendees

**Methods**: ~50 methods

**Consider splitting**:
- `organizationRepository.ts`
- `contactRepository.ts`
- `speakerRepository.ts`
- `attendeeRepository.ts`

---

#### Repository 11: InvitationRepository

**File**: `server/repositories/invitationRepository.ts`

**Lines to extract from storage.ts**:
- Lines 3301-3600: Invitation operations
- Event invitees
- Custom emails
- Invitation jobs

**Methods**: ~20 methods

---

#### Repository 12: WorkflowRepository

**File**: `server/repositories/workflowRepository.ts`

**Lines to extract from storage.ts**:
- Lines 3601-3900: Workflow operations
- Task templates
- Prerequisites
- Event workflows

**Methods**: ~20 methods

---

#### Repository 13: PartnershipRepository

**File**: `server/repositories/partnershipRepository.ts`

**Lines to extract from storage.ts**:
- Lines 3901-4800: Partnership operations
- Agreements and attachments
- Activities
- Contacts
- Comments
- Interactions

**Methods**: ~60 methods

**This is VERY LARGE - strongly recommend splitting**:
- `partnershipRepository.ts` - Core partnership CRUD
- `partnershipAgreementRepository.ts` - Agreements
- `partnershipActivityRepository.ts` - Activities
- `partnershipInteractionRepository.ts` - Interactions

---

#### Repository 14: LeadRepository

**File**: `server/repositories/leadRepository.ts`

**Lines to extract from storage.ts**:
- Lines 4801-5200: Lead operations
- Lead interactions
- Contact tasks

**Methods**: ~30 methods

---

#### Repository 15: AuthRepository

**File**: `server/repositories/authRepository.ts`

**Lines to extract from storage.ts**:
- Lines 2071-2224: Keycloak integration
- Lines 1335-1403: Department accounts
- Lines 1396-1402: Auth identities

**Methods**: ~15 methods

---

### Phase 3: Create Storage Facade

#### Step 3.1: Create storage facade

**File**: `server/repositories/index.ts`

```typescript
import { BaseRepository } from './base';
import { UserRepository } from './userRepository';
import { EventRepository } from './eventRepository';
import { CategoryRepository } from './categoryRepository';
import { DepartmentRepository } from './departmentRepository';
import { TaskRepository } from './taskRepository';
import { SettingsRepository } from './settingsRepository';
import { ReminderRepository } from './reminderRepository';
import { UpdateRepository } from './updateRepository';
import { ArchiveRepository } from './archiveRepository';
import { ContactRepository } from './contactRepository';
import { InvitationRepository } from './invitationRepository';
import { WorkflowRepository } from './workflowRepository';
import { PartnershipRepository } from './partnershipRepository';
import { LeadRepository } from './leadRepository';
import { AuthRepository } from './authRepository';
import type { IStorage } from './types';
import session from "express-session";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

/**
 * DatabaseStorage - Facade that composes all repositories
 * Maintains backward compatibility with existing code
 */
export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  // Repository instances
  private userRepo: UserRepository;
  private eventRepo: EventRepository;
  private categoryRepo: CategoryRepository;
  private departmentRepo: DepartmentRepository;
  private taskRepo: TaskRepository;
  private settingsRepo: SettingsRepository;
  private reminderRepo: ReminderRepository;
  private updateRepo: UpdateRepository;
  private archiveRepo: ArchiveRepository;
  private contactRepo: ContactRepository;
  private invitationRepo: InvitationRepository;
  private workflowRepo: WorkflowRepository;
  private partnershipRepo: PartnershipRepository;
  private leadRepo: LeadRepository;
  private authRepo: AuthRepository;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false,
      tableName: 'sessions',
    });
    
    // Initialize repositories
    this.userRepo = new UserRepository();
    this.eventRepo = new EventRepository();
    this.categoryRepo = new CategoryRepository();
    this.departmentRepo = new DepartmentRepository();
    this.taskRepo = new TaskRepository();
    this.settingsRepo = new SettingsRepository();
    this.reminderRepo = new ReminderRepository();
    this.updateRepo = new UpdateRepository();
    this.archiveRepo = new ArchiveRepository();
    this.contactRepo = new ContactRepository();
    this.invitationRepo = new InvitationRepository();
    this.workflowRepo = new WorkflowRepository();
    this.partnershipRepo = new PartnershipRepository();
    this.leadRepo = new LeadRepository();
    this.authRepo = new AuthRepository();
  }

  // User operations - delegate to UserRepository
  async getUser(id: number) {
    return this.userRepo.getUser(id);
  }

  async getUserByUsername(username: string) {
    return this.userRepo.getUserByUsername(username);
  }

  async getAllUsers() {
    return this.userRepo.getAllUsers();
  }

  async createUser(insertUser: any) {
    return this.userRepo.createUser(insertUser);
  }

  // ... delegate all other methods to their respective repositories
  
  // Event operations - delegate to EventRepository
  async getAllEvents() {
    return this.eventRepo.getAllEvents();
  }

  async getEvent(id: string) {
    return this.eventRepo.getEvent(id);
  }
  
  // ... continue for all methods
}

export const storage = new DatabaseStorage();
```

#### Step 3.2: Update storage.ts to use facade

Replace the entire `DatabaseStorage` class implementation with:
```typescript
export { DatabaseStorage, storage } from './repositories';
export { classifyPartnershipScope } from './repositories/partnershipRepository';
```

#### Step 3.3: Test backward compatibility

Run all existing E2E tests to ensure nothing breaks:
```bash
npm run test:e2e
```

---

### Phase 4: Validation and Testing

#### Step 4.1: Run all tests
```bash
# Unit tests
npm run test:unit

# Integration tests  
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm test
```

#### Step 4.2: Check test coverage
```bash
npm run test:coverage
```

Target coverage:
- Overall: 70%+
- Each repository: 60%+
- Critical paths (CRUD operations): 90%+

#### Step 4.3: TypeScript compilation
```bash
npm run check
```

#### Step 4.4: Build application
```bash
npm run build
```

#### Step 4.5: Manual testing
- Start application: `npm run dev`
- Test key workflows:
  - Create event
  - Assign stakeholders
  - Create tasks
  - Archive event
  - Manage partnerships

---

### Phase 5: Documentation

#### Step 5.1: Create repository README

**File**: `server/repositories/README.md`
```markdown
# Repositories

Domain-specific repository classes for data access.

## Structure

- `base.ts` - Base repository with common utilities
- `types.ts` - Shared types and interfaces
- `index.ts` - Storage facade (backward compatibility)

## Repositories

### Core Domain
- `userRepository.ts` - User management
- `eventRepository.ts` - Event operations
- `categoryRepository.ts` - Event categories
- `departmentRepository.ts` - Departments/stakeholders
- `taskRepository.ts` - Task operations

### Feature Domain
- `archiveRepository.ts` - Archive operations
- `partnershipRepository.ts` - Partnership management
- `leadRepository.ts` - Lead management
- `contactRepository.ts` - Contacts/speakers

### System
- `settingsRepository.ts` - Settings
- `reminderRepository.ts` - Reminders
- `updateRepository.ts` - Updates
- `workflowRepository.ts` - Workflows
- `invitationRepository.ts` - Invitations
- `authRepository.ts` - Authentication

## Usage

### Direct Repository Access
```typescript
import { EventRepository } from './repositories/eventRepository';

const eventRepo = new EventRepository();
const events = await eventRepo.getAllEvents();
```

### Via Storage Facade (Backward Compatible)
```typescript
import { storage } from './repositories';

const events = await storage.getAllEvents();
```

## Testing

### Unit Tests
```bash
npm run test:unit -- repositories
```

### Integration Tests
```bash
npm run test:integration -- repositories
```

### Coverage
```bash
npm run test:coverage
```

## Adding New Repository

1. Create repository file extending `BaseRepository`
2. Extract methods from storage.ts (or add new)
3. Write unit tests (60%+ coverage)
4. Write integration tests
5. Add to storage facade in `index.ts`
6. Update types in `types.ts`
7. Update this README
```

#### Step 5.2: Update AI_AGENT_GUIDE.md

Add section:
```markdown
## Repository Structure

Data access is organized in `server/repositories/`:
- Domain-specific repository classes
- Base repository with common utilities
- Storage facade for backward compatibility

### Testing
- Unit tests: Mock database calls
- Integration tests: Real test database
- E2E tests: Full API integration

When modifying data access:
1. Locate the appropriate repository
2. Add/modify methods
3. Write unit tests (60%+ coverage)
4. Write integration tests
5. Update storage facade if needed
```

---

## Testing Best Practices

### 1. Test Organization
```
server/repositories/
├── __tests__/
│   ├── userRepository.test.ts           # Unit tests
│   ├── userRepository.integration.test.ts # Integration tests
│   ├── eventRepository.test.ts
│   ├── eventRepository.integration.test.ts
│   └── ...
├── userRepository.ts
├── eventRepository.ts
└── ...
```

### 2. Test Naming Convention
- Unit tests: `[method].should [behavior]`
- Integration tests: `should [complete workflow]`

### 3. Test Data Management
- Use factories for test data creation
- Clean up after each test
- Use transactions for isolation (if possible)

### 4. Mocking Strategy
- Unit tests: Mock database calls
- Integration tests: Real database, mock external services
- E2E tests: Mock only external APIs

### 5. Coverage Goals
- Lines: 70%+
- Functions: 70%+
- Branches: 60%+
- Statements: 70%+

---

## Automated Testing Scripts

### Pre-commit Hook
**File**: `.husky/pre-commit` (if using husky)
```bash
#!/bin/sh
npm run test:unit
npm run check
```

### CI/CD Pipeline
**File**: `.github/workflows/test.yml`
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: eventcal_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Setup test database
        env:
          TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/eventcal_test
        run: npm run test:db:setup
        
      - name: Run unit tests
        run: npm run test:unit
        
      - name: Run integration tests
        env:
          TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/eventcal_test
        run: npm run test:integration
        
      - name: Run E2E tests
        run: npm run test:e2e
        
      - name: Check coverage
        run: npm run test:coverage
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Critical Success Factors

### ✅ DO
- Write tests BEFORE or WHILE extracting repositories
- Test each repository independently
- Use real database for integration tests
- Maintain backward compatibility via storage facade
- Keep test data clean and isolated
- Aim for 70%+ test coverage
- Run tests frequently during development

### ❌ DON'T
- Extract repositories without tests
- Share test data between tests
- Skip integration tests
- Break existing E2E tests
- Ignore test failures
- Commit untested code
- Mix unit and integration tests

---

## Rollback Plan

If issues arise:
1. Identify problematic repository
2. Check tests for that repository
3. Fix issues or revert to storage.ts implementation
4. Re-run all tests
5. Document the issue

---

## Success Metrics

- ✅ All 743 methods work identically
- ✅ TypeScript compiles without errors
- ✅ 70%+ test coverage achieved
- ✅ All existing E2E tests pass
- ✅ Integration tests cover critical paths
- ✅ No behavior changes in any method
- ✅ Application starts successfully
- ✅ Manual testing of key workflows passes

---

## Estimated Timeline

- Phase 0 (Testing Setup): 1-2 hours
- Phase 1 (Base Infrastructure): 1-2 hours
- Phase 2 (15 Repositories @ 2-4 hours each): 30-60 hours
  - Each repository includes:
    - Extraction: 30-60 min
    - Unit tests: 30-60 min
    - Integration tests: 30-60 min
    - Validation: 15-30 min
- Phase 3 (Storage Facade): 2-3 hours
- Phase 4 (Validation): 3-4 hours
- Phase 5 (Documentation): 1-2 hours

**Total**: 38-74 hours of focused work

---

## Support and Troubleshooting

### Common Issues

**1. Test Database Connection Errors**
- Ensure TEST_DATABASE_URL is set
- Check PostgreSQL is running
- Verify database exists

**2. Test Failures After Extraction**
- Compare method signatures with storage.ts
- Check all imports are correct
- Verify test mocks match actual method calls

**3. Integration Test Timeouts**
- Increase timeout in vitest.config.ts
- Check for hanging database connections
- Verify test cleanup is running

**4. Coverage Not Meeting Thresholds**
- Focus on critical paths first
- Add edge case tests
- Test error handling paths

---

## Conclusion

This refactoring will make the codebase significantly more maintainable and testable. The comprehensive testing strategy ensures that all functionality is preserved while improving code organization. Follow the plan step-by-step, write tests as you go, and validate thoroughly at each stage.
