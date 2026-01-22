import EventForm from '../EventForm';

export default function EventFormExample() {
  return (
    <div className="max-w-3xl p-6 bg-card rounded-lg border">
      <h3 className="text-xl font-bold mb-6">Add New Event</h3>
      <EventForm
        onSubmit={(data) => console.log('Form submitted:', Array.from(data.entries()))}
        onCancel={() => console.log('Form cancelled')}
      />
    </div>
  );
}
