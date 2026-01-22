/**
 * Contacts Distribution Chart Component
 * 
 * Displays contacts distribution by organization, country, or position.
 * 
 * @module components/analytics/ContactsDistributionChart
 */

import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Globe, Briefcase } from 'lucide-react';
import type { ContactsByOrganization, ContactsByCountry, ContactsByPosition } from '@/types/analytics';

interface ContactsDistributionChartProps {
  byOrganization: ContactsByOrganization[];
  byCountry: ContactsByCountry[];
  byPosition: ContactsByPosition[];
}

const COLORS = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444',
  '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#6366F1',
];

export function ContactsDistributionChart({
  byOrganization,
  byCountry,
  byPosition,
}: ContactsDistributionChartProps) {
  const { t } = useTranslation();

  const renderChart = (
    data: Array<{ name: string; count: number; percentage: number }>,
    noDataMessage: string
  ) => {
    if (!data || data.length === 0) {
      return (
        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
          {noDataMessage}
        </div>
      );
    }

    const chartData = data.slice(0, 10).map((item) => ({
      name: item.name.length > 20 ? item.name.slice(0, 20) + '...' : item.name,
      fullName: item.name,
      count: item.count,
      percentage: item.percentage,
    }));

    return (
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis type="number" className="text-xs" />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fontSize: 11 }}
              className="text-xs"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
              formatter={(value: number, name: string, props: any) => [
                `${value} (${props.payload.percentage}%)`,
                t('contactsAnalytics.contacts', 'Contacts'),
              ]}
              labelFormatter={(label, payload) =>
                payload?.[0]?.payload?.fullName || label
              }
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>{t('contactsAnalytics.distribution', 'Contact Distribution')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="organization">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="organization" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">
                {t('contactsAnalytics.byOrganization', 'Organization')}
              </span>
            </TabsTrigger>
            <TabsTrigger value="country" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">
                {t('contactsAnalytics.byCountry', 'Country')}
              </span>
            </TabsTrigger>
            <TabsTrigger value="position" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">
                {t('contactsAnalytics.byPosition', 'Position')}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="organization" className="mt-4">
            {renderChart(
              byOrganization.map((o) => ({
                name: o.organizationName,
                count: o.count,
                percentage: o.percentage,
              })),
              t('contactsAnalytics.noOrgData', 'No organization data available')
            )}
          </TabsContent>

          <TabsContent value="country" className="mt-4">
            {renderChart(
              byCountry.map((c) => ({
                name: c.countryName,
                count: c.count,
                percentage: c.percentage,
              })),
              t('contactsAnalytics.noCountryData', 'No country data available')
            )}
          </TabsContent>

          <TabsContent value="position" className="mt-4">
            {renderChart(
              byPosition.map((p) => ({
                name: p.positionName,
                count: p.count,
                percentage: p.percentage,
              })),
              t('contactsAnalytics.noPositionData', 'No position data available')
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default ContactsDistributionChart;
