# Keycloak Department/Stakeholder Sync

This document explains how the department/stakeholder feature integrates with Keycloak for automatic user synchronization.

## Overview

The system automatically syncs Keycloak groups to departments and their members to users, ensuring that:
1. Departments are created from Keycloak groups
2. Users are automatically added to departments based on Keycloak group membership
3. Email notifications are sent to all department members, even if they haven't logged in yet

## Architecture

### Components

1. **Keycloak Admin Client** (`server/keycloak-admin.ts`)
   - Fetches groups and users from Keycloak Admin API
   - Syncs groups to departments
   - Syncs group members to users

2. **Sync Scheduler** (`server/keycloakSyncScheduler.ts`)
   - Automatically syncs groups and users on a schedule
   - Runs on server startup and periodically (default: every hour)

3. **API Endpoints** (`server/routes/admin.routes.ts`)
   - `GET /api/keycloak/groups` - Fetch all Keycloak groups
   - `POST /api/keycloak/sync/groups` - Sync groups to departments
   - `POST /api/keycloak/sync/all` - Sync groups and members
   - `POST /api/keycloak/sync/group/:groupPath` - Sync specific group members

4. **Frontend Integration** (`client/src/pages/Stakeholders.tsx`)
   - "Sync Keycloak Groups" button for manual sync
   - Automatic sync on page load (if configured)

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Keycloak Configuration (required)
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=ecssr-events
KEYCLOAK_CLIENT_ID=ecssr-events-app
KEYCLOAK_CLIENT_SECRET=your-client-secret-here

# Keycloak Sync Configuration (optional)
KEYCLOAK_SYNC_ENABLED=true          # Enable/disable automatic sync (default: true)
KEYCLOAK_SYNC_INTERVAL=3600000      # Sync interval in milliseconds (default: 1 hour)
```

### Keycloak Client Setup

The client configuration is **automatically handled** by the application on startup. The bootstrap process:

1. Waits for Keycloak to be ready
2. Checks if the client has required service account roles
3. Automatically assigns roles if missing:
   - `view-users`
   - `view-clients`
   - `view-realm`
   - `query-groups`
   - `query-users`

**No manual configuration needed!** The system will configure itself on first startup.

#### Manual Setup (if needed)

If automatic setup fails, you can manually configure the client:

1. **Service Account Enabled**: Yes
2. **Authorization Enabled**: Yes (if using authorization)
3. **Service Account Roles**:
   - `view-users`
   - `view-clients`
   - `view-realm`
   - `query-groups`
   - `query-users`

## How It Works

### 1. Group Sync

When a group is synced from Keycloak:

```typescript
// Keycloak Group Structure
{
  id: "abc-123",
  name: "IT Department",
  path: "/departments/IT Department"
}

// Becomes Department
{
  id: 1,
  name: "IT Department",
  nameAr: "IT Department",  // Can be updated manually via UI
  keycloakGroupId: "/departments/IT Department",
  active: true
}
```

### 2. User Sync

When group members are synced:

```typescript
// Keycloak User
{
  id: "user-123",
  username: "john.doe",
  email: "john.doe@example.com",
  firstName: "John",
  lastName: "Doe"
}

// Becomes User
{
  id: 1,
  username: "john.doe",
  email: "john.doe@example.com",
  keycloakId: "user-123",
  role: "department",
  password: null  // Keycloak handles authentication
}

// Linked to Department
{
  userId: 1,
  departmentId: 1,
  primaryEmailId: 1
}
```

### 3. Email Notifications

When sending emails to a department:

```typescript
// Function: getDepartmentEmails(departmentId)
// Returns:
[
  "dept.email@example.com",        // From department_emails table
  "john.doe@example.com",          // From Keycloak-synced user
  "jane.smith@example.com",        // From Keycloak-synced user
  // ... all unique emails
]
```

## Usage

### Manual Sync via UI

1. Navigate to **Stakeholders** page
2. Click **Sync Keycloak Groups** button
3. Wait for sync to complete
4. Departments and users will be updated

### Manual Sync via API

```bash
# Sync all groups and members
curl -X POST http://localhost:5000/api/keycloak/sync/all \
  -H "Authorization: Bearer YOUR_TOKEN"

# Sync only groups (no members)
curl -X POST http://localhost:5000/api/keycloak/sync/groups \
  -H "Authorization: Bearer YOUR_TOKEN"

# Sync specific group members
curl -X POST http://localhost:5000/api/keycloak/sync/group/%2Fdepartments%2FIT%20Department \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Automatic Sync

The system automatically syncs:
- On server startup (initial sync)
- Every hour (configurable via `KEYCLOAK_SYNC_INTERVAL`)

## Data Flow

