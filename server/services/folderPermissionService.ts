/**
 * Folder Permission Service
 * 
 * Handles access control for event files and folders including:
 * - Event-wide access grants
 * - Folder-level permissions
 * - Permission templates
 * - Access checking (admins bypass all checks)
 */

import { db } from "../db";
import {
  eventFolders,
  eventFiles,
  eventAccessGrants,
  eventFolderPermissions,
  folderAccessTemplates,
  users,
  events,
  type InsertEventAccessGrant,
  type InsertEventFolderPermission,
  type InsertFolderAccessTemplate,
  type UpdateFolderAccessTemplate,
  type EventAccessGrant,
  type EventFolderPermission,
  type FolderAccessTemplate,
  type User,
} from "@shared/schema.mssql";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import { eventFileService } from "./eventFileService";

// Permission levels
export type PermissionLevel = 'view' | 'upload' | 'manage';

// Permission hierarchy
const PERMISSION_HIERARCHY: Record<PermissionLevel, number> = {
  'view': 1,
  'upload': 2,
  'manage': 3,
};

/**
 * Check if a role is an admin role
 */
export function isAdminRole(role?: string | null): boolean {
  return role === 'superadmin' || role === 'admin';
}

/**
 * Check if a user is an admin (superadmin or admin role)
 * Can accept either a userId (will query DB) or a User object (skips query)
 */
export async function isAdmin(userOrId: number | { role?: string | null }): Promise<boolean> {
  // If passed a user object with role, use it directly
  if (typeof userOrId === 'object' && userOrId !== null) {
    return isAdminRole(userOrId.role);
  }
  
  // Otherwise query the database
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userOrId));
  
  if (!user) return false;
  return isAdminRole(user.role);
}

/**
 * Check if user has access to an event's files
 * Admins always have full access
 */
export async function checkEventAccess(
  userId: number,
  eventId: string,
  requiredLevel: PermissionLevel = 'view'
): Promise<boolean> {
  // Admins bypass all checks
  if (await isAdmin(userId)) {
    return true;
  }
  
  // Check event-wide access grant
  const [grant] = await db
    .select()
    .from(eventAccessGrants)
    .where(and(
      eq(eventAccessGrants.eventId, eventId),
      eq(eventAccessGrants.userId, userId)
    ));
  
  if (!grant) return false;
  
  return hasRequiredPermission(grant.permissionLevel as PermissionLevel, requiredLevel);
}

/**
 * Check if user has access to a specific folder
 * Falls back to event-level access if no folder-specific permission
 */
export async function checkFolderAccess(
  userId: number,
  folderId: number,
  requiredLevel: PermissionLevel = 'view'
): Promise<boolean> {
  // Admins bypass all checks
  if (await isAdmin(userId)) {
    return true;
  }
  
  // Get folder to find event
  const folder = await eventFileService.getFolder(folderId);
  if (!folder) return false;
  
  // Check folder-specific permission first
  const [folderPermission] = await db
    .select()
    .from(eventFolderPermissions)
    .where(and(
      eq(eventFolderPermissions.eventFolderId, folderId),
      eq(eventFolderPermissions.userId, userId)
    ));
  
  if (folderPermission) {
    return hasRequiredPermission(folderPermission.permissionLevel as PermissionLevel, requiredLevel);
  }
  
  // Fall back to event-level access (with inheritance)
  return checkEventAccess(userId, folder.eventId, requiredLevel);
}

/**
 * Check if user has access to a specific file
 */
export async function checkFileAccess(
  userId: number,
  fileId: number,
  requiredLevel: PermissionLevel = 'view'
): Promise<boolean> {
  // Admins bypass all checks
  if (await isAdmin(userId)) {
    return true;
  }
  
  const file = await eventFileService.getFile(fileId);
  if (!file) return false;
  
  return checkFolderAccess(userId, file.eventFolderId, requiredLevel);
}

/**
 * Helper to check if permission level meets requirement
 */
function hasRequiredPermission(current: PermissionLevel, required: PermissionLevel): boolean {
  return PERMISSION_HIERARCHY[current] >= PERMISSION_HIERARCHY[required];
}

// ==================== Event Access Grants ====================

/**
 * Grant event-wide file access to a user
 */
export async function grantEventAccess(
  eventId: string,
  userId: number,
  permissionLevel: PermissionLevel,
  grantedByUserId: number,
  templateId?: number
): Promise<EventAccessGrant> {
  // Check if grant already exists
  const [existing] = await db
    .select()
    .from(eventAccessGrants)
    .where(and(
      eq(eventAccessGrants.eventId, eventId),
      eq(eventAccessGrants.userId, userId)
    ));
  
  if (existing) {
    // Update existing grant
    const [updated] = await db
      .update(eventAccessGrants)
      .set({
        permissionLevel,
        templateId,
        grantedByUserId,
        grantedAt: new Date(),
      })
      .where(eq(eventAccessGrants.id, existing.id))
      .returning();
    
    console.log(`[FolderPermissionService] Updated event access for user ${userId} on event ${eventId}`);
    return updated;
  }
  
  // Create new grant
  const [grant] = await db
    .insert(eventAccessGrants)
    .values({
      eventId,
      userId,
      permissionLevel,
      templateId,
      grantedByUserId,
    })
    .returning();
  
  console.log(`[FolderPermissionService] Granted ${permissionLevel} access for user ${userId} on event ${eventId}`);
  return grant;
}

