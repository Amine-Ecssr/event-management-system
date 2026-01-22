import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';

export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { language, toggleLanguage } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleLanguage}
      data-testid="button-language-toggle"
      title={t('common.language')}
    >
      <Languages className="h-5 w-5" />
      <span className="sr-only">{language === 'en' ? 'AR' : 'EN'}</span>
    </Button>
  );
}
