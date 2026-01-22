import CalendarGrid from '../CalendarGrid';
import { mockEvents } from '@/lib/mockData';

export default function CalendarGridExample() {
  const currentDate = new Date(2025, 0, 1);
  
  return (
    <div className="max-w-5xl">
      <CalendarGrid
        currentDate={currentDate}
        events={mockEvents}
        onEventClick={(event) => console.log('Event clicked:', event.name)}
      />
    </div>
  );
}
