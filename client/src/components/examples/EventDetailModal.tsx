import { useState } from 'react';
import EventDetailModal from '../EventDetailModal';
import { Button } from '@/components/ui/button';
import { mockEvents } from '@/lib/mockData';

export default function EventDetailModalExample() {
  const [open, setOpen] = useState(false);
  
  return (
    <div>
      <Button onClick={() => setOpen(true)}>Open Event Detail</Button>
      <EventDetailModal
        event={mockEvents[0]}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
