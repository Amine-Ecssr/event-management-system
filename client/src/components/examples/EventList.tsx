import EventList from '../EventList';
import { mockEvents } from '@/lib/mockData';

export default function EventListExample() {
  return (
    <div className="max-w-3xl">
      <EventList
        events={mockEvents.slice(0, 4)}
        onEventClick={(event) => console.log('Event clicked:', event.name)}
      />
    </div>
  );
}
