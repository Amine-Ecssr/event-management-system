/**
 * Partnership Pipeline Component
 * 
 * Kanban-style pipeline visualization showing agreements by status.
 * Displays draft, pending, active, expiring, and expired stages.
 * 
 * @module components/analytics/PartnershipPipeline
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Building2, Calendar, FileText, Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { PipelineData, PipelineAgreement } from '@/types/analytics';

interface PartnershipPipelineProps {
  pipeline: PipelineData;
}

const stageConfig = {
  draft: {
    label: 'Draft',
    labelKey: 'partnershipsAnalytics.stages.draft',
    color: 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700',
    iconColor: 'text-gray-600 dark:text-gray-400',
    badgeVariant: 'secondary' as const,
    icon: FileText,
  },
  pending: {
    label: 'Pending',
    labelKey: 'partnershipsAnalytics.stages.pending',
    color: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    badgeVariant: 'outline' as const,
    icon: Clock,
  },
  active: {
    label: 'Active',
    labelKey: 'partnershipsAnalytics.stages.active',
    color: 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800',
    iconColor: 'text-green-600 dark:text-green-400',
    badgeVariant: 'default' as const,
    icon: CheckCircle2,
  },
  expiring: {
    label: 'Expiring Soon',
    labelKey: 'partnershipsAnalytics.stages.expiring',
    color: 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800',
    iconColor: 'text-orange-600 dark:text-orange-400',
    badgeVariant: 'outline' as const,
    icon: AlertTriangle,
  },
  expired: {
    label: 'Expired',
    labelKey: 'partnershipsAnalytics.stages.expired',
    color: 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800',
    iconColor: 'text-red-600 dark:text-red-400',
    badgeVariant: 'destructive' as const,
    icon: XCircle,
  },
};

function AgreementCard({ agreement }: { agreement: PipelineAgreement }) {
  const formattedExpiryDate = agreement.expiryDate
    ? new Date(agreement.expiryDate).toLocaleDateString()
    : '—';

  return (
    <div className="p-3 bg-background rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start gap-2">
        <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate" title={agreement.organizationName}>
            {agreement.organizationName}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {agreement.agreementType}
          </p>
          {agreement.expiryDate && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{formattedExpiryDate}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PartnershipPipeline({ pipeline }: PartnershipPipelineProps) {
  const { t } = useTranslation();
  const stages = ['draft', 'pending', 'active', 'expiring', 'expired'] as const;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {stages.map((stage) => {
        const config = stageConfig[stage];
        const stageData = pipeline[stage];
        const Icon = config.icon;

        return (
          <Card key={stage} className={cn('border-2 flex flex-col', config.color)}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Icon className={cn("h-4 w-4 flex-shrink-0", config.iconColor)} />
                  <CardTitle className="text-sm font-medium truncate">
                    {t(config.labelKey, config.label)}
                  </CardTitle>
                </div>
                <Badge variant={config.badgeVariant} className="flex-shrink-0">
                  {stageData.count}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-2 flex-1 flex flex-col">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2 pr-2">{stageData.agreements.map((agreement) => (
                    <AgreementCard key={agreement.id} agreement={agreement} />
                  ))}

                  {stageData.agreements.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      {t('partnershipsAnalytics.noAgreements', 'No agreements')}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