```
Keycloak Groups
    ↓
[Keycloak Admin API]
    ↓
departments table (keycloakGroupId)
    ↓
Keycloak Group Members
    ↓
[Keycloak Admin API]
    ↓
users table (keycloakId, email)
    ↓
department_accounts table (userId, departmentId)
    ↓
Email Notifications (combines department_emails + user emails)
```

## Database Schema

### Departments Table

```sql
CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  name_ar TEXT,
  keycloak_group_id TEXT UNIQUE,  -- Maps to Keycloak group path
  active BOOLEAN NOT NULL DEFAULT true,
  cc_list TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Users Table

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password TEXT,                  -- NULL for Keycloak-only users
  role TEXT NOT NULL DEFAULT 'admin',
  keycloak_id TEXT UNIQUE,        -- Keycloak user ID (sub claim)
  email TEXT,                     -- Email from Keycloak
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Department Accounts Table

```sql
CREATE TABLE department_accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  primary_email_id INTEGER NOT NULL REFERENCES department_emails(id) ON DELETE RESTRICT,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Troubleshooting

### Sync Fails

**Problem**: Sync returns 503 error
**Solution**: Check that `KEYCLOAK_CLIENT_SECRET` is set

### No Users Synced

**Problem**: Groups sync but no users appear
**Solution**: 
1. Check Keycloak service account has `view-users` role
2. Verify users are members of the group in Keycloak
3. Ensure users have email addresses in Keycloak

### Duplicate Emails

**Problem**: Users receive duplicate emails
**Solution**: The system automatically deduplicates emails. If users still receive duplicates, check:
1. User's email in Keycloak matches department email
2. User is not in multiple departments with same event assignment

### Manual Sync Not Working

**Problem**: Sync button doesn't work
**Solution**:
1. Check browser console for errors
2. Verify user has superadmin role
3. Check server logs for detailed error messages

## Best Practices

1. **Group Naming**: Use descriptive names for Keycloak groups that make sense as department names
2. **Email Addresses**: Ensure all Keycloak users have valid email addresses
3. **Regular Sync**: Keep the automatic sync enabled to ensure data stays up-to-date
4. **Manual Updates**: Use the UI to set Arabic names and CC lists for departments
5. **Testing**: Test email notifications after syncing to ensure all users receive emails

## Migration from Legacy System

If migrating from a system without Keycloak:

1. **Create Departments Manually**: Create departments in the UI first
2. **Add Department Emails**: Add traditional department emails
3. **Enable Keycloak**: Configure Keycloak environment variables
4. **Create Groups in Keycloak**: Mirror your departments as Keycloak groups
5. **Run Initial Sync**: Click "Sync Keycloak Groups"
6. **Verify**: Check that users are synced correctly
7. **Update Department IDs**: Link existing departments to Keycloak groups by setting `keycloakGroupId`

## API Reference

### GET /api/keycloak/groups

Fetch all Keycloak groups.

**Response:**
```json
{
  "groups": [
    {
      "id": "abc-123",
      "name": "IT Department",
      "path": "/departments/IT Department",
      "subGroups": []
    }
  ]
}
```

### POST /api/keycloak/sync/groups

Sync all Keycloak groups to departments.

**Response:**
```json
{
  "success": true,
  "message": "Keycloak groups synced successfully"
}
```

### POST /api/keycloak/sync/all

Sync all groups and their members.

**Response:**
```json
{
  "success": true,
  "message": "Keycloak groups and members synced successfully"
}
```

### POST /api/keycloak/sync/group/:groupPath

Sync members of a specific group.

**Parameters:**
- `groupPath`: URL-encoded Keycloak group path (e.g., `/departments/IT%20Department`)

**Response:**
```json
{
  "success": true,
  "message": "Members of group /departments/IT Department synced successfully"
}
```

## Security Considerations

1. **Client Secret**: Keep `KEYCLOAK_CLIENT_SECRET` secure and never commit to version control
2. **Service Account**: Limit service account permissions to minimum required roles
3. **API Access**: Sync endpoints are restricted to superadmin users only
4. **Email Privacy**: Department member emails are visible to admins but not to other department members

## Performance

- **Initial Sync**: May take several seconds depending on number of groups/users
- **Scheduled Sync**: Runs in background without blocking requests
- **Email Sending**: Automatic deduplication prevents sending duplicate emails
- **Caching**: Keycloak admin token is cached to reduce API calls

## Future Enhancements

- [ ] Real-time sync via Keycloak webhooks
- [ ] Selective sync (choose which groups to sync)
- [ ] Sync history/audit log
- [ ] Group hierarchy support (nested departments)
- [ ] User attribute mapping (phone numbers, locations, etc.)
