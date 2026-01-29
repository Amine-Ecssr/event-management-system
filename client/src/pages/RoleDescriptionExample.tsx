import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RoleDescription } from '@/components/RoleDescription';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Example component showing how to use RoleDescription
 * This is a demo/test component - you can delete it after testing
 */
export default function RoleDescriptionExample() {
  const [selectedRole, setSelectedRole] = useState<string>('employee');

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      <h1 className="text-3xl font-bold">RoleDescription Component Examples</h1>
      
      {/* Example 1: In a form */}
      <Card>
        <CardHeader>
          <CardTitle>Example 1: Interactive Role Selector</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Select a Role:</label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="events_lead">Events Lead</SelectItem>
                <SelectItem value="division_head">Division Head</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="superadmin">Superadmin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {selectedRole && (
            <RoleDescription role={selectedRole} />
          )}
        </CardContent>
      </Card>

      {/* Example 2: All roles at once */}
      <Card>
        <CardHeader>
          <CardTitle>Example 2: All Role Descriptions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <Badge className="mb-2">Viewer</Badge>
              <RoleDescription role="viewer" />
            </div>
            
            <div>
              <Badge className="mb-2 bg-blue-100 text-blue-700">Employee</Badge>
              <RoleDescription role="employee" />
            </div>
            
            <div>
              <Badge className="mb-2 bg-green-100 text-green-700">Events Lead</Badge>
              <RoleDescription role="events_lead" />
            </div>
            
            <div>
              <Badge className="mb-2 bg-purple-100 text-purple-700">Division Head</Badge>
              <RoleDescription role="division_head" />
            </div>
            
            <div>
              <Badge className="mb-2 bg-red-100 text-red-700">Admin</Badge>
              <RoleDescription role="admin" />
            </div>
            
            <div>
              <Badge className="mb-2 bg-amber-100 text-amber-700">Superadmin</Badge>
              <RoleDescription role="superadmin" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Example 3: Custom styling */}
      <Card>
        <CardHeader>
          <CardTitle>Example 3: Custom Styled Descriptions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Warning Style (for restricted roles):</p>
            <RoleDescription 
              role="viewer" 
              className="border-yellow-500 bg-yellow-50" 
            />
          </div>
          
          <div>
            <p className="text-sm font-medium mb-2">Success Style (for elevated roles):</p>
            <RoleDescription 
              role="admin" 
              className="border-green-500 bg-green-50" 
            />
          </div>
          
          <div>
            <p className="text-sm font-medium mb-2">Info Style (default):</p>
            <RoleDescription 
              role="events_lead" 
            />
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-sm text-muted-foreground">
        <p>This is a demo component. You can delete /pages/RoleDescriptionExample.tsx after testing.</p>
        <p className="mt-2">The RoleDescription component is located at: <code>/components/RoleDescription.tsx</code></p>
      </div>
    </div>
  );
}
