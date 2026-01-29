import { db } from '../db';
import { 
  permissions, 
  rolePermissions, 
  userPermissions, 
  permissionAuditLog,
  users 
} from '@shared/schema';
import { eq, and, or, gte, sql } from 'drizzle-orm';

export class PermissionService {
  /**
   * Check if user has a specific permission
   * Combines role-based and user-specific permissions
   */
  async hasPermission(
    userId: number, 
    permissionName: string
  ): Promise<boolean> {
    try {
      // Get user's role
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });
      
      if (!user) return false;
      
      // Superadmin has all permissions
      if (user.role === 'superadmin') return true;
      
      // Get permission ID
      const permission = await db.query.permissions.findFirst({
        where: eq(permissions.name, permissionName)
      });
      
      if (!permission) {
        console.warn(`Permission not found: ${permissionName}`);
        return false;
      }
      
      // Check user-specific override first (with expiration check)
      const userPerm = await db.query.userPermissions.findFirst({
        where: and(
          eq(userPermissions.userId, userId),
          eq(userPermissions.permissionId, permission.id),
          or(
            eq(userPermissions.expiresAt, null),
            gte(userPermissions.expiresAt, new Date())
          )
        )
      });
      
      // User override takes precedence
      if (userPerm !== undefined) {
        return userPerm.granted;
      }
      
      // Check role-based permission
      const rolePerm = await db.query.rolePermissions.findFirst({
        where: and(
          eq(rolePermissions.role, user.role),
          eq(rolePermissions.permissionId, permission.id)
        )
      });
      
