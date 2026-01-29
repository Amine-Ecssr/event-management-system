# Implementation Plan: Add New User Roles

## 🎯 Objective
Add four new user roles to the Event Management System:
- `events_lead` - Manages events and event-related activities
- `division_head` - Oversees a division with broader permissions
- `employee` - Regular employee with limited access
- `viewer` - Read-only access to the system

---

## 📋 Current State Analysis

### Current Roles:
1. **superadmin** - Full system access
2. **admin** - Event/task management, creates users
3. **department** - View-only access to assigned events
4. **department_admin** - Department admin access

### Role Definitions Needed:

Before implementation, we need to define **permissions** for each new role:

#### **events_lead**
- Create/edit/delete events
- Assign tasks related to events
- View all events (not just assigned)
- Manage event stakeholders
- Cannot create users or modify system settings
- Full access to event-related features (invitations, attendees, media)

#### **division_head**
- All permissions of events_lead
- Manage partnerships
- View analytics dashboards
- Manage contacts and speakers
- Approve tasks/workflows
- Cannot modify system-wide settings
- Can view all data across divisions

#### **employee**
- View assigned events
- Update assigned tasks
- Comment on tasks
- View contacts (read-only)
- Cannot create events or partnerships
- Limited to own assignments

#### **viewer**
- Read-only access across the system
- View events, tasks, partnerships (but not edit)
- View dashboards and analytics
- Cannot create, edit, or delete anything
- Useful for auditors, observers, or external stakeholders

---

## 🔧 Implementation Steps

### **Step 1: Update Database Schema** ✅

**File:** `shared/schema.ts`

Update the user role enum to include new roles:

```typescript
// BEFORE (line 11):
role: text("role").notNull().default('admin'), // 'superadmin', 'admin', 'department', or 'department_admin'

// AFTER:
role: text("role").notNull().default('employee'), // 'superadmin', 'admin', 'department', 'department_admin', 'events_lead', 'division_head', 'employee', 'viewer'
```

Update the Zod schema validation (line 20):

```typescript
// BEFORE:
role: z.enum(['superadmin', 'admin', 'department', 'department_admin']).default('admin'),

// AFTER:
role: z.enum([
  'superadmin', 
  'admin', 
  'department', 
  'department_admin', 
  'events_lead', 
  'division_head', 
  'employee', 
  'viewer'
]).default('employee'),
```

---

### **Step 2: Create Database Migration** ✅

**File:** `migrations/0021_add_new_roles.sql`

```sql
-- Add new roles to the database
-- This migration is safe to run - it only expands the allowed values

-- No ALTER TABLE needed since role is text type
-- Just document the new allowed values

COMMENT ON COLUMN users.role IS 'User role: superadmin, admin, department, department_admin, events_lead, division_head, employee, viewer';
```

---

### **Step 3: Update Authentication Middleware** ✅

**File:** `server/auth.ts`

Update role validation (line 199):

```typescript
// BEFORE:
if (!['admin', 'superadmin', 'department_admin', 'department'].includes(userRole)) {
  return res.status(400).json({ error: "Role must be 'admin', 'superadmin', 'department_admin', or 'department'" });
}

// AFTER:
const validRoles = ['superadmin', 'admin', 'department', 'department_admin', 'events_lead', 'division_head', 'employee', 'viewer'];
if (!validRoles.includes(userRole)) {
  return res.status(400).json({ 
    error: `Role must be one of: ${validRoles.join(', ')}` 
  });
}
```

Create new middleware functions in `server/auth.ts`:

```typescript
// Events Lead or higher (events_lead, division_head, admin, superadmin)
export function isEventsLeadOrHigher(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  
  const allowedRoles = ['superadmin', 'admin', 'division_head', 'events_lead'];
  if (!allowedRoles.includes(req.user?.role)) {
    return res.status(403).json({ 
      error: "This action requires events lead privileges or higher" 
    });
  }
  next();
}

// Division Head or higher
export function isDivisionHeadOrHigher(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  
  const allowedRoles = ['superadmin', 'admin', 'division_head'];
  if (!allowedRoles.includes(req.user?.role)) {
    return res.status(403).json({ 
      error: "This action requires division head privileges or higher" 
    });
  }
  next();
}

// Employee or higher (excludes viewer)
export function isEmployeeOrHigher(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  
  if (req.user?.role === 'viewer') {
    return res.status(403).json({ 
      error: "Viewers cannot perform this action" 
    });
  }
  next();
}

// Not viewer (anyone except viewer can perform this action)
export function isNotViewer(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  
  if (req.user?.role === 'viewer') {
    return res.status(403).json({ 
      error: "Viewers have read-only access" 
    });
  }
  next();
}
```

