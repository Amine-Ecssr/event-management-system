import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, ArrowLeft, LucideIcon } from 'lucide-react';

interface DropdownCardProps {
  title: string;
  titleAr: string;
  description?: string;
  descriptionAr?: string;
  icon: LucideIcon;
  count: number;
  href: string;
  isLoading?: boolean;
}

export function DropdownCard({
  title,
  titleAr,
  description,
  descriptionAr,
  icon: Icon,
  count,
  href,
  isLoading = false,
}: DropdownCardProps) {
  const { i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const isArabic = i18n.language === 'ar';

  const displayTitle = isArabic ? titleAr : title;
  const displayDescription = isArabic
    ? descriptionAr || description
    : description;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setLocation(href);
  };

  return (
    <Card 
      className="group hover:shadow-md transition-all duration-200 hover:border-primary/50 cursor-pointer"
      onClick={handleClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-lg text-foreground truncate">
                {displayTitle}
              </h3>
              <Badge variant="secondary" className="shrink-0">
                {isLoading ? '...' : count}
              </Badge>
            </div>
            {displayDescription && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {displayDescription}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="group-hover:bg-primary/10 transition-colors"
          >
            {isArabic ? 'إدارة' : 'Manage'}
            {isArabic ? (
              <ArrowLeft className="ms-2 h-4 w-4" />
            ) : (
              <ArrowRight className="ms-2 h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
