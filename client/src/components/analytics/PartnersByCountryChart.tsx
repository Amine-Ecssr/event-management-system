/**
 * Partners by Country Chart
 * 
 * Displays a horizontal bar chart showing partner distribution by country
 * with activity and agreement counts.
 * 
 * @module components/analytics/PartnersByCountryChart
 */

import { useTranslation } from 'react-i18next';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import type { PartnersByCountry } from '@/types/analytics';

interface PartnersByCountryChartProps {
  data: PartnersByCountry[];
}

// Color palette for bars
const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function PartnersByCountryChart({ data }: PartnersByCountryChartProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';

  // Sort by partner count and take top 10
  const chartData = [...data]
    .sort((a, b) => b.partnerCount - a.partnerCount)
    .slice(0, 10)
    .map((item, index) => ({
      name: isRTL ? item.countryNameAr : item.countryNameEn,
      partners: item.partnerCount,
      agreements: item.activeAgreements,
      activities: item.totalActivities,
      fill: COLORS[index % COLORS.length],
    }));

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {t('common.noData', 'No data available')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 45)}>
        <BarChart 
          data={chartData} 
          layout="vertical"
          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
        >
          <XAxis type="number" />
          <YAxis 
            type="category" 
            dataKey="name" 
            width={90}
            tick={{ fontSize: 12 }}
          />
          <Tooltip 
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0].payload;
              return (
                <div className="bg-popover border rounded-lg shadow-lg p-3">
                  <p className="font-medium mb-2">{item.name}</p>
                  <div className="space-y-1 text-sm">
                    <p className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded" style={{ background: 'hsl(var(--chart-1))' }} />
                      {t('partnershipsAnalytics.partners', 'Partners')}: {item.partners}
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded" style={{ background: 'hsl(var(--chart-2))' }} />
                      {t('partnershipsAnalytics.activeAgreements', 'Active Agreements')}: {item.agreements}
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded" style={{ background: 'hsl(var(--chart-3))' }} />
                      {t('partnershipsAnalytics.activities', 'Activities')}: {item.activities}
                    </p>
                  </div>
                </div>
              );
            }}
          />
          <Legend />
          <Bar 
            dataKey="partners" 
            name={t('partnershipsAnalytics.partners', 'Partners')}
            fill="hsl(var(--chart-1))" 
            radius={[0, 4, 4, 0]}
          />
          <Bar 
            dataKey="agreements" 
            name={t('partnershipsAnalytics.agreements', 'Agreements')}
            fill="hsl(var(--chart-2))" 
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
