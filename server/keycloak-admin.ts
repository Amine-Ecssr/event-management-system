/**
 * Keycloak Admin Client Service
 * 
 * This service uses the Keycloak Admin REST API to:
 * 1. Fetch all groups from Keycloak
 * 2. Fetch all users in each group
 * 3. Sync departments and users to the local database
 * 
 * This allows users to receive emails even if they haven't logged in yet.
 */

import { storage } from './storage';

interface KeycloakGroup {
  id: string;
  name: string;
  path: string;
  subGroups?: KeycloakGroup[];
}

interface KeycloakUser {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  enabled: boolean;
  firstName?: string;
  lastName?: string;
}

interface KeycloakGroupMember extends KeycloakUser {
  // Inherits all user properties
}

class KeycloakAdminClient {
  private baseUrl: string;
  private realm: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.baseUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
    this.realm = process.env.KEYCLOAK_REALM || 'ecssr-events';
    this.clientId = process.env.KEYCLOAK_CLIENT_ID || 'ecssr-events-app';
    this.clientSecret = process.env.KEYCLOAK_CLIENT_SECRET || '';
  }

  /**
   * Check if Keycloak admin is configured
   */
  isConfigured(): boolean {
    return !!this.clientSecret;
  }

  /**
   * Get an admin access token using client credentials flow
   */
  private async getAdminToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const tokenUrl = `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/token`;
      
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
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
      this.accessToken = data.access_token;
      
      // Set token expiry to 90% of the actual expiry to refresh before it expires
      const expiresIn = data.expires_in || 300; // Default to 5 minutes
      this.tokenExpiry = Date.now() + (expiresIn * 1000 * 0.9);

      console.log('[Keycloak Admin] Successfully obtained admin access token');
      return this.accessToken!;
    } catch (error) {
      console.error('[Keycloak Admin] Failed to get admin token:', error);
      throw error;
    }
  }

  /**
   * Make an authenticated request to Keycloak Admin API
   */
  private async adminRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const token = await this.getAdminToken();
    const url = `${this.baseUrl}/admin/realms/${this.realm}${endpoint}`;

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

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return {} as T;
  }

  /**
   * Fetch all groups from Keycloak
   * 
   * @param briefRepresentation - If true, returns minimal group info. If false, includes subgroups.
   */
  async getAllGroups(briefRepresentation: boolean = false): Promise<KeycloakGroup[]> {
    try {
      const groups = await this.adminRequest<KeycloakGroup[]>(
        `/groups?briefRepresentation=${briefRepresentation}`
      );
      
      console.log(`[Keycloak Admin] Fetched ${groups.length} groups`);
      return groups;
    } catch (error) {
      console.error('[Keycloak Admin] Failed to fetch groups:', error);
      throw error;
    }
  }

  /**
   * Fetch all members of a specific group
   * 
   * @param groupId - The Keycloak group ID
   */
  async getGroupMembers(groupId: string): Promise<KeycloakGroupMember[]> {
    try {
      const members = await this.adminRequest<KeycloakGroupMember[]>(
        `/groups/${groupId}/members`
      );
      
      console.log(`[Keycloak Admin] Fetched ${members.length} members for group ${groupId}`);
      return members;
    } catch (error) {
      console.error(`[Keycloak Admin] Failed to fetch members for group ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Flatten nested groups into a flat array
   * Converts hierarchical groups like "/departments/IT" into flat list
   */
  private flattenGroups(groups: KeycloakGroup[], parentPath: string = ''): KeycloakGroup[] {
    const result: KeycloakGroup[] = [];

    for (const group of groups) {
      const fullPath = parentPath ? `${parentPath}/${group.name}` : `/${group.name}`;
      
      result.push({
        ...group,
        path: fullPath,
      });

      if (group.subGroups && group.subGroups.length > 0) {
        result.push(...this.flattenGroups(group.subGroups, fullPath));
      }
    }

    return result;
  }

  /**
   * Sync all Keycloak groups to local departments table
   * 
   * This creates or updates departments based on Keycloak groups.
   * The keycloakGroupId stores the group path (e.g., "/departments/IT")
   * The name stores the display name (e.g., "IT" or "IT Department")
   */
  async syncGroupsToDepartments(): Promise<void> {
    if (!this.isConfigured()) {
      console.log('[Keycloak Admin] Not configured, skipping group sync');
      return;
    }

    try {
      console.log('[Keycloak Admin] Starting group sync...');
      
      // Fetch all groups from Keycloak
      const groups = await this.getAllGroups(false); // Get full representation with subgroups
      const flatGroups = this.flattenGroups(groups);

      console.log(`[Keycloak Admin] Processing ${flatGroups.length} groups (including subgroups)`);

      for (const group of flatGroups) {
        // Check if department already exists
        const existingDepartment = await storage.getDepartmentByKeycloakGroupId(group.path);

        if (existingDepartment) {
          console.log(`[Keycloak Admin] Department already exists for group: ${group.name} (${group.path})`);
          continue;
        }

        // Create new department
        const department = await storage.createDepartment({
          name: group.name, // Use group name as display name
          nameAr: group.name, // Default to same name, can be updated manually later
          keycloakGroupId: group.path, // Store the full path
          active: true,
        });

        console.log(`[Keycloak Admin] Created department: ${department.name} (${group.path})`);
      }

      console.log('[Keycloak Admin] Group sync completed successfully');
    } catch (error) {
      console.error('[Keycloak Admin] Failed to sync groups:', error);
      throw error;
    }
  }

  /**
   * Sync all users from a Keycloak group to local database
   * 
   * This ensures that users receive emails even if they haven't logged in yet.
   * 
   * @param groupPath - The Keycloak group path (e.g., "/departments/IT")
   */
  async syncGroupMembersToUsers(groupPath: string): Promise<void> {
    if (!this.isConfigured()) {
      console.log('[Keycloak Admin] Not configured, skipping user sync');
      return;
    }

    try {
      console.log(`[Keycloak Admin] Syncing members for group: ${groupPath}`);

      // Find the department
      const department = await storage.getDepartmentByKeycloakGroupId(groupPath);
      if (!department) {
        console.warn(`[Keycloak Admin] Department not found for group: ${groupPath}`);
        return;
      }

      // Find the group ID by path
      const allGroups = await this.getAllGroups(false);
      const flatGroups = this.flattenGroups(allGroups);
      const group = flatGroups.find(g => g.path === groupPath);

      if (!group) {
        console.warn(`[Keycloak Admin] Group not found in Keycloak: ${groupPath}`);
        return;
      }

      // Fetch all members of the group
      const members = await this.getGroupMembers(group.id);
      console.log(`[Keycloak Admin] Found ${members.length} members in group ${group.name}`);

      // Sync each member to the database
      for (const member of members) {
        if (!member.email) {
          console.warn(`[Keycloak Admin] Skipping user ${member.username} - no email address`);
          continue;
        }

        // Check if user already exists by Keycloak ID
        let user = await storage.getUserByKeycloakId(member.id);

        if (!user) {
          // Also check by username (in case user exists but Keycloak ID not set)
          user = await storage.getUserByUsername(member.username);
          
          if (user) {
            // User exists with same username but no Keycloak ID - update with Keycloak ID
            await storage.updateUserFromKeycloak(user.id, { 
              keycloakId: member.id,
              email: member.email 
            });
            console.log(`[Keycloak Admin] Linked existing user ${member.username} to Keycloak ID`);
          } else {
            // Create new user from Keycloak data
            user = await storage.createUserFromKeycloak({
              username: member.username,
              email: member.email,
              keycloakId: member.id,
              role: 'department', // Default role for group members
            });
            console.log(`[Keycloak Admin] Created user: ${member.username} (${member.email})`);
          }
        } else {
          // Update existing user's email if changed
          if (user.email !== member.email) {
            await storage.updateUserFromKeycloak(user.id, { email: member.email });
            console.log(`[Keycloak Admin] Updated email for user: ${member.username}`);
          }
        }

        // Ensure department email exists
        const departmentEmails = await storage.getDepartmentEmails(department.id);
        let primaryEmailId = departmentEmails.find(e => e.isPrimary)?.id;

        if (!primaryEmailId) {
          // Create a department email entry for this user's email
          const departmentEmail = await storage.createDepartmentEmail({
            departmentId: department.id,
            email: member.email,
            label: `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.username,
            isPrimary: departmentEmails.length === 0, // First email is primary
          });
          primaryEmailId = departmentEmail.id;
        }

        // Check if user is already linked to department
        const existingAccounts = await storage.getUserDepartments(user.id);
        const alreadyLinked = existingAccounts.some(d => d.id === department.id);

        if (!alreadyLinked && primaryEmailId) {
          // Link user to department
          await storage.linkUserToDepartment(user.id, department.id, primaryEmailId);
          console.log(`[Keycloak Admin] Linked user ${member.username} to department ${department.name}`);
        }
      }

      console.log(`[Keycloak Admin] Successfully synced ${members.length} members for group: ${group.name}`);
    } catch (error) {
      console.error(`[Keycloak Admin] Failed to sync members for group ${groupPath}:`, error);
      throw error;
    }
  }

  /**
   * Sync all groups and their members to the database
   * 
   * This is a comprehensive sync that:
   * 1. Syncs all Keycloak groups to departments
   * 2. Syncs all members of each group to users
   * 3. Links users to their respective departments
   */
  async syncAllGroupsAndMembers(): Promise<void> {
    if (!this.isConfigured()) {
      console.log('[Keycloak Admin] Not configured, skipping full sync');
      return;
    }

    try {
      console.log('[Keycloak Admin] Starting full sync of groups and members...');

      // Step 1: Sync all groups to departments
      await this.syncGroupsToDepartments();

      // Step 2: Fetch all groups and sync their members
      const groups = await this.getAllGroups(false);
      const flatGroups = this.flattenGroups(groups);

      for (const group of flatGroups) {
        await this.syncGroupMembersToUsers(group.path);
      }

      console.log('[Keycloak Admin] Full sync completed successfully');
    } catch (error) {
      console.error('[Keycloak Admin] Failed to complete full sync:', error);
      throw error;
    }
  }

  /**
   * Get all users' emails from a department (via Keycloak group)
   * 
   * This fetches emails directly from Keycloak, not from the local database.
   * Useful for getting the most up-to-date list of emails.
   * 
   * @param keycloakGroupPath - The Keycloak group path
   * @returns Array of email addresses
   */
  async getDepartmentEmails(keycloakGroupPath: string): Promise<string[]> {
    if (!this.isConfigured()) {
      console.log('[Keycloak Admin] Not configured, falling back to database emails');
      return [];
    }

    try {
      // Find the group by path
      const allGroups = await this.getAllGroups(false);
      const flatGroups = this.flattenGroups(allGroups);
      const group = flatGroups.find(g => g.path === keycloakGroupPath);

      if (!group) {
        console.warn(`[Keycloak Admin] Group not found: ${keycloakGroupPath}`);
        return [];
      }

      // Fetch group members
      const members = await this.getGroupMembers(group.id);

      // Extract and filter emails
      const emails = members
        .map(m => m.email)
        .filter((email): email is string => !!email && email.includes('@'));

      console.log(`[Keycloak Admin] Found ${emails.length} emails for group: ${group.name}`);
      return emails;
    } catch (error) {
      console.error(`[Keycloak Admin] Failed to get emails for group ${keycloakGroupPath}:`, error);
      return [];
    }
  }
}

// Export singleton instance
export const keycloakAdmin = new KeycloakAdminClient();
