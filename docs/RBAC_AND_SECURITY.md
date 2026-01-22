# Role-Based Access Control & Security Guide

This document details the complete role-based access control system, security features, and future improvement plans for the ECSSR Events Calendar application.

## 📋 Table of Contents

1. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
2. [Current Security Features](#current-security-features)
3. [Security Constraints & Limitations](#security-constraints--limitations)
4. [Future Security Improvements](#future-security-improvements)
5. [Future Feature Enhancements](#future-feature-enhancements)

---

## Role-Based Access Control (RBAC)

### Overview

The application implements a four-tier role system with hierarchical privileges:
- **Superadmin** (highest privileges)
- **Admin** (standard administrative privileges)
- **Department Admin** (department-scoped admin with elevated communications permissions)
- **Department** (limited access, department-focused - formerly called Stakeholder)

All roles are stored in the `users` table with a `role` field.

---

### Role Definitions

#### 1. Superadmin Role

**Purpose:** System owner with full control over all features and users.

**Capabilities:**

**User Management:**
- ✅ Create new admin users
- ✅ Create new superadmin users
- ✅ Delete any user (except their own account - lockout prevention)
- ✅ View all users in the system
- ✅ Change any user's password (future feature)

**Event Management:**
- ✅ Full CRUD operations on events
- ✅ Assign stakeholders to events
- ✅ Configure reminder preferences
- ✅ Import events via CSV
- ✅ Bulk delete events
- ✅ View expected attendance (hidden from public)

**Stakeholder Management:**
- ✅ Create, edit, delete stakeholders
- ✅ Manage stakeholder emails
- ✅ Manage requirement templates
- ✅ Create stakeholder accounts (links stakeholders to users)
- ✅ Deactivate stakeholders

**Task Management:**
- ✅ Create tasks for stakeholders
- ✅ Delete any task
- ✅ View all tasks
- ✅ Assign tasks to events
- ✅ Update task status

**Reminder Management:**
- ✅ View reminder queue
- ✅ Manually trigger reminders
- ✅ Delete reminders
- ✅ Configure reminder schedules

**System Settings:**
- ✅ Configure email (Resend/SMTP)
- ✅ Configure WhatsApp integration
- ✅ Toggle public CSV export
- ✅ Toggle file uploads globally
- ✅ Toggle scraped events feature
- ✅ Customize email templates
- ✅ Configure CC lists for all email types

**Communications:**
- ✅ Configure WhatsApp settings
- ✅ Send test messages
- ✅ Reset WhatsApp session
- ✅ Configure email templates and styling

**Updates Management:**
- ✅ Create/edit weekly updates
- ✅ Create/edit monthly updates
- ✅ View historical updates

**API Endpoints (Superadmin Only):**
```
POST   /api/admin/create-user
DELETE /api/users/:id
POST   /api/stakeholders
PATCH  /api/stakeholders/:id
DELETE /api/stakeholders/:id
POST   /api/settings
GET    /api/settings
POST   /api/stakeholder-accounts
DELETE /api/stakeholder-accounts/:id
```

**Constraints:**
- ⛔ Cannot delete their own account (lockout prevention)
- ⛔ Cannot demote themselves from superadmin
- ⛔ At least one superadmin must exist (bootstrap protection)

---

#### 2. Admin Role

**Purpose:** Day-to-day event and stakeholder management without system-level changes.

**Capabilities:**

**Event Management:**
- ✅ Full CRUD operations on events
- ✅ Assign stakeholders to events
- ✅ Configure reminder preferences
- ✅ Import events via CSV
- ✅ View expected attendance (hidden from public)

**Task Management:**
- ✅ Create tasks for stakeholders
- ✅ Delete tasks they created
- ✅ View all tasks
- ✅ Assign tasks to events
- ✅ Update task status

**Stakeholder Assignment:**
- ✅ Assign stakeholders to events
- ✅ Select requirements for stakeholders
- ✅ Add custom requirements
- ✅ Configure notification preferences

**Reminder Management:**
- ✅ View reminder queue
- ✅ Manually trigger reminders

**Communications (Limited):**
- ✅ Configure WhatsApp settings
- ✅ Send test messages (to verify configuration)
- ✅ View WhatsApp status

**Updates Management:**
- ✅ Create/edit weekly updates
- ✅ Create/edit monthly updates
- ✅ View historical updates

**API Endpoints (Admin + Superadmin):**
```
POST   /api/events
PATCH  /api/events/:id
DELETE /api/events/:id
POST   /api/tasks
DELETE /api/tasks/:id
PATCH  /api/tasks/:id
POST   /api/event-stakeholders
GET    /api/reminders
POST   /api/reminders/trigger
POST   /api/updates
GET    /api/whatsapp/status
POST   /api/whatsapp/send-test
```

**Limitations:**
- ⛔ Cannot create users
- ⛔ Cannot delete users
- ⛔ Cannot modify system settings (email, file uploads, etc.)
- ⛔ Cannot create/edit/delete stakeholders (only assign existing ones)
- ⛔ Cannot manage stakeholder accounts
- ⛔ Cannot access superadmin-only settings

---

#### 3. Department Admin Role

**Purpose:** Department-scoped administrator who can manage their own department's updates and communications.

**Capabilities:**

- ✅ Inherits department-scoped visibility for events, tasks, and updates
- ✅ Create and edit weekly/monthly updates for their department
- ✅ Trigger "Send to primary email" for the current period's update (uses the department account's primary email)
- ✅ Access the stakeholder dashboard for their department

**Constraints:**

- ⛔ No access to cross-department data
- ⛔ No global user management

#### 4. Stakeholder Role

**Purpose:** Limited access for external stakeholders to view assigned events and manage tasks.

**Capabilities:**

**Dashboard Access:**
- ✅ Personal dashboard showing events they're assigned to
- ✅ View upcoming events they're assigned to
- ✅ View past events they were assigned to
- ✅ Filter events by status

**Task Management:**
- ✅ View ONLY tasks for events they're assigned to
- ✅ Update task status (pending → in progress → completed)
- ✅ Add comments to tasks they can access
- ✅ Upload file attachments to comments (if enabled globally)
- ✅ Download attachments from comments

**Event Viewing:**
- ✅ View ALL public events (calendar is public)
- ✅ Cannot see which stakeholders are assigned to other events
- ✅ Can only see their own assignment details
- ✅ View requirements assigned to them for their events
- ✅ View custom requirements for their assignments

**Profile Management:**
- ✅ Change their own password
- ✅ View their profile information
- ✅ Track last login time

**API Endpoints (Stakeholder Can Access):**
```
GET    /api/events                    (Public - all users)
GET    /api/events/:id                (Public - all users)
GET    /api/events/:eventId/stakeholders  (Filtered - only their assignment)
GET    /api/event-stakeholders/:id/tasks  (Filtered - only if assigned)
GET    /api/tasks/:id                     (Filtered - only if assigned)
PATCH  /api/tasks/:id                     (Filtered - only status updates on assigned tasks)
POST   /api/tasks/:id/comments            (Filtered - only on assigned tasks)
POST   /api/tasks/:id/comments/:commentId/attachments  (Filtered - only on assigned tasks)
GET    /api/uploads/:filename             (Authenticated)
POST   /api/user/change-password          (Own account only)
```

**Strict Limitations:**
- ⛔ Can view calendar events, but cannot see stakeholder assignments for other events
- ⛔ Cannot create/edit/delete events
- ⛔ Cannot view tasks for events they're not assigned to
- ⛔ Cannot create tasks
- ⛔ Cannot delete tasks or comments
- ⛔ Cannot access admin pages (redirected to dashboard)
- ⛔ Cannot view reminder queue
- ⛔ Cannot configure any settings
- ⛔ Cannot view user management
- ⛔ Cannot view which stakeholders are assigned to which events (unless it's their own)
- ⛔ Cannot upload files if globally disabled
- ⛔ Cannot access other stakeholders' task data

**Data Isolation:**
- **Calendar Events:** PUBLIC (everyone can view)
- **Stakeholder Assignments:** RESTRICTED (stakeholders only see if THEY are assigned)
- **Tasks:** RESTRICTED (stakeholders only access tasks for events they're assigned to)
- **Task Comments:** RESTRICTED (only if they can access the parent task)
- **File Uploads:** RESTRICTED (only if they can access the parent task)
- Stakeholder users linked via `stakeholder_accounts` table
- Multiple users can belong to same stakeholder (department-level access)
- Authorization checks enforce data isolation on tasks/comments/assignments

---

### Middleware Guards

Three middleware functions enforce role-based access:

#### 1. `isAuthenticated`
**Purpose:** Requires any logged-in user (any role).

**Usage:**
```typescript
app.get("/api/tasks/:id", isAuthenticated, async (req, res) => {
  // Any logged-in user can access (with additional checks for stakeholders)
  // Actual implementation includes role-based filtering
});
```

**Behavior:**
- Returns 401 Unauthorized if not logged in
- Allows superadmin, admin, and stakeholder
- Note: Many endpoints with `isAuthenticated` also include role-specific logic

---

#### 2. `isAdminOrSuperAdmin`
**Purpose:** Requires admin or superadmin role (blocks stakeholders).

**Usage:**
```typescript
app.post("/api/events", isAdminOrSuperAdmin, async (req, res) => {
  // Only admins and superadmins can create events
});
```

**Behavior:**
- Returns 401 Unauthorized if not logged in
- Returns 403 Forbidden if role is 'stakeholder'
- Allows admin and superadmin

**Common Use Cases:**
- Event CRUD operations
- Task creation/deletion
- Reminder management
- WhatsApp configuration
- Updates management

---

#### 3. `isSuperAdmin`
**Purpose:** Requires superadmin role only.

**Usage:**
```typescript
app.post("/api/admin/create-user", isSuperAdmin, async (req, res) => {
  // Only superadmins can create users
});
```

**Behavior:**
- Returns 401 Unauthorized if not logged in
- Returns 403 Forbidden if role is not 'superadmin'
- Only allows superadmin

**Common Use Cases:**
- User creation/deletion
- Stakeholder CRUD
- System settings modification
- Stakeholder account management

---

### Frontend Protection

**Route Protection:**
```typescript
// Admin pages protected
if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
  return <Redirect to="/stakeholder/dashboard" />;
}

// Stakeholder redirect
if (user?.role === 'stakeholder' && location !== '/stakeholder/dashboard') {
  return <Redirect to="/stakeholder/dashboard" />;
}
```

**Conditional UI Rendering:**
- Admin action buttons hidden from stakeholders
- Superadmin-only features hidden from admins
- Sidebar menu items filtered by role
- Settings toggles only visible to superadmin

---

### Migration: Adding Department Admin Role

Follow these steps when introducing the `department_admin` role to an existing environment:

1. **Create the realm role in Keycloak** – rerun the Keycloak setup script or manually add a new realm role named `department_admin`.
2. **Assign the role to department leads** – in Keycloak, grant `department_admin` to users who should be able to send update emails and keep them in the appropriate department group so their `department_accounts` link remains intact.
3. **Update local role records** – for existing department users that should become department admins, run a targeted SQL update, for example:
   ```sql
   UPDATE users SET role = 'department_admin' WHERE role = 'department' AND username IN ('dept.lead1', 'dept.lead2');
   ```
4. **Verify primary email configuration** – ensure each department admin has a `department_accounts.primary_email_id` value pointing to the department's primary entry in `department_emails` so the new send action can resolve the destination address.

---

## Current Security Features

### 1. Authentication

**Password Security:**
- **Hashing Algorithm:** Scrypt (Node.js built-in crypto)
  - 32-byte salt (cryptographically random)
  - 64-byte hash output
  - High memory and CPU cost parameters
  - Resistant to GPU/ASIC attacks
- **Minimum Length:** 6 characters (enforced)
- **Storage:** Hashed passwords never exposed via API

**Session Management:**
- **Session Store:** PostgreSQL (`connect-pg-simple`)
- **Session Cookie:**
  - HTTP-only flag (prevents JavaScript access)
  - Secure flag in production (HTTPS only)
  - Max age: 7 days
  - SameSite protection (CSRF mitigation)
- **Session Persistence:** Survives application restart
- **Auto Cleanup:** Expired sessions removed automatically

**Login Flow:**
1. User submits credentials
2. Passport.js authenticates via LocalStrategy
3. Password verified using scrypt
4. Session created in PostgreSQL
5. Session ID stored in HTTP-only cookie
6. Password never sent in response

**Logout:**
- Destroys session in database
- Clears cookie
- Returns 200 status

---

### 2. Authorization

**Hierarchical Role System:**
- Three distinct roles with clear boundaries
- Middleware guards on every protected route
- Frontend role checks prevent unauthorized UI access
- Backend enforcement prevents API bypass

**Superadmin Protection:**
- At least one superadmin always exists
- Superadmin cannot delete themselves (lockout prevention)
- Bootstrap superadmin created from environment variables
- Superadmin deletion blocked if only one exists

**Stakeholder Data Isolation:**
- Stakeholders only see their assigned events
- Stakeholder accounts link users to organizations
- Queries filtered by stakeholder association
- No cross-stakeholder data leakage

---

### 3. Input Validation

**Zod Schema Validation:**
- All API inputs validated with Zod
- Same schemas used on frontend and backend
- Type-safe at runtime and compile-time
- Friendly error messages via `zod-validation-error`

**SQL Injection Prevention:**
- Drizzle ORM with parameterized queries
- No raw SQL in application code
- Database-level constraints and validations

**XSS Prevention:**
- React auto-escapes JSX
- HTML content sanitized where needed
- No `dangerouslySetInnerHTML` without sanitization
- Content Security Policy headers (recommended for production)

---

### 4. File Upload Security

**Global Toggle:**
- Superadmin can disable file uploads entirely
- Setting: `fileUploadsEnabled` (default: false)
- When disabled, upload endpoints return 400

**File Type Restrictions:**
- **Allowed Types:**
  - Images: jpg, jpeg, png, gif, webp
  - Documents: pdf
  - Archives: zip
- **Blocked:** Executable files, scripts, etc.

**File Size Limit:**
- Maximum: 10MB per file
- Enforced at upload endpoint
- Returns 400 if exceeded

**Storage:**
- Files stored in `uploads/` directory
- Filenames include timestamp + nanoid (prevents collisions)
- Not served directly via static middleware
- Accessed only via authenticated endpoint: `/api/uploads/:filename`

**Access Control:**
- Only authenticated users can upload
- Only authenticated users can download
- No public file access
- File path validation prevents directory traversal

---

### 5. Environment Security

**Secret Management:**
- Secrets stored in `.env` file (never committed to Git)
- `.env` in `.gitignore`
- Docker secrets via environment variables
- Required secrets validated on startup

**Critical Secrets:**
- `SESSION_SECRET` - Session encryption (32+ characters recommended)
- `DATABASE_URL` - Database connection string
- `RESEND_API_KEY` or SMTP credentials - Email service
- `SUPERADMIN_USERNAME` - Initial admin username
- `SUPERADMIN_PASSWORD` - Initial admin password

**Secret Rotation:**
- Session secret can be changed (invalidates existing sessions)
- Database credentials rotated externally
- API keys rotated via provider dashboards

---

### 6. Database Security

**Connection Security:**
- TLS/SSL encryption for production (PostgreSQL)
- Connection pooling for performance
- No hardcoded credentials

**Data Protection:**
- Passwords hashed (never plain text)
- Sensitive fields (expected attendance) hidden from public
- Foreign key constraints for referential integrity
- Cascade deletes where appropriate

**Session Storage:**
- Sessions in PostgreSQL (not memory)
- Automatic expiration cleanup
- Session table indexed for performance

---

### 7. API Security

**CORS Configuration:**
- Same-origin policy enforced
- No wildcard CORS in production
- Credentials included in requests

**Rate Limiting:**
- ⚠️ **Not implemented** - See [Future Improvements](#future-security-improvements)

**Request Size Limits:**
- Express body parser limits
- File upload limits (10MB)
- Prevents DoS via large payloads

---

### 8. WhatsApp Integration Security

**Session Protection:**
- WhatsApp session files stored locally
- Not accessible via web server
- Mutex prevents concurrent access
- Session invalidated on errors

**QR Code Security:**
- QR codes cached for 5 minutes
- Regenerated on expiry
- Not logged or stored permanently

**Message Queuing:**
- Messages queued before sending
- Retry logic for failed sends
- Error handling prevents crashes

---

## Security Constraints & Limitations

### Current Known Limitations

1. **No Two-Factor Authentication (2FA)**
   - Users rely solely on passwords
   - Admins with access to sensitive data lack 2FA
   - **Mitigation:** Strong password policy (min 6 chars, recommend 12+)

2. **No Rate Limiting**
   - Login endpoint not rate-limited
   - Brute-force attacks possible
   - **Mitigation:** Monitor failed login attempts manually

3. **No Account Lockout**
   - Unlimited login attempts allowed
   - No temporary lockout after failures
   - **Mitigation:** Manual monitoring, strong passwords

4. **No Email Verification**
   - Email addresses not verified
   - Typos could cause delivery failures
   - **Mitigation:** Test email functionality in settings

5. **No Audit Logging**
   - User actions not logged (who created/edited/deleted what)
   - No compliance trail
   - **Mitigation:** Database change history only (no user attribution)

6. **No Content Security Policy (CSP)**
   - No CSP headers in production
   - Vulnerable to XSS if React sanitization bypassed
   - **Mitigation:** Avoid `dangerouslySetInnerHTML`

7. **Limited Password Requirements**
   - Only minimum length enforced (6 characters)
   - No complexity requirements (uppercase, numbers, symbols)
   - **Mitigation:** Educate users on strong passwords

8. **File Upload Validation**
   - File type validation based on extension (not magic bytes)
   - Malicious files could be renamed to bypass
   - **Mitigation:** Global toggle allows disabling uploads

9. **No IP Whitelisting**
   - Admin panel accessible from any IP
   - No geographic restrictions
   - **Mitigation:** VPN or firewall rules at network level

10. **Session Timeout**
    - Fixed 7-day session expiry
    - No idle timeout
    - **Mitigation:** Users must manually logout

---

### File Upload Risks

**Risk:** Malicious file uploads

**Current Mitigations:**
- Global toggle (superadmin can disable)
- File type whitelist
- 10MB size limit
- Authenticated access only
- Files not served via static middleware

**Remaining Risks:**
- Zip bombs (compressed malicious content)
- PDF exploits (if opened in vulnerable viewer)
- Image-based exploits (EXIF data)

**Recommendation:** Keep uploads disabled unless absolutely necessary.

---

## Future Security Improvements

### High Priority (Recommended)

#### 1. Two-Factor Authentication (2FA)

**Description:** Add TOTP-based 2FA for admin and superadmin accounts.

**Implementation Plan:**
- Use `speakeasy` or `otplib` for TOTP generation
- Add `twoFactorSecret` field to users table
- Create setup flow with QR code generation
- Require 2FA code at login for admins
- Backup codes for account recovery

**Benefits:**
- Prevents account takeover even with stolen passwords
- Compliance with security best practices
- Protects sensitive admin functions

**Estimated Effort:** Medium (2-3 days)

---

#### 2. Rate Limiting

**Description:** Implement rate limiting on authentication endpoints.

**Implementation Plan:**
- Use `express-rate-limit` middleware
- Limit login attempts: 5 per 15 minutes per IP
- Limit password change: 3 per hour per user
- Limit API requests: 100 per minute per user
- Configurable limits in settings

**Benefits:**
- Prevents brute-force attacks
- Mitigates DoS attempts
- Protects against credential stuffing

**Estimated Effort:** Low (1 day)

---

#### 3. Audit Logging

**Description:** Log all significant user actions for compliance and security.

**Implementation Plan:**
- Create `audit_logs` table
- Log: user ID, action, resource type, resource ID, timestamp, IP
- Track: create, update, delete operations
- Superadmin-only access to audit logs
- Retention policy (e.g., 90 days)

**Benefits:**
- Accountability and compliance
- Security incident investigation
- User activity tracking

**Estimated Effort:** Medium (2-3 days)

---

#### 4. Account Lockout

**Description:** Temporarily lock accounts after failed login attempts.

**Implementation Plan:**
- Track failed login attempts per user
- Lock account after 5 failed attempts
- Lockout duration: 15 minutes
- Email notification to user on lockout
- Unlock via email link or admin intervention

**Benefits:**
- Prevents brute-force attacks
- Notifies users of suspicious activity
- Industry standard security practice

**Estimated Effort:** Low (1-2 days)

---

### Medium Priority

#### 5. Content Security Policy (CSP)

**Description:** Add CSP headers to prevent XSS attacks.

**Implementation Plan:**
- Use `helmet` middleware
- Configure CSP directives
- Allow inline scripts for React
- Whitelist necessary external sources
- Report violations to logging endpoint

**Benefits:**
- Additional XSS protection layer
- Prevents inline script injection
- Browser-level security enforcement

**Estimated Effort:** Low (1 day)

---

#### 6. Advanced File Validation

**Description:** Validate files using magic bytes, not just extensions.

**Implementation Plan:**
- Use `file-type` package for magic byte detection
- Scan uploaded files for actual type
- Reject files with mismatched types
- Optional: virus scanning integration (ClamAV)

**Benefits:**
- Prevents malicious file disguised as safe type
- More reliable than extension checking
- Enhanced file upload security

**Estimated Effort:** Medium (1-2 days)

---

#### 7. Email Verification

**Description:** Verify email addresses before allowing notifications.

**Implementation Plan:**
- Send verification email on stakeholder creation
- Add `emailVerified` field to stakeholder_emails table
- Prevent notifications to unverified emails
- Resend verification link option

**Benefits:**
- Ensures email deliverability
- Prevents typos in email addresses
- Better bounce rate handling

**Estimated Effort:** Medium (2 days)

---

#### 8. Session Security Enhancements

**Description:** Add idle timeout and active session management.

**Implementation Plan:**
- Idle timeout: 30 minutes of inactivity
- Activity tracking via heartbeat endpoint
- Multiple session detection
- "Active Sessions" page for users
- Force logout other sessions option

**Benefits:**
- Automatic logout on inactivity
- User control over active sessions
- Prevents abandoned session exploitation

**Estimated Effort:** Medium (2 days)

---

### Low Priority (Nice to Have)

#### 9. IP Whitelisting

**Description:** Allow admin panel access only from specific IPs.

**Implementation Plan:**
- Add `allowedIps` setting (comma-separated)
- Check IP against whitelist on admin routes
- Return 403 for non-whitelisted IPs
- Bypass for superadmin via secret parameter

**Benefits:**
- Limits attack surface
- Geographic/network restrictions
- Additional access control layer

**Estimated Effort:** Low (1 day)

---

#### 10. API Key Authentication

**Description:** Allow programmatic API access via API keys.

**Implementation Plan:**
- Create `api_keys` table
- Generate keys for users (superadmin only)
- Support `Authorization: Bearer <token>` header
- Scoped permissions for API keys
- Expiration and rotation support

**Benefits:**
- Automation and integration support
- Programmatic event creation
- Webhook support potential

**Estimated Effort:** Medium (2-3 days)

---

#### 11. LDAP/Active Directory Integration

**Description:** Allow authentication via corporate LDAP/AD.

**Implementation Plan:**
- Use `passport-ldapauth` strategy
- Add LDAP configuration to settings
- Link LDAP users to local accounts
- Maintain local auth as fallback
- Support group-based role mapping

**Benefits:**
- Centralized corporate authentication
- Automatic user provisioning
- Single sign-on (SSO) support
- Group-based access control

**Estimated Effort:** High (5-7 days)

---

#### 12. Security Headers

**Description:** Add comprehensive security headers.

**Implementation Plan:**
- Use `helmet` middleware
- Enable: HSTS, X-Frame-Options, X-Content-Type-Options
- Configure Referrer-Policy
- Set Permissions-Policy

**Benefits:**
- Browser-level security enforcement
- Clickjacking prevention
- MIME-sniffing prevention

**Estimated Effort:** Low (few hours)

---

## Future Feature Enhancements

### High Priority

#### 1. Task Due Dates & Notifications

**Description:** Add due dates to tasks with automatic reminders.

**Implementation:**
- Add `dueDate` field to tasks table
- Create reminder scheduler for tasks
- Email/WhatsApp notifications X days before due
- Overdue task highlighting in UI

**Benefits:**
- Better task deadline tracking
- Proactive stakeholder reminders
- Improved task completion rates

**Estimated Effort:** Medium (2-3 days)

---

#### 2. Advanced Reporting & Analytics

**Description:** Generate reports on events, tasks, and stakeholder engagement.

**Implementation:**
- Event summary reports (by month, quarter, year)
- Stakeholder engagement metrics (task completion rates)
- Export to PDF/Excel
- Dashboard with charts and statistics

**Benefits:**
- Data-driven insights
- Performance tracking
- Executive summaries

**Estimated Effort:** High (5-7 days)

---

#### 3. Calendar Export (iCal/ICS)

**Description:** Allow users to export events to their personal calendars.

**Implementation:**
- Generate ICS files for events
- Individual event export
- Bulk calendar export
- Subscribe-able calendar URL (read-only)

**Benefits:**
- Integration with Outlook, Google Calendar, etc.
- Better event visibility
- Reduced manual data entry

**Estimated Effort:** Medium (2-3 days)

---

### Medium Priority

#### 4. Event Categories & Tags

**Description:** Enhanced categorization beyond current category field.

**Implementation:**
- Multiple tags per event
- Tag-based filtering
- Tag management (create, edit, delete)
- Tag-based search

**Benefits:**
- More flexible organization
- Better filtering options
- Improved searchability

**Estimated Effort:** Medium (2-3 days)

---

#### 5. Recurring Events

**Description:** Support for events that repeat on a schedule.

**Implementation:**
- Recurrence rules (daily, weekly, monthly, yearly)
- Edit single occurrence vs. all future
- Exception handling (skip specific dates)
- Bulk operations on series

**Benefits:**
- Reduces manual event creation
- Consistent scheduling
- Common use case support

**Estimated Effort:** High (5-7 days)

---

#### 6. Mobile App (React Native)

**Description:** Native mobile app for stakeholders.

**Implementation:**
- React Native app for iOS and Android
- Push notifications for task updates
- Offline support
- Same backend API

**Benefits:**
- Better mobile UX
- Push notifications
- Increased stakeholder engagement

**Estimated Effort:** Very High (4-6 weeks)

---

### Low Priority

#### 7. Multi-Language Support (i18n)

**Description:** Support for multiple UI languages.

**Implementation:**
- Use `react-i18next` for frontend
- Language switcher in UI
- Translation files for Arabic, English
- Server-side localization for emails

**Benefits:**
- Accessibility for non-English speakers
- Better user experience
- International expansion support

**Estimated Effort:** High (5-7 days)

---

#### 8. Event Approval Workflow

**Description:** Multi-step approval process for event creation.

**Implementation:**
- Draft → Pending → Approved states
- Approval roles (requires admin/superadmin approval)
- Email notifications on status change
- Approval history tracking

**Benefits:**
- Quality control
- Governance compliance
- Multi-stakeholder coordination

**Estimated Effort:** High (5-7 days)

---

#### 9. Custom Fields

**Description:** User-defined fields for events.

**Implementation:**
- Field builder UI (text, number, date, dropdown)
- Store in JSONB column
- Include in filters and search
- Export custom fields

**Benefits:**
- Flexibility for org-specific needs
- No code changes for new requirements
- Adaptable to evolving needs

**Estimated Effort:** High (5-7 days)

---

#### 10. WebSocket Real-Time Updates

**Description:** Live updates without page refresh.

**Implementation:**
- WebSocket server (ws package already installed)
- Real-time event updates
- Real-time task status changes
- Live notifications

**Benefits:**
- Instant updates across users
- Better collaboration
- Modern UX

**Estimated Effort:** Medium (3-4 days)

---

## Security Best Practices for Deployment

### Pre-Deployment Checklist

- [ ] Change default superadmin password
- [ ] Generate strong SESSION_SECRET (32+ characters)
- [ ] Use strong database password
- [ ] Enable HTTPS/TLS (not just HTTP)
- [ ] Configure firewall (allow only necessary ports)
- [ ] Set `NODE_ENV=production`
- [ ] Review and update `.env` file
- [ ] Ensure `.env` is not committed to Git
- [ ] Disable file uploads if not needed
- [ ] Configure email provider (Resend or SMTP)
- [ ] Test email delivery
- [ ] Review CORS configuration
- [ ] Enable security headers (helmet)
- [ ] Set up database backups
- [ ] Configure monitoring and alerts
- [ ] Review audit logs regularly (once implemented)

### Production Security Recommendations

1. **Use HTTPS Only**
   - TLS certificate (Let's Encrypt, Cloudflare, etc.)
   - Redirect HTTP to HTTPS
   - HSTS header enabled

2. **Reverse Proxy**
   - nginx or Caddy in front of application
   - Rate limiting at proxy level
   - Static file serving
   - SSL termination

3. **Database Security**
   - Restrict network access (firewall)
   - Use strong passwords
   - Regular backups
   - Encrypted backups

4. **Monitoring**
   - Application logs
   - Database logs
   - Failed login attempts
   - Error rates
   - Response times

5. **Regular Updates**
   - Keep dependencies updated (`npm audit`)
   - Update Node.js runtime
   - Update PostgreSQL
   - Security patches applied promptly

6. **Backup Strategy**
   - Daily database backups
   - Backup uploads directory
   - Test restore procedures
   - Off-site backup storage

---

## Summary

This application implements a robust three-tier RBAC system with comprehensive security features. While production-ready, several enhancements can further improve security and functionality. Prioritize implementing rate limiting, audit logging, and 2FA for enhanced security. Regular security reviews and updates are essential to maintain a secure application.

**Key Takeaways:**
- ✅ Strong role separation (Superadmin, Admin, Stakeholder)
- ✅ Secure authentication (scrypt, sessions)
- ✅ Input validation (Zod schemas)
- ✅ File upload controls (toggle, limits, types)
- ⚠️ Implement rate limiting
- ⚠️ Add audit logging
- ⚠️ Consider 2FA for admins

For questions or security concerns, review this document and consult with the development team.
