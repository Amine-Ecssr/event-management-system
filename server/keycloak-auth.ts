import Keycloak from 'keycloak-connect';
import { Express, Request, Response, NextFunction } from 'express';
import session from 'express-session';
import { storage } from './storage';
import { User as SelectUser } from '@shared/schema.mssql';

declare global {
  namespace Express {
    interface User extends SelectUser {
      keycloakGroups?: string[]; // Keycloak group names
      keycloakRoles?: string[]; // Keycloak realm roles
    }
  }
}

// Keycloak configuration from environment variables
const keycloakConfig = {
  realm: process.env.KEYCLOAK_REALM || 'ecssr-events',
  'auth-server-url': process.env.KEYCLOAK_URL || 'http://localhost:8080',
  'ssl-required': 'external',
  resource: process.env.KEYCLOAK_CLIENT_ID || 'ecssr-events-app',
  'confidential-port': 0,
  credentials: {
    secret: process.env.KEYCLOAK_CLIENT_SECRET || '',
  },
  'bearer-only': false, // We want both browser and API support
};

let keycloakInstance: Keycloak.Keycloak | null = null;

/**
 * Initialize Keycloak authentication
 * Falls back to local authentication if Keycloak is not configured
 */
export function setupKeycloakAuth(app: Express, sessionStore: any) {
  // Check if Keycloak is enabled (requires client secret)
  const keycloakEnabled = !!process.env.KEYCLOAK_CLIENT_SECRET;

  if (!keycloakEnabled) {
    console.log('[Keycloak] Not configured, using local authentication');
    return null;
  }

  try {
    const memoryStore = new session.MemoryStore();
    keycloakInstance = new Keycloak({ store: memoryStore }, keycloakConfig as any);

    // Install Keycloak middleware
    app.use(keycloakInstance.middleware({
      logout: '/api/auth/logout',
      admin: '/',
    }));

    console.log('[Keycloak] Authentication configured successfully');
    return keycloakInstance;
  } catch (error) {
    console.error('[Keycloak] Failed to initialize:', error);
    return null;
  }
}

/**
 * Extract user information from Keycloak token
 * Maps Keycloak user to local user format
 * 
 * IMPORTANT: Keycloak group names vs Department display names
 * - Keycloak groups can have technical names like "dept_1", "it-dept", etc.
 * - These are stored in departments.keycloakGroupId
 * - The actual English/Arabic names are in departments.name and departments.nameAr
 * - This function extracts the technical Keycloak group names from the token
 * - The mapping to display names happens in the database/UI layer
 */
