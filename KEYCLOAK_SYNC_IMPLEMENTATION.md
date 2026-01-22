# Keycloak Department Sync Implementation Summary

## Overview

Implemented automatic synchronization of Keycloak groups to departments/stakeholders and their members to users. Users will receive all relevant emails even if they never log in to the application.

## Changes Made

### 1. New Files Created

#### `server/keycloak-admin.ts`
Keycloak Admin Client service that:
- Connects to Keycloak Admin REST API using client credentials
- Fetches all groups from Keycloak
- Fetches all members of each group
- Syncs groups to departments table
- Syncs group members to users table
- Links users to departments via department_accounts table

**Key Functions:**
- `getAllGroups()` - Fetch all Keycloak groups
- `getGroupMembers(groupId)` - Fetch members of a specific group
- `syncGroupsToDepartments()` - Sync all groups to departments
- `syncGroupMembersToUsers(groupPath)` - Sync members of a group to users
- `syncAllGroupsAndMembers()` - Full sync of groups and members
- `getDepartmentEmails(groupPath)` - Get emails directly from Keycloak

#### `server/keycloakSyncScheduler.ts`
Scheduled job for automatic synchronization:
- Runs on server startup (initial sync)
- Runs periodically (default: every hour)
- Configurable via environment variables
- Can be disabled if needed

#### `docs/KEYCLOAK_DEPARTMENT_SYNC.md`
Comprehensive documentation covering:
- Architecture and components
- Configuration steps
- How it works
- API reference
- Troubleshooting guide
- Best practices
- Migration guide

### 2. Modified Files

#### `server/storage.ts`
Added new methods:
- `getDepartmentByKeycloakGroupId(keycloakGroupId)` - Find department by Keycloak group ID

Updated interface `IStorage` to include the new method.

#### `server/routes.ts`
Added API endpoints:
- `GET /api/keycloak/groups` - Fetch all Keycloak groups
- `POST /api/keycloak/sync/groups` - Sync groups to departments
- `POST /api/keycloak/sync/all` - Sync groups and members
- `POST /api/keycloak/sync/group/:groupPath` - Sync specific group members

Added helper function:
- `getDepartmentEmails(departmentId)` - Get all emails for a department (combines department_emails + Keycloak-synced user emails)

Updated email notification logic in event creation and update routes to use `getDepartmentEmails()` instead of directly accessing `stakeholder.emails`.

#### `server/index.ts`
Added startup hook to initialize Keycloak sync scheduler:
```typescript
const { startKeycloakSyncScheduler } = await import("./keycloakSyncScheduler");
startKeycloakSyncScheduler();
```

#### `client/src/pages/Stakeholders.tsx`
Added "Sync Keycloak Groups" button:
- Shows loading spinner during sync
- Displays success/error toast messages
- Triggers manual sync on click
- Updates stakeholder list after sync

#### `.env.example`
Added new environment variables:
```bash
KEYCLOAK_SYNC_ENABLED=true          # Enable/disable automatic sync
KEYCLOAK_SYNC_INTERVAL=3600000      # Sync interval in milliseconds
```

### 3. Database Schema

No schema changes required. Existing schema already supports Keycloak integration:

**departments table:**
- `keycloakGroupId` - Stores Keycloak group path (e.g., "/departments/IT")

**users table:**
- `keycloakId` - Stores Keycloak user ID (sub claim)
- `email` - Stores user email from Keycloak
- `password` - NULL for Keycloak-only users

**department_accounts table:**
- Links users to departments (many-to-many)

## How It Works

### 1. Group Sync Flow

```
Keycloak Groups
    ↓
[GET /realms/{realm}/groups]
    ↓
Parse groups (including subgroups)
    ↓
For each group:
  - Check if department exists (by keycloakGroupId)
  - Create department if not exists
  - Store group path in keycloakGroupId field
    ↓
Departments created/updated
```

### 2. User Sync Flow

```
For each Keycloak group:
    ↓
[GET /realms/{realm}/groups/{groupId}/members]
    ↓
For each member:
  - Check if user exists (by keycloakId)
  - Create user if not exists
  - Update email if changed
  - Link user to department (department_accounts)
    ↓
Users synced and linked to departments
```

