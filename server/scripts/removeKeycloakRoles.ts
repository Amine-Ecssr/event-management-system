/**
 * Script to remove Keycloak service account roles
 * Used for testing the automated bootstrap process
 */

import { getAdminToken, adminRequest } from './keycloakScriptUtils';

async function removeRoles() {
  console.log('🧹 Removing service account roles for testing...');
  
  const token = await getAdminToken();

  const clients = await adminRequest<any[]>(token, `/clients?clientId=${process.env.KEYCLOAK_CLIENT_ID}`);
  const client = clients[0];

  const realmManagementClients = await adminRequest<any[]>(token, '/clients?clientId=realm-management');
  const realmManagementClient = realmManagementClients[0];

  const serviceAccountUser = await adminRequest<any>(token, `/clients/${client.id}/service-account-user`);

  const assignedRoles = await adminRequest<any[]>(
    token,
    `/users/${serviceAccountUser.id}/role-mappings/clients/${realmManagementClient.id}`
  );

  if (assignedRoles.length === 0) {
    console.log('✓ No roles to remove');
    return;
  }

  await adminRequest(
    token,
    `/users/${serviceAccountUser.id}/role-mappings/clients/${realmManagementClient.id}`,
    {
      method: 'DELETE',
      body: JSON.stringify(assignedRoles),
    }
  );

  console.log(`✓ Removed ${assignedRoles.length} roles`);
  assignedRoles.forEach((role: any) => {
    console.log(`  - ${role.name}`);
  });
  
  console.log('\nNow restart the server to test automatic bootstrap:');
  console.log('  docker-compose restart server');
}

removeRoles().catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
