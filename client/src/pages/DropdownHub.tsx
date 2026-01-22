import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Redirect } from 'wouter';
import { PageHeader } from '@/components/PageHeader';
import { DropdownCard } from '@/components/settings/DropdownCard';
import { dropdownConfigList } from '@/components/settings/dropdownConfigs';
import { useAuth } from '@/hooks/use-auth';
import { Category, Organization, Position, PartnershipType, AgreementType } from '@/lib/types';

export default function DropdownHub() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isArabic = i18n.language === 'ar';

  // Access control
  const isAdminOrSuperAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  
  if (!isAdminOrSuperAdmin) {
    return <Redirect to="/" />;
  }

  // Fetch counts for all dropdown types
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await fetch('/api/categories', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
  });

  const { data: organizations = [], isLoading: organizationsLoading } = useQuery<Organization[]>({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await fetch('/api/organizations', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
  });

  const { data: positions = [], isLoading: positionsLoading } = useQuery<Position[]>({
    queryKey: ['positions'],
    queryFn: async () => {
      const response = await fetch('/api/positions', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
  });

  const { data: partnershipTypes = [], isLoading: partnershipTypesLoading } = useQuery<PartnershipType[]>({
    queryKey: ['partnership-types'],
    queryFn: async () => {
      const response = await fetch('/api/partnership-types', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
  });

  const { data: agreementTypes = [], isLoading: agreementTypesLoading } = useQuery<AgreementType[]>({
    queryKey: ['agreement-types'],
    queryFn: async () => {
      const response = await fetch('/api/agreement-types', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
  });

  // Build counts map
  const countsMap: Record<string, { count: number; isLoading: boolean }> = {
    categories: { count: categories.length, isLoading: categoriesLoading },
    organizations: { count: organizations.length, isLoading: organizationsLoading },
    positions: { count: positions.length, isLoading: positionsLoading },
    'partnership-types': { count: partnershipTypes.length, isLoading: partnershipTypesLoading },
    'agreement-types': { count: agreementTypes.length, isLoading: agreementTypesLoading },
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title={isArabic ? 'إدارة القوائم المنسدلة' : 'Dropdown Management'}
        subtitle={isArabic 
          ? 'إدارة الفئات والمنظمات والمناصب وأنواع الشراكات والاتفاقيات'
          : 'Manage categories, organizations, positions, partnership types, and agreement types'}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dropdownConfigList.map((config) => (
          <DropdownCard
            key={config.key}
            title={config.titleEn}
            titleAr={config.titleAr}
            description={config.subtitleEn}
            descriptionAr={config.subtitleAr}
            icon={config.icon}
            count={countsMap[config.key]?.count || 0}
            isLoading={countsMap[config.key]?.isLoading}
            href={`/admin/dropdowns/${config.key}`}
          />
        ))}
      </div>
    </div>
  );
}
