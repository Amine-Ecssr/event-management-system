import { Calendar, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ViewMode } from '@/lib/types';

interface ViewToggleProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export default function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex gap-2">
      <Button
        variant={view === 'calendar' ? 'default' : 'outline'}
        onClick={() => onViewChange('calendar')}
        data-testid="button-calendar-view"
        className="gap-2"
      >
        <Calendar className="h-4 w-4" />
        <span className="hidden sm:inline">Calendar</span>
      </Button>
      <Button
        variant={view === 'list' ? 'default' : 'outline'}
        onClick={() => onViewChange('list')}
        data-testid="button-list-view"
        className="gap-2"
      >
        <List className="h-4 w-4" />
        <span className="hidden sm:inline">List</span>
      </Button>
    </div>
  );
}