---

### **Step 4: Update Authorization on Routes** ⚠️

This is the most extensive step. We need to update routes based on new role permissions.

**Files to update:** `server/routes/*.routes.ts`

#### **Event Routes** (`server/routes/event.routes.ts`)

```typescript
// Events creation - requires events_lead or higher
router.post('/api/events', isEventsLeadOrHigher, async (req, res) => {
  // ... existing code
});

// Events editing - requires events_lead or higher
router.put('/api/events/:id', isEventsLeadOrHigher, async (req, res) => {
  // ... existing code
});

// Events deletion - requires admin or higher
router.delete('/api/events/:id', isAdminOrSuperAdmin, async (req, res) => {
  // ... existing code
});

// Events viewing - authenticated users (including viewer)
router.get('/api/events', isAuthenticated, async (req, res) => {
  // ... existing code
});
```

#### **Task Routes** (`server/routes/task.routes.ts`)

```typescript
// Task creation - requires events_lead or higher
router.post('/api/tasks', isEventsLeadOrHigher, async (req, res) => {
  // ... existing code
});

// Task updates - requires employee or higher (assigned users + leads)
router.put('/api/tasks/:id', isEmployeeOrHigher, async (req, res) => {
  // ... check if user is assigned to task OR is events_lead+
});

// Task comments - requires employee or higher
router.post('/api/tasks/:id/comments', isEmployeeOrHigher, async (req, res) => {
  // ... existing code
});
```

#### **Partnership Routes** (`server/routes/partnership.routes.ts`)

```typescript
// Partnership creation - requires division_head or higher
router.post('/api/partnerships', isDivisionHeadOrHigher, async (req, res) => {
  // ... existing code
});

// Partnership editing - requires division_head or higher
router.put('/api/partnerships/:id', isDivisionHeadOrHigher, async (req, res) => {
  // ... existing code
});

// Partnership viewing - authenticated (including viewer)
router.get('/api/partnerships', isAuthenticated, async (req, res) => {
  // ... existing code
});
```

#### **Contact Routes** (`server/routes/organization.routes.ts`)

```typescript
// Contact creation - requires events_lead or higher
router.post('/api/contacts', isEventsLeadOrHigher, async (req, res) => {
  // ... existing code
});

// Contact editing - requires events_lead or higher
router.put('/api/contacts/:id', isEventsLeadOrHigher, async (req, res) => {
  // ... existing code
});

// Contact viewing - authenticated (including viewer)
router.get('/api/contacts', isAuthenticated, async (req, res) => {
  // ... existing code
});
```

#### **User Management Routes** (`server/routes/user.routes.ts`)

```typescript
// User creation - only superadmin
router.post('/api/users', isSuperAdmin, async (req, res) => {
  // ... existing code
});

// User editing - only superadmin
router.put('/api/users/:id', isSuperAdmin, async (req, res) => {
  // ... existing code
});
```

---

### **Step 5: Update Frontend Role Checks** ⚠️

**Files:** Multiple files in `client/src/`

Create a role utility helper:

**File:** `client/src/lib/roles.ts`

