/**
 * Complete Keycloak Setup Script
 * 
 * This script creates the realm, client, and configures service account roles
 * automatically on first startup.
 */

import { log } from './vite';

interface KeycloakRole {
  id: string;
  name: string;
  description?: string;
  composite: boolean;
  clientRole: boolean;
  containerId: string;
}

interface KeycloakClient {
  id: string;
  clientId: string;
}

interface ServiceAccountUser {
  id: string;
}

interface RealmRepresentation {
  realm: string;
  enabled: boolean;
  displayName?: string;
  registrationEmailAsUsername?: boolean;
  loginWithEmailAllowed?: boolean;
  duplicateEmailsAllowed?: boolean;
  registrationAllowed?: boolean;
  resetPasswordAllowed?: boolean;
  editUsernameAllowed?: boolean;
}

interface KeycloakUser {
  username: string;
  email: string;
  emailVerified: boolean;
  enabled: boolean;
  firstName?: string;
  lastName?: string;
  credentials?: Array<{
    type: string;
    value: string;
    temporary: boolean;
  }>;
}

/**
 * Get admin access token using master realm
 */
async function getAdminToken(baseUrl: string, adminUsername: string, adminPassword: string): Promise<string> {
  const tokenUrl = `${baseUrl}/realms/master/protocol/openid-connect/token`;
  
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: adminUsername,
    password: adminPassword,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get admin token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Make authenticated request to Keycloak Admin API
 */
async function adminRequest<T>(
  baseUrl: string,
  token: string,
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${baseUrl}/admin${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Keycloak Admin API error: ${response.status} ${errorText}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }
  
  return {} as T;
}

/**
 * Check if realm exists
 */
async function realmExists(baseUrl: string, token: string, realmName: string): Promise<boolean> {
  try {
    await adminRequest<RealmRepresentation>(baseUrl, token, `/realms/${realmName}`);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Create realm
 */
async function createRealm(baseUrl: string, token: string, realmName: string): Promise<void> {
  const realmData: RealmRepresentation = {
    realm: realmName,
    enabled: true,
    displayName: 'ECSSR Events Calendar',
    registrationEmailAsUsername: true,
    loginWithEmailAllowed: true,
    duplicateEmailsAllowed: false,
    registrationAllowed: false,
    resetPasswordAllowed: true,
    editUsernameAllowed: false,
  };

  await adminRequest(baseUrl, token, '/realms', {
    method: 'POST',
    body: JSON.stringify(realmData),
  });

  log(`[Keycloak Setup] Created realm: ${realmName} ✓`);
}

/**
 * Create client if it doesn't exist
 */
async function ensureClient(
  baseUrl: string,
  realm: string,
  token: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<KeycloakClient> {
  // Check if client exists
  const clients = await adminRequest<KeycloakClient[]>(
    baseUrl,
    token,
    `/realms/${realm}/clients?clientId=${clientId}`
  );
  
  if (clients.length > 0) {
    log(`[Keycloak Setup] Client '${clientId}' already exists ✓`);
    return clients[0];
  }

  // Create client
  const clientData = {
    clientId: clientId,
    name: 'ECSSR Events Application',
    enabled: true,
    publicClient: false,
    serviceAccountsEnabled: true,
    authorizationServicesEnabled: false,
    standardFlowEnabled: true,
    directAccessGrantsEnabled: true,
    secret: clientSecret,
    redirectUris: [redirectUri, 'http://localhost:5000/api/auth/callback', 'http://localhost:5001/api/auth/callback'],
    webOrigins: ['/*'],
    attributes: {
      'post.logout.redirect.uris': '+',
    },
  };

  await adminRequest(baseUrl, token, `/realms/${realm}/clients`, {
    method: 'POST',
    body: JSON.stringify(clientData),
  });

  log(`[Keycloak Setup] Created client: ${clientId} ✓`);

  // Fetch the created client
  const newClients = await adminRequest<KeycloakClient[]>(
    baseUrl,
    token,
    `/realms/${realm}/clients?clientId=${clientId}`
  );
  
  return newClients[0];
}

/**
 * Assign service account roles
 */
async function assignServiceAccountRoles(
  baseUrl: string,
  realm: string,
  token: string,
  client: KeycloakClient
): Promise<void> {
  // Get realm-management client
  const realmManagementClients = await adminRequest<KeycloakClient[]>(
    baseUrl,
    token,
    `/realms/${realm}/clients?clientId=realm-management`
  );
  
  if (realmManagementClients.length === 0) {
    throw new Error('realm-management client not found');
  }

  const realmManagementClient = realmManagementClients[0];

  // Get service account user
  const serviceAccountUser = await adminRequest<ServiceAccountUser>(
    baseUrl,
    token,
    `/realms/${realm}/clients/${client.id}/service-account-user`
  );

  // Required roles
  const requiredRoleNames = [
    'view-users',
    'view-clients',
    'view-realm',
    'query-groups',
    'query-users',
  ];

  // Get all available roles
  const allRoles = await adminRequest<KeycloakRole[]>(
    baseUrl,
    token,
    `/realms/${realm}/clients/${realmManagementClient.id}/roles`
  );

  const rolesToAssign = allRoles.filter(role => requiredRoleNames.includes(role.name));

  if (rolesToAssign.length === 0) {
    log('[Keycloak Setup] No roles found to assign');
    return;
  }

  // Assign roles
  await adminRequest(
    baseUrl,
    token,
    `/realms/${realm}/users/${serviceAccountUser.id}/role-mappings/clients/${realmManagementClient.id}`,
    {
      method: 'POST',
      body: JSON.stringify(rolesToAssign),
    }
  );

  log(`[Keycloak Setup] Assigned ${rolesToAssign.length} service account roles ✓`);
  rolesToAssign.forEach(role => {
    log(`[Keycloak Setup]   - ${role.name}`);
  });
}

/**
 * Create realm roles
 */
async function createRealmRoles(
  baseUrl: string,
  realm: string,
  token: string
): Promise<void> {
  const roles = [
    { name: 'superadmin', description: 'Super Administrator with full system access' },
    { name: 'admin', description: 'Administrator with limited system access' },
    { name: 'department_admin', description: 'Department-scoped administrator with email privileges' },
  ];

  for (const role of roles) {
    try {
      // Check if role exists
      await adminRequest(baseUrl, token, `/realms/${realm}/roles/${role.name}`);
      log(`[Keycloak Setup] Role '${role.name}' already exists ✓`);
    } catch (error) {
      // Role doesn't exist, create it
      await adminRequest(baseUrl, token, `/realms/${realm}/roles`, {
        method: 'POST',
        body: JSON.stringify(role),
      });
      log(`[Keycloak Setup] Created role: ${role.name} ✓`);
    }
  }
}

/**
 * Create superadmin user
 */
async function createSuperadminUser(
  baseUrl: string,
  realm: string,
  token: string,
  email: string,
  password: string
): Promise<void> {
  // Check if user already exists
  const existingUsers = await adminRequest<KeycloakUser[]>(
    baseUrl,
    token,
    `/realms/${realm}/users?username=${encodeURIComponent(email)}`
  );

  if (existingUsers.length > 0) {
    log(`[Keycloak Setup] Superadmin user '${email}' already exists ✓`);
    return;
  }

  // Create user
  const userData: KeycloakUser = {
    username: email,
    email: email,
    emailVerified: true,
    enabled: true,
    firstName: 'Super',
    lastName: 'Admin',
    credentials: [
      {
        type: 'password',
        value: password,
        temporary: false,
      },
    ],
  };

  await adminRequest(baseUrl, token, `/realms/${realm}/users`, {
    method: 'POST',
    body: JSON.stringify(userData),
  });

  log(`[Keycloak Setup] Created superadmin user: ${email} ✓`);

  // Get the created user
  const users = await adminRequest<KeycloakUser[]>(
    baseUrl,
    token,
    `/realms/${realm}/users?username=${encodeURIComponent(email)}`
  );

  if (users.length === 0) {
    throw new Error('Failed to find created user');
  }

  const userId = (users[0] as any).id;

  // Get the superadmin role
  const superadminRole = await adminRequest<KeycloakRole>(
    baseUrl,
    token,
    `/realms/${realm}/roles/superadmin`
  );

  // Assign superadmin role to user
  await adminRequest(
    baseUrl,
    token,
    `/realms/${realm}/users/${userId}/role-mappings/realm`,
    {
      method: 'POST',
      body: JSON.stringify([superadminRole]),
    }
  );

  log(`[Keycloak Setup] Assigned 'superadmin' role to ${email} ✓`);
}

/**
 * Sync Keycloak superadmin user to local database
 * This allows the user to login via both Keycloak and local authentication
 */
async function syncSuperadminToLocalDB(
  email: string,
  password: string
): Promise<void> {
  try {
    const { storage } = await import('./storage');
    const { authService } = await import('./auth');

    // Check if user exists in local DB
    const existingUser = await storage.getUserByUsername(email);

    const hashedPassword = await authService.hashPassword(password);

    if (existingUser) {
      // Update existing user
      await storage.updateUserPassword(existingUser.id, hashedPassword);
      if (existingUser.role !== 'superadmin') {
        await storage.updateUserRole(existingUser.id, 'superadmin');
      }
      log(`[Keycloak Setup] Synced superadmin to local DB (updated) ✓`);
    } else {
      // Create new user in local DB
      await storage.createUser({
        username: email,
        password: hashedPassword,
        role: 'superadmin',
      });
      log(`[Keycloak Setup] Synced superadmin to local DB (created) ✓`);
    }
  } catch (error) {
    console.error('[Keycloak Setup] Failed to sync superadmin to local DB:', error);
  }
}

/**
 * Complete Keycloak setup
 */
export async function setupKeycloak(): Promise<void> {
  const baseUrl = process.env.KEYCLOAK_URL;
  const realm = process.env.KEYCLOAK_REALM;
  const clientId = process.env.KEYCLOAK_CLIENT_ID;
  const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;
  const redirectUri = process.env.KEYCLOAK_REDIRECT_URI;
  const adminUsername = process.env.KEYCLOAK_ADMIN;
  const adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD;

  if (!baseUrl || !realm || !clientId || !clientSecret || !redirectUri || !adminUsername || !adminPassword) {
    log('[Keycloak Setup] Skipping - Keycloak not fully configured');
    return;
  }

  try {
    log('[Keycloak Setup] Starting complete Keycloak setup...');
    
    const token = await getAdminToken(baseUrl, adminUsername, adminPassword);
    log('[Keycloak Setup] Obtained admin token ✓');

    // Step 1: Create realm if it doesn't exist
    const exists = await realmExists(baseUrl, token, realm);
    if (!exists) {
      await createRealm(baseUrl, token, realm);
    } else {
      log(`[Keycloak Setup] Realm '${realm}' already exists ✓`);
    }

    // Step 2: Create realm roles (superadmin, admin)
    await createRealmRoles(baseUrl, realm, token);

    // Step 3: Create/ensure client exists
    const client = await ensureClient(baseUrl, realm, token, clientId, clientSecret, redirectUri);

    // Step 4: Assign service account roles
    await assignServiceAccountRoles(baseUrl, realm, token, client);

    // Step 5: Create superadmin user
    const superadminEmail = process.env.SUPERADMIN_EMAIL || process.env.SUPERADMIN_USERNAME || 'admin@ecssr.ae';
    const superadminPassword = process.env.SUPERADMIN_PASSWORD || 'admin123';
    await createSuperadminUser(baseUrl, realm, token, superadminEmail, superadminPassword);

    log('[Keycloak Setup] Complete setup finished successfully! 🎉');

  } catch (error) {
    console.error('[Keycloak Setup] Failed to setup Keycloak:', error);
    log('[Keycloak Setup] Setup failed - manual configuration may be required');
  }
}

/**
 * Wait for Keycloak and perform complete setup
 */
export async function waitForKeycloakAndSetup(maxRetries = 30): Promise<void> {
  const baseUrl = process.env.KEYCLOAK_URL;
  
  if (!baseUrl) {
    return;
  }

  log('[Keycloak Setup] Waiting for Keycloak to be ready...');

  for (let i = 0; i < maxRetries; i++) {
    try {
      const healthUrl = `${baseUrl}/health/ready`;
      const response = await fetch(healthUrl, { 
        signal: AbortSignal.timeout(5000) 
      });
      
      if (response.ok) {
        log('[Keycloak Setup] Keycloak is ready ✓');
        // Give Keycloak a moment to fully initialize
        await new Promise(resolve => setTimeout(resolve, 3000));
        await setupKeycloak();
        return;
      }
    } catch (error) {
      // Use exponential backoff with a max of 15 seconds
      const waitTime = Math.min(2000 * Math.pow(1.5, i), 15000);
      log(`[Keycloak Setup] Keycloak not ready yet, retrying in ${Math.round(waitTime / 1000)}s... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  log('[Keycloak Setup] Keycloak did not become ready in time - skipping setup');
}
