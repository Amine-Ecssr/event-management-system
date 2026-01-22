# Keycloak Client Bootstrap

This directory contains scripts for automatically configuring Keycloak realms, clients, roles, and users.

## Overview

The Keycloak setup process runs automatically when the application starts, ensuring complete configuration:

1. **Realm Creation** - Creates `ecssr-events` realm with email as username
2. **Role Creation** - Creates `superadmin` and `admin` realm roles
3. **Client Configuration** - Creates and configures `ecssr-events-app` client
4. **Service Account Roles** - Assigns required roles for group/user sync
5. **Superadmin User** - Creates initial superadmin user with email login

## How It Works

1. **Application starts** → `server/index.ts` initializes background services
2. **Bootstrap triggered** → `server/bootstrap.ts` calls `waitForKeycloakAndSetup()`
3. **Wait for Keycloak** → Polls Keycloak health endpoint with exponential backoff
4. **Create Realm** → Creates realm with these settings:
   - **Email as Username**: Users login with email instead of username
   - **Login with Email**: Email-based authentication enabled
   - **No Duplicate Emails**: Each email can only belong to one user
   - **Registration Disabled**: Users must be created by admins
   - **Password Reset Enabled**: Users can reset their passwords
5. **Create Roles** → Creates `superadmin` and `admin` realm roles (admin role empty by default)
6. **Create Client** → Creates OAuth2/OIDC client with service account enabled
7. **Assign Service Account Roles** → Assigns these roles for API access:
   - `view-users`
   - `view-clients`
   - `view-realm`
   - `query-groups`
   - `query-users`
8. **Create Superadmin User** → Creates initial user with:
   - Email: From `SUPERADMIN_EMAIL` env var
   - Password: From `SUPERADMIN_PASSWORD` env var
   - Role: `superadmin`
   - Email Verified: `true`

## Environment Variables Required

```env
# Keycloak connection
KEYCLOAK_URL=http://keycloak:8080
KEYCLOAK_REALM=ecssr-events
KEYCLOAK_CLIENT_ID=ecssr-events-app
KEYCLOAK_CLIENT_SECRET=your-client-secret

# Admin credentials (for bootstrap - Keycloak master realm admin)
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin

# Superadmin user (created in ecssr-events realm)
SUPERADMIN_EMAIL=admin@ecssr.ae
SUPERADMIN_PASSWORD=admin123
```

## Files

### `server/keycloakSetup.ts`
Complete automated setup module integrated into application startup:

- `waitForKeycloakAndSetup()` - Main entry point, waits for Keycloak and performs full setup
- `setupKeycloak()` - Orchestrates all setup steps
- `createRealm()` - Creates realm with email-as-username configuration
- `createRealmRoles()` - Creates superadmin and admin roles
- `ensureClient()` - Creates/verifies OAuth2 client
- `assignServiceAccountRoles()` - Assigns API access roles
- `createSuperadminUser()` - Creates initial superadmin user

### `setupKeycloakClient.ts`
Legacy standalone script for manual client configuration (roles only)

### `removeKeycloakRoles.ts`
Testing utility to remove service account roles

## Features

### ✅ Complete Automation
Zero manual configuration - realm, roles, client, and users created automatically

### ✅ Email as Username
Users login with their email address (e.g., `admin@ecssr.ae`) instead of separate usernames

### ✅ Role-Based Access
- **superadmin** - Full system access (assigned to initial user)
- **admin** - Limited admin access (empty by default, ready for assignment)

### ✅ Idempotent
Safe to run multiple times - checks existing configuration before making changes

### ✅ Retry Logic
Waits for Keycloak to be ready with exponential backoff (up to 10 retries)

### ✅ Graceful Degradation
If setup fails, application continues but logs warnings

## Logs

Watch for these log messages during startup:

```
[Keycloak Bootstrap] Waiting for Keycloak to be ready...
[Keycloak Bootstrap] Keycloak is ready ✓
[Keycloak Bootstrap] Configuring client service account roles...
[Keycloak Bootstrap] Successfully assigned 5 roles to service account ✓
```

Or if already configured:
```
[Keycloak Bootstrap] Service account already has required roles ✓
```

## Troubleshooting

### Bootstrap fails with "Keycloak not ready"
- Keycloak may be taking longer to start
- Check Keycloak container logs: `docker-compose logs keycloak`
- Verify Keycloak health: `curl http://localhost:8080/health/ready`

### Bootstrap fails with "401 Unauthorized"
- Verify admin credentials in environment variables
- Check `KEYCLOAK_ADMIN` and `KEYCLOAK_ADMIN_PASSWORD`
- Ensure they match Keycloak's admin user

### Bootstrap fails with "Client not found"
- Ensure the client exists in Keycloak
- Check `KEYCLOAK_CLIENT_ID` matches the actual client ID
- Verify realm name is correct

### Sync still returns 403 after bootstrap
- Restart the server container: `docker-compose restart server`
- The token cache may need to be refreshed
- Check service account roles in Keycloak UI

## Manual Verification

To verify the service account has the correct roles:

1. Go to Keycloak Admin Console: http://localhost:8080
2. Login as admin
3. Select realm: `ecssr-events`
4. Go to: Clients → `ecssr-events-app` → Service account roles
5. Verify these roles are assigned from `realm-management`:
   - query-groups
   - query-users
   - view-clients
   - view-realm
   - view-users

## Architecture

```
Application Startup
    ↓
bootstrap.ts → startBackgroundServices()
    ↓
keycloakBootstrap.ts → waitForKeycloakAndBootstrap()
    ↓
    ├─ Poll Keycloak health endpoint
    ├─ Get admin token (master realm)
    ├─ Find ecssr-events-app client
    ├─ Find realm-management client
    ├─ Get service account user
    ├─ Check if roles already assigned
    └─ Assign roles if missing
```

## Development

To test the bootstrap process:

```bash
# Stop all containers
docker-compose down

# Remove Keycloak data to reset configuration
docker volume rm eventvue_postgres_data

# Start fresh
docker-compose up -d

# Watch bootstrap logs
docker-compose logs -f server | grep "Keycloak Bootstrap"
```

## Production Considerations

1. **Security**: Change default admin credentials in production
2. **Retry Logic**: Adjust max retries based on infrastructure startup time
3. **Monitoring**: Monitor bootstrap logs for failures
4. **Secrets**: Use Docker secrets or a secret manager for sensitive values

## Related Documentation

- [Keycloak Department Sync](../docs/KEYCLOAK_DEPARTMENT_SYNC.md)
- [Keycloak Integration Progress](../KEYCLOAK_INTEGRATION_PROGRESS.md)
- [Architecture Guide](../docs/ARCHITECTURE.md)
