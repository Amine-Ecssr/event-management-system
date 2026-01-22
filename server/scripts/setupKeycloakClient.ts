/**
 * Script to setup Keycloak client with proper service account roles
 * 
 * This script configures the ecssr-events-app client to have the necessary
 * permissions to access the Keycloak Admin API for syncing groups and users.
 * 
 * Required roles:
 * - view-users
 * - view-clients
 * - view-realm
 * - query-groups
 * - query-users
 */

import { getAdminToken, adminRequest } from './keycloakScriptUtils';

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

async function setupClient() {
  console.log('🔧 Setting up Keycloak client...');
  
  const token = await getAdminToken();
  console.log('✅ Obtained admin token');

  // Find the ecssr-events-app client
  const clients = await adminRequest<KeycloakClient[]>(token, '/clients?clientId=ecssr-events-app');
  
  if (clients.length === 0) {
    throw new Error('Client ecssr-events-app not found');
  }

  const client = clients[0];
  console.log(`✅ Found client: ${client.clientId} (${client.id})`);

  // Get the realm-management client (which contains the roles we need)
  const realmManagementClients = await adminRequest<KeycloakClient[]>(token, '/clients?clientId=realm-management');
  
  if (realmManagementClients.length === 0) {
    throw new Error('realm-management client not found');
  }

  const realmManagementClient = realmManagementClients[0];
  console.log(`✅ Found realm-management client: ${realmManagementClient.id}`);

  // Get all roles from realm-management client
  const allRoles = await adminRequest<KeycloakRole[]>(
    token, 
    `/clients/${realmManagementClient.id}/roles`
  );

  console.log(`📋 Found ${allRoles.length} roles in realm-management`);

  // Required roles for the service account
  const requiredRoleNames = [
    'view-users',
    'view-clients',
    'view-realm',
    'query-groups',
    'query-users',
  ];

  const rolesToAssign = allRoles.filter(role => requiredRoleNames.includes(role.name));
  
  if (rolesToAssign.length !== requiredRoleNames.length) {
    const missingRoles = requiredRoleNames.filter(
      name => !rolesToAssign.find(r => r.name === name)
    );
    console.warn(`⚠️  Some roles not found: ${missingRoles.join(', ')}`);
  }

  console.log(`🔑 Assigning ${rolesToAssign.length} roles to service account...`);

  // Get the service account user for this client
  const serviceAccountUser = await adminRequest<{ id: string }>(
    token,
    `/clients/${client.id}/service-account-user`
  );

  console.log(`✅ Found service account user: ${serviceAccountUser.id}`);

  // Assign the roles to the service account user
  await adminRequest(
    token,
    `/users/${serviceAccountUser.id}/role-mappings/clients/${realmManagementClient.id}`,
    {
      method: 'POST',
      body: JSON.stringify(rolesToAssign),
    }
  );

  console.log('✅ Successfully assigned roles to service account:');
  rolesToAssign.forEach(role => {
    console.log(`   - ${role.name}`);
  });

  console.log('\n🎉 Keycloak client setup completed successfully!');
  console.log('You can now sync groups and users from Keycloak.');
}

// Run the setup
setupClient().catch(error => {
  console.error('❌ Failed to setup client:', error);
  process.exit(1);
});