/**
 * Revoke event-wide file access from a user
 */
export async function revokeEventAccess(
  eventId: string,
  userId: number
): Promise<boolean> {
  const result = await db
    .delete(eventAccessGrants)
    .where(and(
      eq(eventAccessGrants.eventId, eventId),
      eq(eventAccessGrants.userId, userId)
    ))
    .returning();
  
  if (result.length > 0) {
    console.log(`[FolderPermissionService] Revoked event access for user ${userId} on event ${eventId}`);
    return true;
  }
  return false;
}

/**
 * Get all users with access to an event
 */
export async function getEventAccessUsers(eventId: string): Promise<Array<EventAccessGrant & { user: User }>> {
  const results = await db
    .select()
    .from(eventAccessGrants)
    .innerJoin(users, eq(eventAccessGrants.userId, users.id))
    .where(eq(eventAccessGrants.eventId, eventId));
  
  return results.map(r => ({
    ...r.event_access_grants,
    user: r.users,
  }));
}

/**
 * Get all events a user has access to
 */
export async function getUserAccessibleEvents(userId: number): Promise<string[]> {
  // Admins have access to all events
  if (await isAdmin(userId)) {
    const allEvents = await db.select({ id: events.id }).from(events);
    return allEvents.map(e => e.id);
  }
  
  const grants = await db
    .select({ eventId: eventAccessGrants.eventId })
    .from(eventAccessGrants)
    .where(eq(eventAccessGrants.userId, userId));
  
  return grants.map(g => g.eventId);
}

// ==================== Folder Permissions ====================

/**
 * Grant folder-level permission to a user
 * This overrides event-level access for specific folders
 */
export async function grantFolderAccess(
  folderId: number,
  userId: number,
  permissionLevel: PermissionLevel,
  grantedByUserId: number
): Promise<EventFolderPermission> {
  // Check if permission already exists
  const [existing] = await db
    .select()
    .from(eventFolderPermissions)
    .where(and(
      eq(eventFolderPermissions.eventFolderId, folderId),
      eq(eventFolderPermissions.userId, userId)
    ));
  
  if (existing) {
    // Update existing permission
    const [updated] = await db
      .update(eventFolderPermissions)
      .set({
        permissionLevel,
        grantedByUserId,
        grantedAt: new Date(),
      })
      .where(eq(eventFolderPermissions.id, existing.id))
      .returning();
    
    console.log(`[FolderPermissionService] Updated folder permission for user ${userId} on folder ${folderId}`);
    return updated;
  }
  
  // Create new permission
  const [permission] = await db
    .insert(eventFolderPermissions)
    .values({
      eventFolderId: folderId,
      userId,
      permissionLevel,
      grantedByUserId,
    })
    .returning();
  
  console.log(`[FolderPermissionService] Granted ${permissionLevel} permission for user ${userId} on folder ${folderId}`);
  return permission;
}

/**
 * Revoke folder-level permission from a user
 */
export async function revokeFolderAccess(
  folderId: number,
  userId: number
): Promise<boolean> {
  const result = await db
    .delete(eventFolderPermissions)
    .where(and(
      eq(eventFolderPermissions.eventFolderId, folderId),
      eq(eventFolderPermissions.userId, userId)
    ))
    .returning();
  
  if (result.length > 0) {
    console.log(`[FolderPermissionService] Revoked folder permission for user ${userId} on folder ${folderId}`);
    return true;
  }
  return false;
}

/**
 * Get all users with access to a specific folder
 */
export async function getFolderAccessUsers(folderId: number): Promise<Array<EventFolderPermission & { user: User }>> {
  const results = await db
    .select()
    .from(eventFolderPermissions)
    .innerJoin(users, eq(eventFolderPermissions.userId, users.id))
    .where(eq(eventFolderPermissions.eventFolderId, folderId));
  
  return results.map(r => ({
    ...r.event_folder_permissions,
    user: r.users,
  }));
}

// ==================== Permission Templates ====================

/**
 * Create a permission template
 */
export async function createTemplate(
  data: InsertFolderAccessTemplate
): Promise<FolderAccessTemplate> {
  const [template] = await db
    .insert(folderAccessTemplates)
    .values(data)
    .returning();
  
  console.log(`[FolderPermissionService] Created template: ${template.name}`);
  return template;
}

/**
 * Update a permission template
 */
