# Role-Based Access Control & Security Guide

This document details the complete role-based access control system, security features, and future improvement plans for the ECSSR Events Calendar application.

## 📋 Table of Contents

1. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
2. [Role Hierarchy & Permissions Matrix](#role-hierarchy--permissions-matrix)
3. [Current Security Features](#current-security-features)
4. [Security Constraints & Limitations](#security-constraints--limitations)
5. [Future Security Improvements](#future-security-improvements)
6. [Future Feature Enhancements](#future-feature-enhancements)

---

## Role-Based Access Control (RBAC)

### Overview

The application implements an **eight-tier role system** with hierarchical privileges:

| Role | Level | Description |
|------|-------|-------------|
| **Superadmin** | 6 | Full system access including user management |
| **Admin** | 5 | Standard administrative privileges |
| **Division Head** | 4 | Division oversight with analytics and partnerships |
| **Department Admin** | 4 | Department-scoped admin with communications |
| **Events Lead** | 3 | Event and task management |
| **Department** | 2 | Department-focused access (formerly Stakeholder) |
| **Employee** | 1 | Task execution and updates |
| **Viewer** | 0 | Read-only access across the system |

**Role Hierarchy Principle:** Higher-level roles inherit permissions from lower levels. For example, an Admin can do everything an Events Lead can do, plus additional admin-specific actions.

All roles are stored in the `users` table with a `role` field.

---

## Role Hierarchy & Permissions Matrix

### Quick Reference Table

| Permission | Viewer | Employee | Department | Events Lead | Division Head | Dept Admin | Admin | Superadmin |
|-----------|--------|----------|-----------|-------------|---------------|-----------|-------|------------|
| **Events** |
| View events | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create events | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Edit events | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Delete events | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Import events | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Tasks** |
| View assigned tasks | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View all tasks | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Create tasks | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Update tasks | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete tasks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Comment on tasks | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Partnerships** |
| View partnerships | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create partnerships | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Edit partnerships | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Delete partnerships | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Contacts & Speakers** |
| View contacts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create contacts | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Edit contacts | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Delete contacts | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Analytics & Reports** |
| View dashboards | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Export data | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| **Administration** |
| Manage departments | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage workflows | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| System settings | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| User management | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Create superadmins | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

### Role Definitions

#### 1. Superadmin Role (Level 6)

**Purpose:** System owner with full control over all features and users.

**Capabilities:**

**User Management:**
- ✅ Create users with any role (including superadmin)
- ✅ Delete any user (except their own account)
- ✅ Reset passwords for any user
- ✅ View all users in the system
- ✅ Assign roles to users

**Event Management:**
- ✅ Full CRUD operations on events
- ✅ Assign stakeholders to events
- ✅ Configure reminder preferences
- ✅ Import events via CSV
- ✅ Bulk delete events
- ✅ View expected attendance

**Task Management:**
- ✅ Create tasks for any department
- ✅ Delete any task
- ✅ View all tasks
- ✅ Assign tasks to events
- ✅ Update task status
- ✅ Manage workflows

**Partnership Management:**
- ✅ Full CRUD on partnerships
- ✅ Manage organizations
- ✅ Track agreements and interactions

**Contacts & Speakers:**
- ✅ Full CRUD on contacts
- ✅ Import/export contacts
- ✅ Manage speaker database

**System Settings:**
- ✅ Configure email (Resend/SMTP)
- ✅ Configure WhatsApp integration
- ✅ Toggle features (file uploads, scrapers, etc.)
- ✅ Customize email templates
- ✅ Manage system-wide settings
- ✅ Access Elasticsearch admin

**Analytics:**
- ✅ View all dashboards
- ✅ Export all data
- ✅ Access executive analytics

**API Endpoints (Superadmin Only):**
```
POST   /api/admin/create-user
DELETE /api/users/:id
POST   /api/stakeholders
PATCH  /api/stakeholders/:id
DELETE /api/stakeholders/:id
POST   /api/settings
GET    /api/settings
```

**Constraints:**
- ⛔ Cannot delete their own account (lockout prevention)
- ⛔ Cannot demote themselves from superadmin
- ⛔ At least one superadmin must exist

---

#### 2. Admin Role (Level 5)

**Purpose:** Day-to-day system management without user administration.

**Capabilities:**

**Event Management:**
- ✅ Full CRUD operations on events
- ✅ Assign stakeholders to events
- ✅ Configure reminder preferences
- ✅ Import events via CSV

**Task Management:**
- ✅ Create and assign tasks
- ✅ Delete any task
- ✅ View all tasks
- ✅ Update task status
- ✅ Manage workflows

**Partnership Management:**
- ✅ Full CRUD on partnerships
- ✅ Manage organizations
- ✅ Track interactions

**Contacts:**
- ✅ Full CRUD on contacts
- ✅ Import/export contacts

**Analytics:**
- ✅ View all dashboards
- ✅ Export data

**Communications:**
- ✅ Configure WhatsApp
- ✅ Send test messages
- ✅ Manage email templates

**Limitations:**
- ⛔ Cannot create or manage users
- ⛔ Cannot modify system-wide settings
- ⛔ Cannot access Elasticsearch admin
- ⛔ Cannot create superadmin users

---

#### 3. Division Head Role (Level 4)

**Purpose:** Oversee division operations with analytics access and partnership management.

**Capabilities:**

**Events:**
- ✅ Full CRUD on events
- ✅ Assign stakeholders
- ✅ Manage event details

**Tasks:**
- ✅ Create and assign tasks
- ✅ View all tasks
- ✅ Update task status

**Partnerships:**
- ✅ Full CRUD on partnerships
- ✅ Manage organizations
- ✅ Track interactions and agreements

**Contacts:**
- ✅ Full CRUD on contacts
- ✅ Manage speaker database

**Analytics:**
- ✅ View all dashboards
- ✅ Executive analytics
- ✅ Export reports
- ✅ Partnership analytics

**Limitations:**
- ⛔ Cannot create users
- ⛔ Cannot modify system settings
- ⛔ Cannot delete events (only admin+)
- ⛔ Cannot access Elasticsearch admin

---

#### 4. Department Admin Role (Level 4)

**Purpose:** Department-scoped administrator with communications privileges.

**Capabilities:**
- ✅ Manage department users
- ✅ Create/edit weekly/monthly updates
- ✅ Send updates to department
- ✅ Access department dashboard
- ✅ View department events and tasks

**Constraints:**
- ⛔ No access to cross-department data
- ⛔ No global user management
- ⛔ Cannot create events

---

#### 5. Events Lead Role (Level 3)

**Purpose:** Manage events and coordinate event-related activities.

**Capabilities:**

**Events:**
- ✅ Create new events
- ✅ Edit existing events
- ✅ Assign stakeholders
- ✅ Configure reminders
- ✅ Manage event media/photos

**Tasks:**
- ✅ Create tasks related to events
- ✅ Assign tasks to departments
- ✅ Update task status
- ✅ View all tasks

**Contacts:**
- ✅ Create and edit contacts
- ✅ Manage speakers
- ✅ Assign contacts to events

**Invitations:**
- ✅ Send event invitations
- ✅ Manage attendee lists
- ✅ Track RSVPs

**Limitations:**
- ⛔ Cannot delete events (admin+ only)
- ⛔ Cannot manage partnerships
- ⛔ Cannot view analytics dashboards
- ⛔ Cannot create users
- ⛔ Cannot modify system settings

---

#### 6. Department Role (Level 2)

**Purpose:** Department-level access to assigned events and tasks.

**Capabilities:**

**Dashboard Access:**
- ✅ Personal dashboard with assigned events
- ✅ View upcoming events
- ✅ View past events
- ✅ Filter by status

**Task Management:**
- ✅ View tasks for assigned events
- ✅ Update task status
- ✅ Add comments to tasks
- ✅ Upload attachments (if enabled)

**Event Viewing:**
- ✅ View all public events
- ✅ Cannot see other department assignments
- ✅ View own assignment details

**Profile:**
- ✅ Change own password
- ✅ View profile info

**Strict Limitations:**
- ⛔ Cannot create/edit/delete events
- ⛔ Cannot create tasks
- ⛔ Cannot view tasks for unassigned events
- ⛔ Cannot access admin pages
- ⛔ Cannot view analytics

---

#### 7. Employee Role (Level 1)

**Purpose:** Execute assigned tasks and update status.

**Capabilities:**

**Tasks:**
- ✅ View assigned tasks only
- ✅ Update task status (pending → in progress → completed)
- ✅ Add comments to assigned tasks
- ✅ Upload attachments to comments

**Events:**
- ✅ View public events
- ✅ View events related to assigned tasks

**Profile:**
- ✅ Change own password
- ✅ View profile

**Limitations:**
- ⛔ Cannot create events
- ⛔ Cannot create tasks
- ⛔ Cannot view tasks not assigned to them
- ⛔ Cannot manage contacts
- ⛔ Cannot access analytics
- ⛔ Cannot manage partnerships

---

#### 8. Viewer Role (Level 0)

**Purpose:** Read-only access for auditors, observers, or external stakeholders.

**Capabilities:**

**View Only:**
- ✅ View all events
- ✅ View public event details
- ✅ View partnerships (read-only)
- ✅ View contacts (read-only)
- ✅ View public dashboards

**Profile:**
- ✅ View own profile
- ✅ Change own password

**Strict Limitations:**
- ⛔ **Cannot create anything**
- ⛔ **Cannot edit anything**
- ⛔ **Cannot delete anything**
- ⛔ Cannot update tasks
- ⛔ Cannot comment
- ⛔ Cannot upload files
- ⛔ Read-only access everywhere

**Use Cases:**
- External auditors
- Board members
- External partners (view-only)
- Temporary observers

---

### Middleware Guards

The application uses role-based middleware to protect routes:

#### 1. `isAuthenticated`
**Purpose:** Requires any logged-in user.
**Usage:** Applied to all protected routes.

#### 2. `isSuperAdmin`
**Purpose:** Requires superadmin role.
**Usage:** User management, system settings.

#### 3. `isAdminOrSuperAdmin`
**Purpose:** Requires admin or superadmin.
**Usage:** Event deletion, workflow management.

#### 4. `isDivisionHeadOrHigher`
**Purpose:** Requires division_head, admin, or superadmin.
**Usage:** Partnership management, analytics.

#### 5. `isEventsLeadOrHigher`
**Purpose:** Requires events_lead, division_head, admin, or superadmin.
**Usage:** Event creation/editing, contact management.

#### 6. `isEmployeeOrHigher`
**Purpose:** Requires employee or higher (excludes viewer).
**Usage:** Task updates, comments.

#### 7. `isNotViewer`
**Purpose:** Any role except viewer.
**Usage:** Any write operation.

#### 8. `isDepartmentMemberOrAdmin`
**Purpose:** Department users and admins.
**Usage:** Department-scoped resources.

**Example Usage:**
```typescript
// Event creation - requires events_lead or higher
app.post("/api/events", isEventsLeadOrHigher, async (req, res) => {
  // Only events_lead, division_head, admin, superadmin can create
});

// Partnership management - requires division_head or higher
app.post("/api/partnerships", isDivisionHeadOrHigher, async (req, res) => {
  // Only division_head, admin, superadmin can create
});

// Task updates - requires employee or higher
app.patch("/api/tasks/:id", isEmployeeOrHigher, async (req, res) => {
  // Everyone except viewer can update tasks
});

// User creation - requires superadmin only
app.post("/api/admin/create-user", isSuperAdmin, async (req, res) => {
  // Only superadmin can create users
});
```

---

## Frontend Role Utilities

The frontend provides role checking utilities in `client/src/lib/roles.ts`:

### Permission Check Functions

```typescript
// Import utilities
import { 
  canCreateEvents, 
  canEditEvents,
  canManagePartnerships,
  canUpdateTasks,
  isReadOnly,
  hasRoleLevel
} from '@/lib/roles';

// Usage examples
const { user } = useAuth();

// Check if user can create events
if (canCreateEvents(user?.role)) {
  // Show create event button
}

// Check if user is read-only
if (isReadOnly(user?.role)) {
  // Disable all edit functionality
}

// Check role level (for hierarchical checks)
if (hasRoleLevel(user?.role, 'division_head')) {
  // User is division_head or higher
}
```

### Available Functions

| Function | Description |
|----------|-------------|
| `canCreateEvents(role)` | Can create new events |
| `canEditEvents(role)` | Can edit existing events |
| `canDeleteEvents(role)` | Can delete events (admin+) |
| `canManagePartnerships(role)` | Can manage partnerships |
| `canManageContacts(role)` | Can manage contacts |
| `canUpdateTasks(role)` | Can update tasks |
| `canCreateTasks(role)` | Can create tasks |
| `canViewAnalytics(role)` | Can view analytics |
| `isReadOnly(role)` | Is viewer (read-only) |
| `canCreateUsers(role)` | Can create users (superadmin) |
| `hasRoleLevel(role, required)` | Has minimum role level |

---

## Current Security Features

### Authentication & Authorization

**✅ Secure Password Hashing:**
- Scrypt algorithm (Node.js crypto)
- 32-byte random salt
- 64-byte derived key
- Memory-hard function (resistant to GPU attacks)

**✅ Session Management:**
- HTTP-only cookies
- Server-side session storage (PostgreSQL)
- 7-day session expiration
- Automatic cleanup of expired sessions

**✅ Role-Based Access Control:**
- 8-tier role hierarchy
- Middleware guards on all protected routes
- Frontend role utilities for UI permissions
- Database-level isolation for department data

**✅ Keycloak SSO Integration:**
- OpenID Connect support
- Automatic user provisioning
- Group-based role mapping
- LDAP synchronization

### Input Validation

**✅ Zod Schema Validation:**
- All API inputs validated
- Type-safe validation
- Custom error messages
- Same schemas on frontend and backend

**✅ SQL Injection Prevention:**
- Drizzle ORM with parameterized queries
- No raw SQL concatenation
- Type-safe database operations

### File Upload Security

**✅ File Type Restrictions:**
- Whitelist of allowed MIME types
- File extension validation
- Magic number validation (file content check)

**✅ File Size Limits:**
- 10MB per file default
- Configurable in system settings
- Prevents DoS via large uploads

**✅ Global Toggle:**
- Can disable file uploads system-wide
- Useful for high-security environments

**✅ Secure Storage:**
- Files stored outside web root (`uploads/`)
- Served via authenticated API endpoint
- No direct file access

### API Security

**✅ CORS Configuration:**
- Configured for specific origins
- Credentials support enabled
- Preflight request handling

**✅ Rate Limiting (Recommended):**
- Currently not implemented
- **See Future Improvements section**

---

## Security Constraints & Limitations

### Current Limitations

**⚠️ No Rate Limiting:**
- Vulnerable to brute force attacks
- No request throttling
- **Priority: High** (see Future Improvements)

**⚠️ No Audit Logging:**
- No tracking of admin actions
- Difficult to investigate security incidents
- **Priority: High** (see Future Improvements)

**⚠️ No Two-Factor Authentication:**
- Single factor (password) only
- Higher risk for privileged accounts
- **Priority: Medium** (see Future Improvements)

**⚠️ No IP Whitelisting:**
- Admin access from any IP
- No geographic restrictions
- **Priority: Low** (situational)

**⚠️ Session Fixation:**
- Session ID doesn't rotate on login
- Potential session hijacking risk
- **Priority: Medium** (see Future Improvements)

**⚠️ No Security Headers:**
- Missing CSP, HSTS, X-Frame-Options
- **Priority: Low** (easy to add)

---

## Future Security Improvements

### High Priority

#### 1. Rate Limiting

**Description:** Protect against brute force and DoS attacks.

**Implementation:**
```typescript
import rateLimit from 'express-rate-limit';

// Login endpoint rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/login', loginLimiter, ...);

// Global API rate limiting
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
});

app.use('/api/', apiLimiter);
```

**Benefits:**
- Prevents brute force attacks
- Protects against DoS
- Improves system stability

**Estimated Effort:** Low (1-2 hours)

---

#### 2. Audit Logging

**Description:** Track all administrative actions for security and compliance.

**Implementation:**
```typescript
// Create audit_logs table
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

// Log function
async function logAudit(userId, action, resource, details) {
  await db.insert(auditLogs).values({
    userId,
    action,
    resourceType: resource.type,
    resourceId: resource.id,
    details,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
}

// Usage
app.delete('/api/events/:id', isAdminOrSuperAdmin, async (req, res) => {
  await storage.deleteEvent(req.params.id);
  await logAudit(req.user.id, 'DELETE_EVENT', { 
    type: 'event', 
    id: req.params.id 
  });
});
```

**Benefits:**
- Security incident investigation
- Compliance requirements
- User accountability

**Estimated Effort:** Medium (1-2 days)

---

### Medium Priority

#### 3. Two-Factor Authentication (2FA)

**Description:** Add optional 2FA for admin and superadmin accounts.

**Implementation:**
- TOTP (Time-based One-Time Password)
- QR code generation for authenticator apps
- Backup codes for recovery
- Optional enforcement per role

**Benefits:**
- Enhanced account security
- Protects privileged accounts
- Industry best practice

**Estimated Effort:** Medium (2-3 days)

---

#### 4. Session Rotation on Login

**Description:** Generate new session ID after successful authentication.

**Implementation:**
```typescript
app.post('/api/login', passport.authenticate('local'), (req, res) => {
  req.session.regenerate((err) => {
    if (err) return next(err);
    // Continue with login
  });
});
```

**Benefits:**
- Prevents session fixation attacks
- Enhanced security

**Estimated Effort:** Low (1 hour)

---

### Low Priority

#### 5. Security Headers (Helmet.js)

**Description:** Add security headers to responses.

**Implementation:**
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}));
```

**Benefits:**
- Browser-level security
- Clickjacking prevention
- XSS mitigation

**Estimated Effort:** Low (few hours)

---

## Production Deployment Checklist

### Pre-Deployment Security

- [ ] Change default superadmin password
- [ ] Generate strong SESSION_SECRET (32+ chars)
- [ ] Use strong database password
- [ ] Enable HTTPS/TLS
- [ ] Configure firewall
- [ ] Set `NODE_ENV=production`
- [ ] Review `.env` file
- [ ] Ensure `.env` not in Git
- [ ] Configure email provider
- [ ] Test email delivery
- [ ] Review CORS configuration
- [ ] Enable security headers
- [ ] Set up database backups
- [ ] Configure monitoring
- [ ] Implement rate limiting
- [ ] Review user roles and permissions

### Production Security Recommendations

1. **Use HTTPS Only**
   - TLS certificate (Let's Encrypt)
   - Redirect HTTP to HTTPS
   - HSTS header enabled

2. **Reverse Proxy**
   - nginx or Caddy
   - Rate limiting at proxy level
   - SSL termination
   - Static file serving

3. **Database Security**
   - Restrict network access
   - Strong passwords
   - Regular backups
   - Encrypted connections

4. **Monitoring**
   - Application logs
   - Failed login attempts
   - Error rates
   - Response times
   - Disk usage

5. **Regular Updates**
   - `npm audit` regularly
   - Update Node.js
   - Update PostgreSQL
   - Security patches

6. **Backup Strategy**
   - Daily database backups
   - Backup uploads directory
   - Test restore procedures
   - Off-site storage

---

## Summary

This application implements a robust **eight-tier RBAC system** with comprehensive security features:

**✅ Role System:**
- 8 distinct roles with clear hierarchy
- Granular permission control
- Frontend and backend enforcement

**✅ Authentication:**
- Secure password hashing (scrypt)
- Session management
- Keycloak SSO support

**✅ Authorization:**
- Role-based middleware
- Permission check utilities
- Department-level isolation

**✅ Input Security:**
- Zod validation
- SQL injection prevention
- File upload controls

**⚠️ Priority Improvements:**
1. **Rate limiting** - Prevent brute force
2. **Audit logging** - Track admin actions
3. **2FA** - Enhanced account security

**Key Takeaways:**
- Strong role separation (8 levels)
- Secure authentication
- Input validation
- File upload controls
- Ready for production with recommended improvements

For questions or security concerns, review this document and consult with the development team.

---

**Last Updated:** January 29, 2026  
**Version:** 2.0 (Added new roles: viewer, employee, events_lead, division_head)