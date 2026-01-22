import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Mail,
  Phone,
  Users,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  User,
  Clock,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export interface LeadInteraction {
  id: number;
  leadId: number;
  type: 'email' | 'phone_call' | 'meeting' | 'other';
  description: string;
  descriptionAr?: string | null;
  outcome: string | null;
  outcomeAr?: string | null;
  interactionDate?: string;
  createdAt: string;
  createdByUserId?: number | null;
  createdByUsername?: string | null;
}

interface InteractionCardProps {
  interaction: LeadInteraction;
  onEdit?: (interaction: LeadInteraction) => void;
  onDelete?: (interaction: LeadInteraction) => void;
  isLast?: boolean;
}

const INTERACTION_TYPE_COLORS = {
  email: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  phone_call: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  meeting: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

const INTERACTION_ICON_BG = {
  email: 'bg-blue-500',
  phone_call: 'bg-green-500',
  meeting: 'bg-purple-500',
  other: 'bg-gray-500',
};

export function InteractionCard({
  interaction,
  onEdit,
  onDelete,
  isLast = false,
}: InteractionCardProps) {
  const { t, i18n } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const isRTL = i18n.language === 'ar';
  const dateLocale = isRTL ? ar : enUS;

  const getInteractionIcon = (type: string) => {
    const iconProps = { className: 'h-4 w-4 text-white' };
    switch (type) {
      case 'email':
        return <Mail {...iconProps} />;
      case 'phone_call':
        return <Phone {...iconProps} />;
      case 'meeting':
        return <Users {...iconProps} />;
      default:
        return <MessageSquare {...iconProps} />;
    }
  };

  const interactionDate = interaction.interactionDate || interaction.createdAt;
  const parsedDate = parseISO(interactionDate);
  const relativeTime = formatDistanceToNow(parsedDate, {
    addSuffix: true,
    locale: dateLocale,
  });
  const absoluteDate = format(parsedDate, 'PPP', { locale: dateLocale });
  const absoluteTime = format(parsedDate, 'p', { locale: dateLocale });

  // Get localized description and outcome
  const description =
    isRTL && interaction.descriptionAr
      ? interaction.descriptionAr
      : interaction.description;
  const outcome =
    isRTL && interaction.outcomeAr
      ? interaction.outcomeAr
      : interaction.outcome;

  const shouldTruncateDescription = description.length > 200;
  const shouldTruncateOutcome = outcome && outcome.length > 150;
  const hasLongContent = shouldTruncateDescription || shouldTruncateOutcome;

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Header: Type badge, time, author */}
          <div className="flex items-center flex-wrap gap-2 mb-2">
            <Badge
              variant="secondary"
              className={cn(
                'font-medium',
                INTERACTION_TYPE_COLORS[interaction.type]
              )}
            >
              {getInteractionIcon(interaction.type)}
              <span className="ml-1.5">
                {t(`leads.interactions.types.${interaction.type}`)}
              </span>
            </Badge>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span title={`${absoluteDate} ${absoluteTime}`}>
                {relativeTime}
              </span>
              <span className="text-muted-foreground/50">•</span>
              <span>{absoluteDate}</span>
            </div>

            {interaction.createdByUsername && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span>{interaction.createdByUsername}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {hasLongContent ? (
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <div className="text-sm whitespace-pre-wrap leading-relaxed">
                {isExpanded
                  ? description
                  : shouldTruncateDescription
                    ? `${description.slice(0, 200)}...`
                    : description}
              </div>

              {/* Outcome (when collapsed, show truncated) */}
              {outcome && !isExpanded && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground mb-1">
                    <span>{t('leads.interactions.outcome')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {shouldTruncateOutcome
                      ? `${outcome.slice(0, 150)}...`
                      : outcome}
                  </p>
                </div>
              )}

              <CollapsibleContent>
                {/* Full outcome when expanded */}
                {outcome && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground mb-1">
                      <span>{t('leads.interactions.outcome')}</span>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {outcome}
                    </p>
                  </div>
                )}
              </CollapsibleContent>

              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 px-2 text-xs text-primary hover:text-primary/80"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      {t('common.showLess')}
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      {t('common.showMore')}
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          ) : (
            <>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {description}
              </p>
              {outcome && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground mb-1">
                    <span>{t('leads.interactions.outcome')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {outcome}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-1 shrink-0">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(interaction)}
              title={t('common.edit')}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(interaction)}
              title={t('common.delete')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
