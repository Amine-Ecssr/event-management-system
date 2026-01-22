import { CalendarViewMode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar, ChevronDown } from 'lucide-react';

interface ViewModeSelectorProps {
  currentMode: CalendarViewMode;
  onModeChange: (mode: CalendarViewMode) => void;
}

export default function ViewModeSelector({ currentMode, onModeChange }: ViewModeSelectorProps) {
  const { t } = useTranslation();
  
  const viewModeLabels: Record<CalendarViewMode, string> = {
    monthly: t('calendar.viewModes.monthly'),
    quarterly: t('calendar.viewModes.quarterly'),
    'bi-annually': t('calendar.viewModes.biAnnually'),
    yearly: t('calendar.viewModes.yearly'),
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="gap-2"
          data-testid="button-view-mode"
        >
          <Calendar className="h-4 w-4" />
          <span>{viewModeLabels[currentMode]}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-testid="dropdown-view-mode">
        <DropdownMenuItem
          onClick={() => onModeChange('monthly')}
          data-testid="menu-item-monthly"
        >
          {t('calendar.viewModes.monthly')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onModeChange('quarterly')}
          data-testid="menu-item-quarterly"
        >
          {t('calendar.viewModes.quarterly')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onModeChange('bi-annually')}
          data-testid="menu-item-bi-annually"
        >
          {t('calendar.viewModes.biAnnually')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onModeChange('yearly')}
          data-testid="menu-item-yearly"
        >
          {t('calendar.viewModes.yearly')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
