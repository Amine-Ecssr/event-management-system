import { useState } from 'react';
import { Permission } from '@/hooks/use-permissions';
import { useGrantPermission, useRevokePermission, useResetPermission } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  getCategoryDisplayName, 
  getCategoryIcon, 
  getCategoryColor,
  formatAction,
  sortCategoriesByImportance,
  getExpirationText,
  getPermissionSourceLabel
} from '@/lib/permissions';
import { AlertTriangle, Info, Calendar, RotateCcw, Shield, Clock } from 'lucide-react';

interface UserPermissionEditorProps {
  userId: number;
  userRole: string;
  userName: string;
  permissionsByCategory: Record<string, Permission[]>;
  userPermissions: Permission[];
}

export function UserPermissionEditor({
  userId,
  userRole,
  userName,
  permissionsByCategory,
  userPermissions,
}: UserPermissionEditorProps) {
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
  const [showGrantDialog, setShowGrantDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const grantMutation = useGrantPermission();
  const revokeMutation = useRevokePermission();
  const resetMutation = useResetPermission();

  // Create a map of permission name to user permission
  const userPermMap = userPermissions.reduce((acc, perm) => {
    acc[perm.name] = perm;
    return acc;
  }, {} as Record<string, Permission>);

  const handlePermissionClick = (permission: Permission, action: 'grant' | 'revoke' | 'reset') => {
    setSelectedPermission(permission);
    setReason('');
    setExpiresAt('');
    
    if (action === 'grant') {
      setShowGrantDialog(true);
    } else if (action === 'revoke') {
      setShowRevokeDialog(true);
    } else {
      setShowResetDialog(true);
    }
  };

  const handleGrant = () => {
    if (!selectedPermission) return;
    
    grantMutation.mutate({
      userId,
      permissionName: selectedPermission.name,
      reason,
      expiresAt: expiresAt || undefined,
    }, {
      onSuccess: () => {
        setShowGrantDialog(false);
        setSelectedPermission(null);
        setReason('');
        setExpiresAt('');
      }
    });
  };

  const handleRevoke = () => {
    if (!selectedPermission) return;
    
    revokeMutation.mutate({
      userId,
      permissionName: selectedPermission.name,
      reason,
    }, {
      onSuccess: () => {
        setShowRevokeDialog(false);
        setSelectedPermission(null);
        setReason('');
      }
    });
  };

  const handleReset = () => {
    if (!selectedPermission) return;
    
    resetMutation.mutate({
      userId,
      permissionName: selectedPermission.name,
      reason,
    }, {
      onSuccess: () => {
        setShowResetDialog(false);
        setSelectedPermission(null);
        setReason('');
      }
    });
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const sortedCategories = sortCategoriesByImportance(Object.keys(permissionsByCategory));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Permissions for {userName}</h3>
          <p className="text-sm text-muted-foreground">
            Role: <Badge variant="outline">{userRole}</Badge>
          </p>
        </div>
      </div>

      {/* Legend */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="flex flex-wrap gap-4 text-sm">
          <span className="flex items-center gap-1">
            <Badge variant="secondary">📋</Badge> From Role
          </span>
          <span className="flex items-center gap-1">
            <Badge variant="default">✓</Badge> Custom Grant
          </span>
          <span className="flex items-center gap-1">
            <Badge variant="destructive">✗</Badge> Custom Deny
          </span>
        </AlertDescription>
      </Alert>

      {/* Permissions by category */}
      <div className="space-y-3">
        {sortedCategories.map(category => {
          const permissions = permissionsByCategory[category];
          const isExpanded = expandedCategories.has(category);

          return (
            <Card key={category}>
              <CardHeader 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleCategory(category)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getCategoryIcon(category)}</span>
                    <CardTitle className="text-base">
                      {getCategoryDisplayName(category)}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {permissions.length}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm">
                    {isExpanded ? '▼' : '▶'}
                  </Button>
                </div>
              </CardHeader>
              
              {isExpanded && (
                <CardContent className="space-y-2">
                  {permissions.map(permission => {
                    const userPerm = userPermMap[permission.name];
                    const isGranted = userPerm?.granted ?? false;
                    const isCustom = userPerm?.source === 'user';
                    const expirationText = userPerm?.expiresAt ? getExpirationText(userPerm.expiresAt) : null;

                    return (
                      <div
                        key={permission.name}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-2 h-2 rounded-full ${isGranted ? 'bg-green-500' : 'bg-gray-300'}`} />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Label className="font-medium cursor-pointer">
                                {formatAction(permission.action)}
                              </Label>
                              
                              {permission.isDangerous && (
                                <AlertTriangle className="h-3 w-3 text-amber-500" title="Dangerous permission" />
                              )}
                              
                              {isCustom ? (
                                <Badge variant={isGranted ? 'default' : 'destructive'} className="text-xs">
                                  {isGranted ? '✓ Custom' : '✗ Denied'}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  📋 Role
                                </Badge>
                              )}
                              
                              {expirationText && (
                                <Badge variant="outline" className="text-xs flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {expirationText}
                                </Badge>
                              )}
                            </div>
                            
                            <p className="text-xs text-muted-foreground mt-1">
                              {permission.description}
                            </p>
                            
                            {userPerm?.reason && (
                              <p className="text-xs text-muted-foreground italic mt-1">
                                Reason: {userPerm.reason}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isCustom ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePermissionClick(permission, 'reset')}
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Reset
                              </Button>
                            </>
                          ) : (
                            <>
                              {isGranted ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePermissionClick(permission, 'revoke')}
                                >
                                  Revoke
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handlePermissionClick(permission, 'grant')}
                                >
                                  Grant
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Grant Permission Dialog */}
      <Dialog open={showGrantDialog} onOpenChange={setShowGrantDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Permission</DialogTitle>
            <DialogDescription>
              Grant "{selectedPermission?.description}" to {userName}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPermission?.isDangerous && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This is a dangerous permission. Grant with caution.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-4">
            <div>
              <Label>Reason (optional)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this permission being granted?"
              />
            </div>
            
            <div>
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Expires At (optional)
              </Label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty for permanent access
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGrantDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleGrant} disabled={grantMutation.isPending}>
              {grantMutation.isPending ? 'Granting...' : 'Grant Permission'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Permission Dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Permission</DialogTitle>
            <DialogDescription>
              Revoke "{selectedPermission?.description}" from {userName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                This will explicitly deny this permission to the user, overriding their role's default.
              </AlertDescription>
            </Alert>
            
            <div>
              <Label>Reason (optional)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this permission being revoked?"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevokeDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revokeMutation.isPending}>
              {revokeMutation.isPending ? 'Revoking...' : 'Revoke Permission'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Permission Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Permission</DialogTitle>
            <DialogDescription>
              Reset "{selectedPermission?.description}" to role default for {userName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                This will remove the custom permission override and revert to the default permission from their role.
              </AlertDescription>
            </Alert>
            
            <div>
              <Label>Reason (optional)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this permission being reset?"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleReset} disabled={resetMutation.isPending}>
              {resetMutation.isPending ? 'Resetting...' : 'Reset to Role Default'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
