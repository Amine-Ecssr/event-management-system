import EventCard from '../EventCard';
import { mockEvents } from '@/lib/mockData';

export default function EventCardExample() {
  return (
    <div className="max-w-2xl">
      <EventCard
        event={mockEvents[0]}
        onClick={() => console.log('Event card clicked')}
      />
    </div>
  );
}
