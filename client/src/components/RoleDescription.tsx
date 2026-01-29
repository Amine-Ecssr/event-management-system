import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { getRoleDescription, UserRole } from '@/lib/roles';

interface RoleDescriptionProps {
  role: UserRole | string;
  className?: string;
}

/**
 * Displays a user-friendly description of a role
 */
export function RoleDescription({ role, className }: RoleDescriptionProps) {
  const description = getRoleDescription(role);
  
  return (
    <Alert className={className}>
      <Info className="h-4 w-4" />
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}