      return rolePerm?.granted ?? false;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }
  
  /**
   * Check if user has any of the specified permissions
   */
  async hasAnyPermission(userId: number, permissionNames: string[]): Promise<boolean> {
    for (const permName of permissionNames) {
      if (await this.hasPermission(userId, permName)) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Check if user has all specified permissions
   */
  async hasAllPermissions(userId: number, permissionNames: string[]): Promise<boolean> {
    for (const permName of permissionNames) {
      if (!await this.hasPermission(userId, permName)) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Get all permissions for a user (role + overrides)
   * Returns array with source information (role/user)
   */
  async getUserPermissions(userId: number) {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });
      
      if (!user) return [];
      
      // If superadmin, return all permissions as granted
      if (user.role === 'superadmin') {
        const allPerms = await db.query.permissions.findMany();
        return allPerms.map(perm => ({
          ...perm,
          granted: true,
          source: 'role' as const,
          reason: 'Superadmin has all permissions'
        }));
      }
      
      // Get role permissions
      const rolePerms = await db
        .select({
          permission: permissions,
          granted: rolePermissions.granted
        })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(eq(rolePermissions.role, user.role));
      
      // Get user overrides (non-expired only)
      const userPerms = await db
        .select({
          permission: permissions,
          granted: userPermissions.granted,
          reason: userPermissions.reason,
          expiresAt: userPermissions.expiresAt,
          grantedBy: userPermissions.grantedBy
        })
        .from(userPermissions)
        .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
        .where(
          and(
            eq(userPermissions.userId, userId),
            or(
              eq(userPermissions.expiresAt, null),
              gte(userPermissions.expiresAt, new Date())
            )
          )
        );
      
      // Create permission map
      const permissionMap = new Map();
      
      // Add role permissions
      rolePerms.forEach(rp => {
        permissionMap.set(rp.permission.name, {
          ...rp.permission,
          granted: rp.granted,
          source: 'role' as const
        });
      });
      
      // Override with user permissions
      userPerms.forEach(up => {
        permissionMap.set(up.permission.name, {
          ...up.permission,
          granted: up.granted,
          source: 'user' as const,
          expiresAt: up.expiresAt,
          reason: up.reason,
          grantedBy: up.grantedBy
        });
      });
      
      return Array.from(permissionMap.values());
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return [];
    }
  }
  
  /**
   * Get all permissions grouped by category
   */
  async getAllPermissionsGrouped() {
    try {
      const allPerms = await db.query.permissions.findMany({
        orderBy: [permissions.category, permissions.name]
      });
      
      // Group by category
      const grouped = allPerms.reduce((acc, perm) => {
        const category = perm.category || 'other';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(perm);
        return acc;
      }, {} as Record<string, typeof allPerms>);
      
      return grouped;
    } catch (error) {
      console.error('Error getting permissions:', error);
      return {};
    }
  }
  
  /**
   * Grant permission to user
   */
  async grantPermission(
    userId: number,
    permissionName: string,
    grantedBy: number,
    reason?: string,
    expiresAt?: Date
  ) {
    try {
      const permission = await db.query.permissions.findFirst({
        where: eq(permissions.name, permissionName)
      });
      
      if (!permission) {
        throw new Error(`Permission ${permissionName} not found`);
      }
      
      // Insert or update user permission
      await db.insert(userPermissions)
        .values({
          userId,
          permissionId: permission.id,
          granted: true,
          grantedBy,
          reason,
          expiresAt
        })
        .onConflictDoUpdate({
          target: [userPermissions.userId, userPermissions.permissionId],
          set: {
            granted: true,
            grantedBy,
            reason,
            expiresAt,
            updatedAt: new Date()
          }
        });
      
      // Audit log
      await this.logPermissionChange(
        userId,
        permission.id,
        'granted',
        true,
        grantedBy,
        reason
      );
      
      return { success: true, message: 'Permission granted successfully' };
    } catch (error) {
      console.error('Error granting permission:', error);
      throw error;
    }
  }
  
  /**
   * Revoke permission from user
   */
  async revokePermission(
    userId: number,
    permissionName: string,
    revokedBy: number,
    reason?: string
  ) {
    try {
      const permission = await db.query.permissions.findFirst({
        where: eq(permissions.name, permissionName)
      });
      
      if (!permission) {
        throw new Error(`Permission ${permissionName} not found`);
      }
      
      // Set granted to false (don't delete, keep audit trail)
      await db.insert(userPermissions)
        .values({
          userId,
          permissionId: permission.id,
          granted: false,
          grantedBy: revokedBy,
          reason
        })
        .onConflictDoUpdate({
          target: [userPermissions.userId, userPermissions.permissionId],
          set: {
            granted: false,
            grantedBy: revokedBy,
            reason,
            updatedAt: new Date()
          }
        });
      
      // Audit log
      await this.logPermissionChange(
        userId,
        permission.id,
        'revoked',
        false,
        revokedBy,
        reason
      );
      
      return { success: true, message: 'Permission revoked successfully' };
    } catch (error) {
      console.error('Error revoking permission:', error);
      throw error;
    }
  }
  
  /**
   * Remove user permission override (revert to role default)
   */
  async removeUserPermission(
    userId: number,
    permissionName: string,
    removedBy: number,
    reason?: string
  ) {
    try {
      const permission = await db.query.permissions.findFirst({
        where: eq(permissions.name, permissionName)
      });
      
      if (!permission) {
        throw new Error(`Permission ${permissionName} not found`);
      }
      
      // Delete user permission override
      await db.delete(userPermissions)
        .where(
          and(
            eq(userPermissions.userId, userId),
            eq(userPermissions.permissionId, permission.id)
          )
        );
      
      // Audit log
      await this.logPermissionChange(
        userId,
        permission.id,
        'removed',
        null,
        removedBy,
        reason
      );
      
      return { success: true, message: 'Permission override removed successfully' };
    } catch (error) {
      console.error('Error removing permission:', error);
      throw error;
    }
  }
  
  /**
   * Get permission audit log for a user
   */
  async getPermissionAuditLog(userId: number, limit: number = 50) {
    try {
      const logs = await db
        .select({
          id: permissionAuditLog.id,
          permission: permissions,
          action: permissionAuditLog.action,
          granted: permissionAuditLog.granted,
          grantedBy: permissionAuditLog.grantedBy,
          reason: permissionAuditLog.reason,
          ipAddress: permissionAuditLog.ipAddress,
          createdAt: permissionAuditLog.createdAt
        })
        .from(permissionAuditLog)
        .innerJoin(permissions, eq(permissionAuditLog.permissionId, permissions.id))
        .where(eq(permissionAuditLog.userId, userId))
        .orderBy(sql`${permissionAuditLog.createdAt} DESC`)
        .limit(limit);
      
      return logs;
    } catch (error) {
      console.error('Error getting audit log:', error);
      return [];
    }
  }
  
  /**
   * Log permission change for audit
   */
  private async logPermissionChange(
    userId: number,
    permissionId: number,
    action: string,
    granted: boolean | null,
    grantedBy: number,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    try {
      await db.insert(permissionAuditLog).values({
        userId,
        permissionId,
        action,
        granted,
        grantedBy,
        reason,
        ipAddress,
        userAgent
      });
    } catch (error) {
      console.error('Error logging permission change:', error);
      // Don't throw - audit log failure shouldn't stop the operation
    }
  }
  
  /**
   * Clean up expired permissions
   */
  async cleanupExpiredPermissions() {
    try {
      const result = await db.delete(userPermissions)
        .where(
          and(
            sql`${userPermissions.expiresAt} IS NOT NULL`,
            sql`${userPermissions.expiresAt} < NOW()`
          )
        );
      
      console.log(`Cleaned up ${result.rowCount} expired permissions`);
      return result.rowCount;
    } catch (error) {
      console.error('Error cleaning up expired permissions:', error);
      return 0;
    }
  }
}

export const permissionService = new PermissionService();
