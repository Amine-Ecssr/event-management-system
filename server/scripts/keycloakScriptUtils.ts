/**
 * Shared utilities for Keycloak setup scripts
 */

export async function getAdminToken(): Promise<string> {
  const tokenUrl = `${process.env.KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`;
  
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: process.env.KEYCLOAK_ADMIN || 'admin',
    password: process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin',
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

export async function adminRequest<T>(token: string, endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.KEYCLOAK_REALM}${endpoint}`;

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
    throw new Error(`Request failed: ${response.status} ${errorText}`);
  }

  return response.json();
}
