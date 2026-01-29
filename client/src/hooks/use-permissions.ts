import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Types
export interface Permission {
  id: number;
  name: string;
  resource: string;
  action: string;
  description: string;
  category: string;
  isDangerous: boolean;
  granted?: boolean;
  source?: 'role' | 'user';
  expiresAt?: string | null;
  reason?: string | null;
  grantedBy?: number | null;
}

export interface PermissionsByCategory {
  [category: string]: Permission[];
}

export interface AuditLogEntry {
  id: number;
  permission: Permission;
  action: string;
  granted: boolean | null;
  grantedBy: number;
  reason: string | null;
  ipAddress: string | null;
  createdAt: string;
}

/**
 * Get all available permissions (grouped by category)
 */
export function usePermissions() {
  return useQuery<PermissionsByCategory>({
    queryKey: ['/api/permissions'],
  });
}

/**
 * Get permissions for a specific user
 */
export function useUserPermissions(userId: number | undefined) {
  return useQuery<Permission[]>({
    queryKey: [`/api/users/${userId}/permissions`],
    enabled: !!userId,
  });
}

/**
 * Get current user's permissions
 */
export function useMyPermissions() {
  return useQuery<Permission[]>({
    queryKey: ['/api/permissions/me'],
  });
}

/**
 * Check if current user has a specific permission
 */
export function useHasPermission(permissionName: string) {
  const { data } = useQuery<{ hasPermission: boolean }>({
    queryKey: [`/api/permissions/check/${permissionName}`],
    enabled: !!permissionName,
    staleTime: 5 * 60 * 1000,
  });

  return {
    hasPermission: data?.hasPermission ?? false,
  };
}

/**
 * Grant permission to user
 */
export function useGrantPermission() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      userId,
      permissionName,
      reason,
      expiresAt,
    }: {
      userId: number;
      permissionName: string;
      reason?: string;
      expiresAt?: string;
    }) => {
      return apiRequest('POST', `/api/users/${userId}/permissions`, {
        permissionName,
        reason,
        expiresAt,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/users/${variables.userId}/permissions`] 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/permissions/me'] });
      toast({
        title: 'Permission Granted',
        description: 'Permission granted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to grant permission',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Revoke permission from user
 */
export function useRevokePermission() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      userId,
      permissionName,
      reason,
    }: {
      userId: number;
      permissionName: string;
      reason?: string;
    }) => {
      return apiRequest(
        'DELETE',
        `/api/users/${userId}/permissions/${permissionName}`,
        { reason }
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/users/${variables.userId}/permissions`] 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/permissions/me'] });
      toast({
        title: 'Permission Revoked',
        description: 'Permission revoked successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to revoke permission',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Reset user permission to role default
 */
export function useResetPermission() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      userId,
      permissionName,
      reason,
    }: {
      userId: number;
      permissionName: string;
      reason?: string;
    }) => {
      return apiRequest(
        'POST',
        `/api/users/${userId}/permissions/${permissionName}/reset`,
        { reason }
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/users/${variables.userId}/permissions`] 
      });
      toast({
        title: 'Permission Reset',
        description: 'Permission reset to role default',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset permission',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Get permission audit log for a user
 */
export function usePermissionAuditLog(userId: number | undefined, limit = 50) {
  return useQuery<AuditLogEntry[]>({
    queryKey: [`/api/users/${userId}/permissions/audit`, { limit }],
    enabled: !!userId,
  });
}
