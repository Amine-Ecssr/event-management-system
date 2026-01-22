import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, getQuarter, startOfMonth, addMonths } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { CalendarViewMode } from '@/lib/types';
import { useLanguage } from '@/contexts/LanguageContext';

interface MonthNavigationProps {
  currentDate: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  viewMode?: CalendarViewMode;
}

export default function MonthNavigation({
  currentDate,
  onPreviousMonth,
  onNextMonth,
  viewMode = 'monthly',
}: MonthNavigationProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  
  // In RTL, previous is right and next is left
  const PreviousIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;
  
  const getDisplayLabel = () => {
    const monthIndex = currentDate.getMonth();
    const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    
    switch (viewMode) {
      case 'monthly':
        return (
          <>
            <span className="font-semibold">{t(`calendar.months.${monthKeys[monthIndex]}`)}</span>{' '}
            {format(currentDate, 'yyyy')}
          </>
        );
      case 'quarterly':
        return `Q${getQuarter(currentDate)} ${format(currentDate, 'yyyy')}`;
      case 'bi-annually':
        const month = currentDate.getMonth();
        const half = month < 6 ? 'H1' : 'H2';
        return `${half} ${format(currentDate, 'yyyy')}`;
      case 'yearly':
        return format(currentDate, 'yyyy');
      default:
        return `${t(`calendar.months.${monthKeys[monthIndex]}`)} ${format(currentDate, 'yyyy')}`;
    }
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <Button
        variant="outline"
        size="icon"
        onClick={onPreviousMonth}
        data-testid="button-previous-month"
        className="hover-elevate active-elevate-2"
      >
        <PreviousIcon className="h-5 w-5" />
      </Button>
      
      <h2 className="text-2xl md:text-3xl font-bold font-heading text-secondary" data-testid="text-current-month">
        {getDisplayLabel()}
      </h2>
      
      <Button
        variant="outline"
        size="icon"
        onClick={onNextMonth}
        data-testid="button-next-month"
        className="hover-elevate active-elevate-2"
      >
        <NextIcon className="h-5 w-5" />
      </Button>
    </div>
  );
}
