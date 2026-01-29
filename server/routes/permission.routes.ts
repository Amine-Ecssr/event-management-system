import { Router, Request, Response } from 'express';
import { permissionService } from '../services/permissionService';
import { isSuperAdmin, isAuthenticated } from '../auth';
import { requirePermission } from '../middleware/permissions';
import { z } from 'zod';

const router = Router();

/**
 * Get all available permissions (grouped by category)
 */
router.get('/api/permissions', 
  isAuthenticated,
  requirePermission('users.manage_permissions'),
  async (req: Request, res: Response) => {
    try {
      const permissions = await permissionService.getAllPermissionsGrouped();
      res.json(permissions);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      res.status(500).json({ error: 'Failed to fetch permissions' });
    }
  }
);

/**
 * Get user's permissions
 */
router.get('/api/users/:userId/permissions',
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // Users can view their own permissions, or admins can view anyone's
      const canView = 
        req.user!.id === userId ||
        await permissionService.hasPermission(req.user!.id, 'users.read');
      
      if (!canView) {
        return res.status(403).json({ error: 'Cannot view this user\'s permissions' });
      }
      
      const permissions = await permissionService.getUserPermissions(userId);
      res.json(permissions);
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      res.status(500).json({ error: 'Failed to fetch user permissions' });
    }
  }
);

/**
 * Get current user's permissions
 */
router.get('/api/permissions/me',
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const permissions = await permissionService.getUserPermissions(req.user!.id);
      res.json(permissions);
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      res.status(500).json({ error: 'Failed to fetch user permissions' });
    }
  }
);

/**
 * Grant permission to user
 */
const grantPermissionSchema = z.object({
  permissionName: z.string().min(1),
  reason: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

router.post('/api/users/:userId/permissions',
  isAuthenticated,
  requirePermission('users.manage_permissions'),
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const body = grantPermissionSchema.parse(req.body);
      
      await permissionService.grantPermission(
        userId,
        body.permissionName,
        req.user!.id,
        body.reason,
        body.expiresAt ? new Date(body.expiresAt) : undefined
      );
      
      res.json({ message: 'Permission granted successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      console.error('Error granting permission:', error);
      res.status(500).json({ error: error.message || 'Failed to grant permission' });
    }
  }
);

/**
 * Revoke permission from user
 */
const revokePermissionSchema = z.object({
  reason: z.string().optional(),
});

router.delete('/api/users/:userId/permissions/:permissionName',
  isAuthenticated,
  requirePermission('users.manage_permissions'),
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const { permissionName } = req.params;
      const body = revokePermissionSchema.parse(req.body);
      
      await permissionService.revokePermission(
        userId,
        permissionName,
        req.user!.id,
        body.reason
      );
      
      res.json({ message: 'Permission revoked successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors });
      }
      console.error('Error revoking permission:', error);
      res.status(500).json({ error: error.message || 'Failed to revoke permission' });
    }
  }
);

/**
 * Remove user permission override (revert to role default)
 */
router.post('/api/users/:userId/permissions/:permissionName/reset',
  isAuthenticated,
  requirePermission('users.manage_permissions'),
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const { permissionName } = req.params;
      const { reason } = req.body;
      
      await permissionService.removeUserPermission(
        userId,
        permissionName,
        req.user!.id,
        reason
      );
      
      res.json({ message: 'Permission override removed successfully' });
    } catch (error) {
      console.error('Error removing permission:', error);
      res.status(500).json({ error: error.message || 'Failed to remove permission' });
    }
  }
);

/**
 * Check if current user has a specific permission
 */
router.get('/api/permissions/check/:permissionName',
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { permissionName } = req.params;
      const hasPermission = await permissionService.hasPermission(
        req.user!.id,
        permissionName
      );
      res.json({ hasPermission, permissionName });
    } catch (error) {
      console.error('Error checking permission:', error);
      res.status(500).json({ error: 'Failed to check permission' });
    }
  }
);

/**
 * Get permission audit log for a user
 */
router.get('/api/users/:userId/permissions/audit',
  isAuthenticated,
  requirePermission('users.read'),
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      const auditLog = await permissionService.getPermissionAuditLog(userId, limit);
      res.json(auditLog);
    } catch (error) {
      console.error('Error fetching audit log:', error);
      res.status(500).json({ error: 'Failed to fetch audit log' });
    }
  }
);

/**
 * Cleanup expired permissions (admin only, typically called by cron)
 */
router.post('/api/permissions/cleanup-expired',
  isSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const count = await permissionService.cleanupExpiredPermissions();
      res.json({ message: `Cleaned up ${count} expired permissions` });
    } catch (error) {
      console.error('Error cleaning up permissions:', error);
      res.status(500).json({ error: 'Failed to cleanup permissions' });
    }
  }
);

export default router;
