import MonthNavigation from '../MonthNavigation';

export default function MonthNavigationExample() {
  const currentDate = new Date(2025, 9, 1);
  
  return (
    <MonthNavigation
      currentDate={currentDate}
      onPreviousMonth={() => console.log('Previous month clicked')}
      onNextMonth={() => console.log('Next month clicked')}
    />
  );
}
