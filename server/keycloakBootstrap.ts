/**
 * Keycloak Bootstrap Service
 * 
 * Automatically configures Keycloak client with required service account roles
 * on application startup. This ensures the sync functionality works without
 * manual configuration.
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
  realm: string,
  token: string,
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${baseUrl}/admin/realms/${realm}${endpoint}`;

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
 * Check if Keycloak client already has the required roles
 */
async function hasRequiredRoles(
  baseUrl: string,
  realm: string,
  token: string,
  serviceAccountUserId: string,
  realmManagementClientId: string,
  requiredRoles: string[]
): Promise<boolean> {
  try {
    const assignedRoles = await adminRequest<KeycloakRole[]>(
      baseUrl,
      realm,
      token,
      `/users/${serviceAccountUserId}/role-mappings/clients/${realmManagementClientId}`
    );

    const assignedRoleNames = assignedRoles.map(r => r.name);
    return requiredRoles.every(role => assignedRoleNames.includes(role));
  } catch (error) {
    // If we can't check, assume roles are not configured
    return false;
  }
}

/**
 * Bootstrap Keycloak client with required service account roles
 * This runs automatically on startup if Keycloak is configured
 */
export async function bootstrapKeycloakClient(): Promise<void> {
  const baseUrl = process.env.KEYCLOAK_URL;
  const realm = process.env.KEYCLOAK_REALM;
  const clientId = process.env.KEYCLOAK_CLIENT_ID;
  const adminUsername = process.env.KEYCLOAK_ADMIN;
  const adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD;

  // Skip if Keycloak is not configured
  if (!baseUrl || !realm || !clientId || !adminUsername || !adminPassword) {
    log('[Keycloak Bootstrap] Skipping - Keycloak not fully configured');
    return;
  }

  try {
    log('[Keycloak Bootstrap] Configuring client service account roles...');
    
    const token = await getAdminToken(baseUrl, adminUsername, adminPassword);

    // Find the application client
    const clients = await adminRequest<KeycloakClient[]>(
      baseUrl,
      realm,
      token,
      `/clients?clientId=${clientId}`
    );
    
    if (clients.length === 0) {
      log(`[Keycloak Bootstrap] Client '${clientId}' not found - skipping role assignment`);
      return;
    }

    const client = clients[0];

    // Get the realm-management client
    const realmManagementClients = await adminRequest<KeycloakClient[]>(
      baseUrl,
      realm,
      token,
      '/clients?clientId=realm-management'
    );
    
    if (realmManagementClients.length === 0) {
      log('[Keycloak Bootstrap] realm-management client not found - skipping role assignment');
      return;
    }

    const realmManagementClient = realmManagementClients[0];

    // Get the service account user
    const serviceAccountUser = await adminRequest<ServiceAccountUser>(
      baseUrl,
      realm,
      token,
      `/clients/${client.id}/service-account-user`
    );

    // Required roles for syncing groups and users
    const requiredRoleNames = [
      'view-users',
      'view-clients',
      'view-realm',
      'query-groups',
      'query-users',
    ];

    // Check if roles are already assigned
    const alreadyConfigured = await hasRequiredRoles(
      baseUrl,
      realm,
      token,
      serviceAccountUser.id,
      realmManagementClient.id,
      requiredRoleNames
    );

    if (alreadyConfigured) {
      log('[Keycloak Bootstrap] Service account already has required roles ✓');
      return;
    }

    // Get all available roles from realm-management
    const allRoles = await adminRequest<KeycloakRole[]>(
      baseUrl,
      realm,
      token,
      `/clients/${realmManagementClient.id}/roles`
    );

    const rolesToAssign = allRoles.filter(role => requiredRoleNames.includes(role.name));
    
    if (rolesToAssign.length === 0) {
      log('[Keycloak Bootstrap] No roles found to assign - skipping');
      return;
    }

    // Assign the roles
    await adminRequest(
      baseUrl,
      realm,
      token,
      `/users/${serviceAccountUser.id}/role-mappings/clients/${realmManagementClient.id}`,
      {
        method: 'POST',
        body: JSON.stringify(rolesToAssign),
      }
    );

    log(`[Keycloak Bootstrap] Successfully assigned ${rolesToAssign.length} roles to service account ✓`);
    rolesToAssign.forEach(role => {
      log(`[Keycloak Bootstrap]   - ${role.name}`);
    });

  } catch (error) {
    // Log error but don't crash the application
    // Keycloak might not be ready yet or credentials might be wrong
    console.error('[Keycloak Bootstrap] Failed to configure client:', error);
    log('[Keycloak Bootstrap] Client configuration failed - sync may not work until manually configured');
  }
}

/**
 * Wait for Keycloak to be ready before bootstrapping
 * Retries connection with exponential backoff
 */
export async function waitForKeycloakAndBootstrap(maxRetries = 10): Promise<void> {
  const baseUrl = process.env.KEYCLOAK_URL;
  
  if (!baseUrl) {
    return;
  }

  log('[Keycloak Bootstrap] Waiting for Keycloak to be ready...');

  for (let i = 0; i < maxRetries; i++) {
    try {
      const healthUrl = `${baseUrl}/health/ready`;
      const response = await fetch(healthUrl, { 
        signal: AbortSignal.timeout(5000) 
      });
      
      if (response.ok) {
        log('[Keycloak Bootstrap] Keycloak is ready ✓');
        // Give Keycloak a moment to fully initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        await bootstrapKeycloakClient();
        return;
      }
    } catch (error) {
      const waitTime = Math.min(1000 * Math.pow(2, i), 10000);
      log(`[Keycloak Bootstrap] Keycloak not ready yet, retrying in ${waitTime}ms... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  log('[Keycloak Bootstrap] Keycloak did not become ready in time - skipping bootstrap');
}