```typescript
export type UserRole = 
  | 'superadmin' 
  | 'admin' 
  | 'department' 
  | 'department_admin' 
  | 'events_lead' 
  | 'division_head' 
  | 'employee' 
  | 'viewer';

// Role hierarchy levels
const ROLE_LEVELS: Record<UserRole, number> = {
  viewer: 0,
  employee: 1,
  department: 2,
  events_lead: 3,
  division_head: 4,
  department_admin: 4,
  admin: 5,
  superadmin: 6,
};

export function hasRoleLevel(userRole: string | undefined, requiredRole: UserRole): boolean {
  if (!userRole) return false;
  const userLevel = ROLE_LEVELS[userRole as UserRole] ?? 0;
  const requiredLevel = ROLE_LEVELS[requiredRole];
  return userLevel >= requiredLevel;
}

// Specific permission checks
export function canCreateEvents(role?: string): boolean {
  return hasRoleLevel(role, 'events_lead');
}

export function canEditEvents(role?: string): boolean {
  return hasRoleLevel(role, 'events_lead');
}

export function canDeleteEvents(role?: string): boolean {
  return hasRoleLevel(role, 'admin');
}

export function canManagePartnerships(role?: string): boolean {
  return hasRoleLevel(role, 'division_head');
}

export function canManageContacts(role?: string): boolean {
  return hasRoleLevel(role, 'events_lead');
}

export function canUpdateTasks(role?: string): boolean {
  return hasRoleLevel(role, 'employee');
}

export function canViewAnalytics(role?: string): boolean {
  return hasRoleLevel(role, 'division_head');
}

export function isReadOnly(role?: string): boolean {
  return role === 'viewer';
}

export function canCreateUsers(role?: string): boolean {
  return role === 'superadmin';
}
```

Update components to use new helper:

**Example:** `client/src/components/EventForm.tsx`

```typescript
import { canEditEvents, isReadOnly } from '@/lib/roles';
import { useAuth } from '@/hooks/use-auth';

function EventForm() {
  const { user } = useAuth();
  const canEdit = canEditEvents(user?.role);
  const readOnly = isReadOnly(user?.role);
  
  // ... rest of component
  
  return (
    <form>
      {/* Disable form fields for viewer */}
      <Input disabled={readOnly || !canEdit} />
      
      {/* Hide save button for viewers */}
      {!readOnly && canEdit && (
        <Button type="submit">Save</Button>
      )}
    </form>
  );
}
```

---

### **Step 6: Update Navigation/UI Based on Roles** ⚠️

**File:** `client/src/lib/navigationConfig.ts` or equivalent

Update navigation menu to show/hide items based on role:

```typescript
import { canManagePartnerships, canViewAnalytics, hasRoleLevel } from './roles';

export function getNavigationItems(userRole?: string) {
  const items = [
    {
      name: 'Dashboard',
      path: '/',
      visible: true, // Everyone can see dashboard
    },
    {
      name: 'Events',
      path: '/events',
      visible: true, // Everyone can view events
    },
    {
      name: 'Tasks',
      path: '/tasks',
      visible: hasRoleLevel(userRole, 'employee'), // Employee and above
    },
    {
      name: 'Partnerships',
      path: '/partnerships',
      visible: hasRoleLevel(userRole, 'division_head'), // Division head and above
    },
    {
      name: 'Analytics',
      path: '/analytics',
      visible: canViewAnalytics(userRole),
    },
    {
      name: 'Settings',
      path: '/settings',
      visible: hasRoleLevel(userRole, 'admin'), // Admin and above
    },
  ];
  
  return items.filter(item => item.visible);
}
```

---

### **Step 7: Update User Management UI** ⚠️

**File:** `client/src/pages/Users.tsx`

Update the role dropdown in user creation/editing form:

```typescript
const roleOptions = [
  { value: 'viewer', label: 'Viewer (Read-only)' },
  { value: 'employee', label: 'Employee' },
  { value: 'events_lead', label: 'Events Lead' },
  { value: 'division_head', label: 'Division Head' },
  { value: 'department', label: 'Department User' },
  { value: 'department_admin', label: 'Department Admin' },
  { value: 'admin', label: 'Administrator' },
  { value: 'superadmin', label: 'Super Administrator' },
];

// Only superadmin can create superadmin users
const availableRoles = user?.role === 'superadmin' 
  ? roleOptions 
  : roleOptions.filter(r => r.value !== 'superadmin');
```

---

### **Step 8: Add Role Descriptions in UI** ✅

**File:** `client/src/components/RoleDescription.tsx` (NEW)

