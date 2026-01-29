import { usePermissionAuditLog } from '@/hooks/use-permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, History, CheckCircle, XCircle, RotateCcw, Info } from 'lucide-react';
import { formatDistance } from 'date-fns';

interface PermissionAuditLogProps {
  userId: number;
  userName: string;
  limit?: number;
}

export function PermissionAuditLog({ userId, userName, limit = 50 }: PermissionAuditLogProps) {
  const { data: auditLog, isLoading } = usePermissionAuditLog(userId, limit);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Permission History
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'granted':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'revoked':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'removed':
        return <RotateCcw className="h-4 w-4 text-blue-600" />;
      default:
        return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'granted':
        return <Badge className="bg-green-100 text-green-700">Granted</Badge>;
      case 'revoked':
        return <Badge className="bg-red-100 text-red-700">Revoked</Badge>;
      case 'removed':
        return <Badge className="bg-blue-100 text-blue-700">Reset</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Permission History
        </CardTitle>
        <CardDescription>
          Recent permission changes for {userName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!auditLog || auditLog.length === 0 ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No permission changes recorded yet.
            </AlertDescription>
          </Alert>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {auditLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0 mt-1">
                    {getActionIcon(entry.action)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getActionBadge(entry.action)}
                      <span className="font-medium">{entry.permission.description}</span>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="font-mono text-xs">{entry.permission.name}</span>
                    </p>
                    
                    {entry.reason && (
                      <p className="text-sm text-muted-foreground italic mt-2">
                        "{entry.reason}"
                      </p>
                    )}
                    
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>
                        {formatDistance(new Date(entry.createdAt), new Date(), { addSuffix: true })}
                      </span>
                      
                      {entry.ipAddress && (
                        <span className="flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                          {entry.ipAddress}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