export async function updateTemplate(
  id: number,
  data: UpdateFolderAccessTemplate
): Promise<FolderAccessTemplate | undefined> {
  const [template] = await db
    .update(folderAccessTemplates)
    .set(data)
    .where(eq(folderAccessTemplates.id, id))
    .returning();
  
  if (template) {
    console.log(`[FolderPermissionService] Updated template: ${template.name}`);
  }
  return template;
}

/**
 * Delete a permission template
 */
export async function deleteTemplate(id: number): Promise<boolean> {
  const result = await db
    .delete(folderAccessTemplates)
    .where(eq(folderAccessTemplates.id, id))
    .returning();
  
  return result.length > 0;
}

/**
 * Get all permission templates
 */
export async function getAllTemplates(): Promise<FolderAccessTemplate[]> {
  return await db
    .select()
    .from(folderAccessTemplates)
    .orderBy(desc(folderAccessTemplates.isDefault), folderAccessTemplates.name);
}

/**
 * Get template by ID
 */
export async function getTemplate(id: number): Promise<FolderAccessTemplate | undefined> {
  const [template] = await db
    .select()
    .from(folderAccessTemplates)
    .where(eq(folderAccessTemplates.id, id));
  return template;
}

/**
 * Get default template
 */
export async function getDefaultTemplate(): Promise<FolderAccessTemplate | undefined> {
  const [template] = await db
    .select()
    .from(folderAccessTemplates)
    .where(eq(folderAccessTemplates.isDefault, true));
  return template;
}

/**
 * Set a template as default (unsets other defaults)
 */
export async function setDefaultTemplate(id: number): Promise<FolderAccessTemplate | undefined> {
  // Unset all other defaults
  await db
    .update(folderAccessTemplates)
    .set({ isDefault: false })
    .where(eq(folderAccessTemplates.isDefault, true));
  
  // Set new default
  const [template] = await db
    .update(folderAccessTemplates)
    .set({ isDefault: true })
    .where(eq(folderAccessTemplates.id, id))
    .returning();
  
  return template;
}

/**
 * Apply a template to grant event access
 */
export async function applyTemplateToEvent(
  eventId: string,
  userId: number,
  templateId: number,
  grantedByUserId: number
): Promise<EventAccessGrant> {
  const template = await getTemplate(templateId);
  if (!template) {
    throw new Error(`Template ${templateId} not found`);
  }
  
  // Determine permission level from template
  const permissions = template.permissions as Record<string, boolean>;
  let permissionLevel: PermissionLevel = 'view';
  
  if (permissions.canManage) {
    permissionLevel = 'manage';
  } else if (permissions.canUpload) {
    permissionLevel = 'upload';
  }
  
  return grantEventAccess(eventId, userId, permissionLevel, grantedByUserId, templateId);
}

/**
 * Get user's effective permission for an event
 */
export async function getUserEventPermission(
  userId: number,
  eventId: string
): Promise<{ level: PermissionLevel; isAdmin: boolean } | null> {
  const admin = await isAdmin(userId);
  if (admin) {
    return { level: 'manage', isAdmin: true };
  }
  
  const [grant] = await db
    .select()
    .from(eventAccessGrants)
    .where(and(
      eq(eventAccessGrants.eventId, eventId),
      eq(eventAccessGrants.userId, userId)
    ));
  
  if (!grant) return null;
  
  return { level: grant.permissionLevel as PermissionLevel, isAdmin: false };
}

/**
 * Get user's effective permission for a folder
 */
export async function getUserFolderPermission(
  userId: number,
  folderId: number
): Promise<{ level: PermissionLevel; isAdmin: boolean; source: 'folder' | 'event' } | null> {
  const admin = await isAdmin(userId);
  if (admin) {
    return { level: 'manage', isAdmin: true, source: 'folder' };
  }
  
  // Check folder-specific permission
  const [folderPermission] = await db
    .select()
    .from(eventFolderPermissions)
    .where(and(
      eq(eventFolderPermissions.eventFolderId, folderId),
      eq(eventFolderPermissions.userId, userId)
    ));
  
  if (folderPermission) {
    return { level: folderPermission.permissionLevel as PermissionLevel, isAdmin: false, source: 'folder' };
  }
  
  // Fall back to event-level
  const folder = await eventFileService.getFolder(folderId);
  if (!folder) return null;
  
  const eventPermission = await getUserEventPermission(userId, folder.eventId);
  if (!eventPermission) return null;
  
  return { ...eventPermission, source: 'event' };
}

export const folderPermissionService = {
  isAdmin,
  isAdminRole,
  checkEventAccess,
  checkFolderAccess,
  checkFileAccess,
  grantEventAccess,
  revokeEventAccess,
  getEventAccessUsers,
  getUserAccessibleEvents,
  grantFolderAccess,
  revokeFolderAccess,
  getFolderAccessUsers,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getAllTemplates,
  getTemplate,
  getDefaultTemplate,
  setDefaultTemplate,
  applyTemplateToEvent,
  getUserEventPermission,
  getUserFolderPermission,
};