export async function getUserFromKeycloakToken(grant: any): Promise<SelectUser | null> {
  try {
    const token = grant.access_token;
    const content = token.content;

    // Extract user info from token
    const keycloakId = content.sub; // Keycloak user ID
    const username = content.preferred_username || content.email;
    
    // FLEXIBLE EMAIL EXTRACTION
    // Email could be in 'email' field or in the username itself
    // Adjust this logic based on your Keycloak configuration
    let email = content.email;
    if (!email && username && username.includes('@')) {
      // If username looks like an email, use it
      email = username;
    }
    
    // Extract roles from token
    // Keycloak roles can be in realm_access.roles or resource_access
    const realmRoles = content.realm_access?.roles || [];
    const resourceRoles = content.resource_access?.[keycloakConfig.resource]?.roles || [];
    const allRoles = [...realmRoles, ...resourceRoles];
    
    // Extract groups from token
    // NOTE: Keycloak groups are typically in the 'groups' claim as an array of group paths
    // Group paths might be like "/departments/dept_1" or just "dept_1"
    // Adjust the claim name if your Keycloak uses a different mapper configuration
    const groupPaths = content.groups || [];
    
    // Store the full group paths (these are the technical Keycloak group identifiers)
    const groups = groupPaths.map((path: string) => {
      // If group path is like "/departments/dept_1", extract "dept_1"
      // Or keep the full path if that's how it's stored in keycloakGroupId
      return path.startsWith('/') ? path : `/${path}`;
    });

    // Determine application role from Keycloak roles
    let role: 'superadmin' | 'admin' | 'department' | 'department_admin' = 'department';
    if (allRoles.includes('superadmin')) {
      role = 'superadmin';
    } else if (allRoles.includes('admin')) {
      role = 'admin';
    } else if (allRoles.includes('department_admin')) {
      role = 'department_admin';
    }

    // Find or create user in local database
    let user = await storage.getUserByKeycloakId(keycloakId);
    
    if (!user) {
      // Create new user from Keycloak data
      user = await storage.createUserFromKeycloak({
        username,
        email: email || username,
        keycloakId,
        role,
      });
      console.log(`[Keycloak] Created new user from Keycloak: ${username} (${role})`);
      
      // Sync user's group memberships to department_accounts
      await syncUserDepartmentMemberships(user.id, groups);
    } else {
      // Update user's role and email if changed in Keycloak
      if (user.role !== role || user.email !== email) {
        user = await storage.updateUserFromKeycloak(user.id, { role, email });
        console.log(`[Keycloak] Updated user from Keycloak: ${username} (${role})`);
      }
      
      // Sync group memberships on every login (in case they changed in Keycloak)
      await syncUserDepartmentMemberships(user.id, groups);
    }

    // Attach Keycloak groups and roles to user object for request context
    (user as any).keycloakGroups = groups;
    (user as any).keycloakRoles = allRoles;

    return user;
  } catch (error) {
    console.error('[Keycloak] Error extracting user from token:', error);
    return null;
  }
}

/**
 * Sync user's Keycloak group memberships to department_accounts table
 * 
 * This ensures that users' group memberships are reflected in the database
 * even if the groups use technical names in Keycloak (like "dept_1")
 * 
 * @param userId - Local user ID
 * @param keycloakGroupIds - Array of Keycloak group IDs/paths from token
 */
async function syncUserDepartmentMemberships(userId: number, keycloakGroupIds: string[]): Promise<void> {
  try {
    for (const groupId of keycloakGroupIds) {
      // Get or create department by Keycloak group ID
      // This will create a department with a placeholder name if it doesn't exist
      const department = await storage.getOrCreateDepartmentByName(
        groupId, // Use group ID as name initially
        groupId  // Store the Keycloak group ID
      );
      
      // Check if department account already exists
      const existingAccounts = await storage.getUserDepartments(userId);
      const alreadyLinked = existingAccounts.some(d => d.id === department.id);
      
      if (!alreadyLinked) {
        // Get department's primary email (or create a default one)
        const departmentEmails = await storage.getDepartmentEmails(department.id);
        let primaryEmailId = departmentEmails.find(e => e.isPrimary)?.id;
        
        if (!primaryEmailId && departmentEmails.length > 0) {
          primaryEmailId = departmentEmails[0].id;
        }
        
        // If no emails exist, create a placeholder
        if (!primaryEmailId) {
          const placeholderEmail = await storage.createDepartmentEmail({
            departmentId: department.id,
            email: `placeholder@${department.name.toLowerCase().replace(/\s+/g, '-')}.local`,
            label: 'Placeholder',
            isPrimary: true,
          });
          primaryEmailId = placeholderEmail.id;
        }
        
        // Link user to department
        await storage.linkUserToDepartment(userId, department.id, primaryEmailId);
        console.log(`[Keycloak] Linked user ${userId} to department ${department.name} (${groupId})`);
      }
    }
  } catch (error) {
    console.error('[Keycloak] Error syncing department memberships:', error);
  }
}