### 3. Email Notification Flow

```
Event assigned to department
    ↓
getDepartmentEmails(departmentId)
    ↓
Fetch department_emails + user emails
    ↓
Deduplicate emails
    ↓
Send notification to all unique emails
```

## Configuration

### Required Environment Variables

```bash
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=ecssr-events
KEYCLOAK_CLIENT_ID=ecssr-events-app
KEYCLOAK_CLIENT_SECRET=your-client-secret-here
```

### Optional Environment Variables

```bash
KEYCLOAK_SYNC_ENABLED=true          # Default: true
KEYCLOAK_SYNC_INTERVAL=3600000      # Default: 1 hour
```

### Keycloak Client Configuration

The client must have:
1. **Service Account Enabled**: Yes
2. **Service Account Roles**:
   - `view-users`
   - `view-clients`
   - `view-realm`
   - `query-groups`
   - `query-users`

## Usage

### Automatic Sync

The system automatically syncs:
- On server startup
- Every hour (configurable)

### Manual Sync via UI

1. Go to Stakeholders page
2. Click "Sync Keycloak Groups" button
3. Wait for success message

### Manual Sync via API

```bash
curl -X POST http://localhost:5000/api/keycloak/sync/all \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Benefits

### 1. No Login Required
Users receive emails even if they never log in to the application. The sync runs automatically in the background.

### 2. Automatic Membership Updates
When users are added/removed from Keycloak groups, they are automatically added/removed from departments within the configured sync interval.

### 3. Centralized User Management
Users are managed in Keycloak, not in the application. Changes in Keycloak are reflected in the application automatically.

### 4. Email Deduplication
If a user's email is in both department_emails and user records, they only receive one email (automatic deduplication).

### 5. Backward Compatibility
The system continues to support:
- Manual department creation
- Direct department emails (department_emails table)
- Local authentication (for users without Keycloak)

## Testing

### Test Sync

1. Create a test group in Keycloak (e.g., "Test Department")
2. Add test users to the group
3. Click "Sync Keycloak Groups" in the UI
4. Verify department created with correct name and keycloakGroupId
5. Verify users created with correct email and keycloakId
6. Verify users linked to department in department_accounts
7. Create an event and assign it to the test department
8. Verify all users receive email notification

### Test Email Deduplication

1. Create a department email: test@example.com
2. Create a Keycloak user with same email: test@example.com
3. Sync Keycloak groups
4. Assign event to department
5. Verify user receives only ONE email (not two)

## Migration Path

### From Legacy System (No Keycloak)

1. Keep existing departments and emails
2. Configure Keycloak environment variables
3. Create matching groups in Keycloak
4. Run initial sync
5. Verify departments linked correctly
6. Gradually transition users to Keycloak

### From Keycloak (No Auto-Sync)

1. Users already login via Keycloak
2. Enable automatic sync
3. Sync will populate departments automatically
4. Existing user records will be updated
5. No manual intervention needed

## Performance Considerations

- **Initial Sync**: May take 10-30 seconds for 100+ groups/users
- **Scheduled Sync**: Runs in background, doesn't block requests
- **API Calls**: Keycloak admin token cached to reduce API calls
- **Database Queries**: Efficient queries with proper indexing

## Security

- Client secret never exposed to frontend
- Sync endpoints restricted to superadmin only
- Service account has minimal required permissions
- User emails only visible to admins, not to department members

## Future Enhancements

- [ ] Real-time sync via Keycloak webhooks
- [ ] Sync history/audit log
- [ ] Group hierarchy support (nested departments)
- [ ] User attribute mapping (phone, location, etc.)
- [ ] Selective sync (choose which groups to sync)

## Troubleshooting

See `docs/KEYCLOAK_DEPARTMENT_SYNC.md` for detailed troubleshooting guide.

## Related Documentation

- `docs/KEYCLOAK_DEPARTMENT_SYNC.md` - Detailed documentation
- `docs/ARCHITECTURE.md` - System architecture
- `docs/RBAC_AND_SECURITY.md` - Role-based access control
- `.env.example` - Environment variables reference