```typescript
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

interface RoleDescriptionProps {
  role: string;
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  superadmin: 'Full system access including user management and system settings',
  admin: 'Can manage events, tasks, partnerships, and create admin users',
  division_head: 'Oversees division with access to analytics, partnerships, and all events',
  events_lead: 'Manages events, assigns tasks, and coordinates event-related activities',
  department_admin: 'Manages department users and assigned events',
  department: 'View-only access to assigned department events',
  employee: 'Can update assigned tasks and view related events',
  viewer: 'Read-only access across the system - cannot create or edit anything',
};

export function RoleDescription({ role }: RoleDescriptionProps) {
  const description = ROLE_DESCRIPTIONS[role] || 'Unknown role';
  
  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}
```

---

### **Step 9: Update Tests** ⚠️

If tests exist, update role-based tests:

**File:** `server/__tests__/auth.test.ts`

```typescript
describe('Authorization', () => {
  test('events_lead can create events', async () => {
    // ... test code
  });
  
  test('employee cannot create events', async () => {
    // ... test code
  });
  
  test('viewer cannot edit anything', async () => {
    // ... test code
  });
  
  test('division_head can manage partnerships', async () => {
    // ... test code
  });
});
```

---

### **Step 10: Update Documentation** ✅

**File:** `docs/RBAC_AND_SECURITY.md`

Add section documenting new roles and their permissions.

---

## 📝 File Checklist

### ✅ Must Update:
1. `shared/schema.ts` - Add roles to enum
2. `server/auth.ts` - Update middleware and validation
3. `migrations/0021_add_new_roles.sql` - Create migration
4. `client/src/lib/roles.ts` - Create role utility (NEW FILE)
5. `client/src/components/RoleDescription.tsx` - Role descriptions (NEW FILE)

### ⚠️ Should Update:
6. `server/routes/event.routes.ts` - Update event permissions
7. `server/routes/task.routes.ts` - Update task permissions
8. `server/routes/partnership.routes.ts` - Update partnership permissions
9. `server/routes/organization.routes.ts` - Update contact permissions
10. `client/src/pages/Users.tsx` - Update user management UI
11. `client/src/lib/navigationConfig.ts` - Update navigation
12. All `client/src/pages/*.tsx` files that check roles

### 📚 Document:
13. `docs/RBAC_AND_SECURITY.md` - Update documentation

---

## 🎯 Quick Start Implementation Order

1. **Database & Types** (Day 1)
   - Update `shared/schema.ts`
   - Create migration file
   - Run migration

2. **Backend Auth** (Day 1-2)
   - Update `server/auth.ts` middleware
   - Add new middleware functions

3. **Frontend Utilities** (Day 2)
   - Create `client/src/lib/roles.ts`
   - Create `client/src/components/RoleDescription.tsx`

4. **Update Routes** (Day 2-3)
   - Update all route files with new middleware
   - Test each route

5. **Update UI** (Day 3-4)
   - Update `Users.tsx` for role management
   - Update navigation
   - Update individual pages with role checks

6. **Testing & Documentation** (Day 4-5)
   - Test all role combinations
   - Update documentation
   - Write tests

---

## ⚠️ Important Notes

1. **Default Role**: Changed from `'admin'` to `'employee'` for new users
2. **Backward Compatibility**: Existing users keep their current roles
3. **Viewer Role**: Special role with NO write permissions - check everywhere
4. **Role Hierarchy**: Defined in `ROLE_LEVELS` for easy comparison
5. **Department vs Division**: "Department" roles are existing, "Division" is new organizational concept

---

## 🧪 Testing Checklist

After implementation, test each role:

- [ ] **Viewer**: Can only read, cannot create/edit/delete anything
- [ ] **Employee**: Can update assigned tasks, view events
- [ ] **Events Lead**: Can create/edit events, assign tasks
- [ ] **Division Head**: Can manage partnerships, view analytics
- [ ] **Admin**: Full access except superadmin actions
- [ ] **Superadmin**: Can do everything including create users

Test matrix:
| Action | Viewer | Employee | Events Lead | Division Head | Admin | Superadmin |
|--------|--------|----------|-------------|---------------|-------|------------|
| View events | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create events | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Update tasks | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage partnerships | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| View analytics | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Create users | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 📦 Ready to Implement?

This plan provides a comprehensive roadmap. Let me know if you'd like me to:
1. Start implementing these changes
2. Clarify any permissions
3. Modify the role hierarchy
4. Add additional roles or permissions

Let's build this! 🚀