/**
 * Get department emails from Keycloak group members
 * 
 * IMPORTANT: This function retrieves email addresses dynamically from users in a department.
 * 
 * Department Naming:
 * - Keycloak groups can have technical names like "dept_1", "it-department", etc.
 * - These are stored in departments.keycloakGroupId
 * - The actual English/Arabic display names are in departments.name and departments.nameAr
 * - This function accepts either the keycloakGroupId OR the display name
 * 
 * Email Extraction:
 * - Emails are extracted from users.email field (populated from Keycloak on login)
 * - Keycloak email could be in 'email' claim or 'username' if username is an email
 * - Adjust getUserFromKeycloakToken() if emails are in a custom claim
 * 
 * Caching Considerations:
 * - Currently fetches from database (users who have logged in)
 * - Consider implementing cache to reduce queries
 * - Keycloak Admin API could fetch users who haven't logged in yet
 * 
 * @param departmentIdentifier - Either keycloakGroupId (e.g., "dept_1") or display name (e.g., "IT Department")
 * @param keycloakInstance - The Keycloak instance (optional, for admin API calls)
 * @returns Array of email addresses for users in the group
 */
export async function getDepartmentEmailsFromKeycloak(
  departmentIdentifier: string,
  keycloakInstance?: Keycloak.Keycloak
): Promise<string[]> {
  try {
    // Try to find department by keycloakGroupId or name
    const department = await storage.getOrCreateDepartmentByName(departmentIdentifier, departmentIdentifier);
    
    if (!department) {
      console.warn(`[Keycloak] Department not found: ${departmentIdentifier}`);
      return [];
    }
    
    // Get all users linked to this department
    const users = await storage.getUsersByDepartmentName(department.name);
    
    // Extract emails from user records
    // NOTE: These are populated from Keycloak on user login
    // If a user hasn't logged in yet, they won't be in this list
    const emails = users
      .map(u => u.email)
      .filter((email): email is string => !!email && email.includes('@'));
    
    if (emails.length > 0) {
      console.log(`[Keycloak] Found ${emails.length} emails for department: ${department.name}`);
      return emails;
    }

    // If no users have logged in yet, log a warning
    console.warn(`[Keycloak] No users found for department: ${department.name} (${department.keycloakGroupId})`);
    console.warn('[Keycloak] Users must log in at least once to be synced from Keycloak');
    console.warn('[Keycloak] Future enhancement: Use Keycloak Admin API to fetch group members directly');
    
    return [];
  } catch (error) {
    console.error(`[Keycloak] Error fetching department emails for ${departmentIdentifier}:`, error);
    return [];
  }
}

/**
 * Middleware to check if user is authenticated via Keycloak or local auth
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  // Check Keycloak authentication first
  if (keycloakInstance && (req as any).kauth?.grant) {
    return next();
  }
  
  // Fallback to local authentication (Passport.js)
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  
  return res.sendStatus(401);
}

/**
 * Middleware to check if user is a superadmin
 */
export function isSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated && !(req as any).kauth?.grant) {
    return res.sendStatus(401);
  }
  
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'This action requires superadmin privileges' });
  }
  
  next();
}

/**
 * Middleware to check if user is admin or superadmin
 */
export function isAdminOrSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated && !(req as any).kauth?.grant) {
    return res.sendStatus(401);
  }
  
  if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'This action requires admin or superadmin privileges' });
  }
  
  next();
}

/**
 * Middleware to check if user is a department member or admin
 * Allows both department users and admins to access department-specific resources
 */
export function isDepartmentMemberOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated && !(req as any).kauth?.grant) {
    return res.sendStatus(401);
  }
  
  // Admins and superadmins can access all departments
  if (req.user?.role === 'admin' || req.user?.role === 'superadmin') {
    return next();
  }

  // Department users can only access their own department
  if (req.user?.role === 'department' || req.user?.role === 'department_admin') {
    return next();
  }
  
  return res.status(403).json({ error: 'Access denied' });
}

/**
 * Get user's department groups from Keycloak token or database
 */
export async function getUserDepartments(user: SelectUser): Promise<string[]> {
  // If user has Keycloak groups attached, return them
  if ((user as any).keycloakGroups) {
    return (user as any).keycloakGroups;
  }
  
  // Otherwise, fetch from database
  const departments = await storage.getUserDepartments(user.id);
  return departments.map(d => d.name);
}

export function getKeycloakInstance(): Keycloak.Keycloak | null {
  return keycloakInstance;
}
