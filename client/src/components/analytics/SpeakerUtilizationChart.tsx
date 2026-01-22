/**
 * Speaker Utilization Chart Component
 * 
 * Displays speaker engagement and utilization metrics.
 * 
 * @module components/analytics/SpeakerUtilizationChart
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { User, Award, Calendar } from 'lucide-react';
import type { SpeakerMetrics } from '@/types/analytics';

interface SpeakerUtilizationChartProps {
  data: SpeakerMetrics;
}

export function SpeakerUtilizationChart({ data }: SpeakerUtilizationChartProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          {t('contactsAnalytics.speakerMetrics', 'Speaker Metrics')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Utilization Rate */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {t('contactsAnalytics.utilizationRate', 'Utilization Rate')}
            </span>
            <span className="font-medium">{data.speakerUtilizationRate}%</span>
          </div>
          <Progress value={data.speakerUtilizationRate} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {t('contactsAnalytics.utilizationDescription', 'Percentage of eligible speakers who participated in events')}
          </p>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{data.totalSpeakers}</p>
            <p className="text-xs text-muted-foreground">
              {t('contactsAnalytics.eligibleSpeakers', 'Eligible Speakers')}
            </p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold">{data.averageEventsPerSpeaker}</p>
            <p className="text-xs text-muted-foreground">
              {t('contactsAnalytics.avgEventsPerSpeaker', 'Avg Events/Speaker')}
            </p>
          </div>
        </div>

        {/* Most Active Speakers */}
        {data.mostActiveSpeakers.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              {t('contactsAnalytics.topSpeakers', 'Top Speakers')}
            </h4>
            <div className="space-y-2">
              {data.mostActiveSpeakers.slice(0, 5).map((speaker, index) => (
                <div
                  key={speaker.contactId}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground w-6">
                      #{index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{speaker.name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {speaker.roles.slice(0, 2).map((role) => (
                          <Badge key={role} variant="outline" className="text-xs">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{speaker.eventCount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.mostActiveSpeakers.length === 0 && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            {t('contactsAnalytics.noSpeakerActivity', 'No speaker activity this year')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SpeakerUtilizationChart;
