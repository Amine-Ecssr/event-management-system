/**
 * Data Quality Score Card Component
 * 
 * Displays contact data completeness metrics.
 * 
 * @module components/analytics/DataQualityCard
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Mail, Phone, Building2, User } from 'lucide-react';
import type { ContactsSummary } from '@/types/analytics';

interface DataQualityCardProps {
  data: ContactsSummary;
}

export function DataQualityCard({ data }: DataQualityCardProps) {
  const { t } = useTranslation();

  const qualityMetrics = [
    {
      label: t('contactsAnalytics.hasEmail', 'Has Email'),
      value: data.contactsWithEmail,
      total: data.totalContacts,
      icon: Mail,
      color: 'text-blue-500',
    },
    {
      label: t('contactsAnalytics.hasPhone', 'Has Phone'),
      value: data.contactsWithPhone,
      total: data.totalContacts,
      icon: Phone,
      color: 'text-green-500',
    },
    {
      label: t('contactsAnalytics.hasOrganization', 'Has Organization'),
      value: data.contactsWithOrganization,
      total: data.totalContacts,
      icon: Building2,
      color: 'text-purple-500',
    },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return t('contactsAnalytics.quality.excellent', 'Excellent');
    if (score >= 60) return t('contactsAnalytics.quality.good', 'Good');
    if (score >= 40) return t('contactsAnalytics.quality.fair', 'Fair');
    return t('contactsAnalytics.quality.needsImprovement', 'Needs Improvement');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          {t('contactsAnalytics.dataQuality', 'Data Quality')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className={`text-4xl font-bold ${getScoreColor(data.dataCompletenessScore)}`}>
            {data.dataCompletenessScore}%
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {t('contactsAnalytics.completenessScore', 'Completeness Score')}
          </div>
          <div className={`text-sm font-medium ${getScoreColor(data.dataCompletenessScore)} mt-1`}>
            {getScoreLabel(data.dataCompletenessScore)}
          </div>
        </div>

        {/* Individual Metrics */}
        <div className="space-y-4">
          {qualityMetrics.map((metric) => {
            const percentage = metric.total > 0 ? (metric.value / metric.total) * 100 : 0;
            return (
              <div key={metric.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <metric.icon className={`h-4 w-4 ${metric.color}`} />
                    <span>{metric.label}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {metric.value} / {metric.total} ({percentage.toFixed(0)}%)
                  </span>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            );
          })}
        </div>

        {/* Eligible Speakers */}
        <div className="p-3 bg-muted/30 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-amber-500" />
            <span className="text-sm">{t('contactsAnalytics.eligibleSpeakers', 'Eligible Speakers')}</span>
          </div>
          <div className="text-right">
            <div className="font-bold">{data.eligibleSpeakers}</div>
            <div className="text-xs text-muted-foreground">
              {data.totalContacts > 0
                ? `${((data.eligibleSpeakers / data.totalContacts) * 100).toFixed(1)}%`
                : '0%'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default DataQualityCard;
