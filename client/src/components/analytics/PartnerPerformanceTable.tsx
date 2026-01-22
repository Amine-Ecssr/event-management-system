/**
 * Partner Performance Table Component
 * 
 * Table showing partner organization rankings by agreements.
 * 
 * @module components/analytics/PartnerPerformanceTable
 */

import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Building2, Calendar } from 'lucide-react';
import type { PartnerPerformanceData } from '@/types/analytics';

interface PartnerPerformanceTableProps {
  data: PartnerPerformanceData[];
}

export function PartnerPerformanceTable({ data }: PartnerPerformanceTableProps) {
  const { t } = useTranslation();

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        {t('partnershipsAnalytics.noPartners', 'No partner data available')}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('partnershipsAnalytics.rank', 'Rank')}</TableHead>
            <TableHead>{t('partnershipsAnalytics.organization', 'Organization')}</TableHead>
            <TableHead className="text-center">
              {t('partnershipsAnalytics.totalAgreements', 'Total')}
            </TableHead>
            <TableHead className="text-center">
              {t('partnershipsAnalytics.activeAgreementsLabel', 'Active')}
            </TableHead>
            <TableHead className="hidden md:table-cell">
              {t('partnershipsAnalytics.partnerSince', 'Partner Since')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((partner, index) => {
            const partnerSince = partner.partnerSince
              ? new Date(partner.partnerSince).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                })
              : '—';

            return (
              <TableRow key={partner.organizationId}>
                <TableCell className="font-medium">
                  <Badge variant={index < 3 ? 'default' : 'secondary'}>
                    #{index + 1}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{partner.organizationName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{partner.totalAgreements}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge 
                    variant={partner.activeAgreements > 0 ? 'default' : 'secondary'}
                    className={partner.activeAgreements > 0 ? 'bg-green-600' : ''}
                  >
                    {partner.activeAgreements}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-1 text-muted-foreground text-sm">
                    <Calendar className="h-3.5 w-3.5" />
                    {partnerSince}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
