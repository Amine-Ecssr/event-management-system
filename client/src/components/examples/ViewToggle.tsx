import { useState } from 'react';
import ViewToggle from '../ViewToggle';
import { ViewMode } from '@/lib/types';

export default function ViewToggleExample() {
  const [view, setView] = useState<ViewMode>('calendar');
  
  return (
    <div className="space-y-4">
      <ViewToggle view={view} onViewChange={setView} />
      <p className="text-sm text-muted-foreground">Current view: {view}</p>
    </div>
  );
}
