import { Request, Response, NextFunction } from 'express';
import { permissionService } from '../services/permissionService';

/**
 * Middleware to check if user has a required permission
 */
export function requirePermission(permissionName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
      const hasPermission = await permissionService.hasPermission(
        req.user.id,
        permissionName
      );
      
      if (!hasPermission) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: permissionName,
          message: `You need the '${permissionName}' permission to perform this action`
        });
      }
      
      next();
    } catch (error) {
      console.error('Error checking permission:', error);
      return res.status(500).json({ error: 'Error checking permissions' });
    }
  };
}

/**
 * Middleware to check if user has ANY of the required permissions
 */
export function requireAnyPermission(...permissionNames: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
      const hasAny = await permissionService.hasAnyPermission(
        req.user.id,
        permissionNames
      );
      
      if (!hasAny) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: permissionNames,
          message: `You need at least one of these permissions: ${permissionNames.join(', ')}`
        });
      }
      
      next();
    } catch (error) {
      console.error('Error checking permissions:', error);
      return res.status(500).json({ error: 'Error checking permissions' });
    }
  };
}

/**
 * Middleware to check if user has ALL required permissions
 */
export function requireAllPermissions(...permissionNames: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
      const hasAll = await permissionService.hasAllPermissions(
        req.user.id,
        permissionNames
      );
      
      if (!hasAll) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: permissionNames,
          message: `You need all of these permissions: ${permissionNames.join(', ')}`
        });
      }
      
      next();
    } catch (error) {
      console.error('Error checking permissions:', error);
      return res.status(500).json({ error: 'Error checking permissions' });
    }
  };
}

/**
 * Optional permission check - adds hasPermission flag to request but doesn't block
 */
export function checkPermission(permissionName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      (req as any).hasPermission = false;
      return next();
    }
    
    try {
      const hasPermission = await permissionService.hasPermission(
        req.user.id,
        permissionName
      );
      
      (req as any).hasPermission = hasPermission;
      next();
    } catch (error) {
      console.error('Error checking permission:', error);
      (req as any).hasPermission = false;
      next();
    }
  };
}
