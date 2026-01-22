import { Tag, Building, Briefcase, Handshake, FileText } from 'lucide-react';
import type { DropdownConfig } from './GenericDropdownManagement';

// Categories configuration
export const categoriesConfig: DropdownConfig = {
  key: 'categories',
  titleEn: 'Event Categories',
  titleAr: 'فئات الأحداث',
  subtitleEn: 'Manage event categories for organizing and filtering events',
  subtitleAr: 'إدارة فئات الأحداث لتنظيم وتصفية الفعاليات',
  icon: Tag,
  apiEndpoint: '/api/categories',
  queryKey: ['categories'],
  tableColumns: [
    { key: 'nameEn', headerEn: 'English Name', headerAr: 'الاسم بالإنجليزية' },
    { key: 'nameAr', headerEn: 'Arabic Name', headerAr: 'الاسم بالعربية' },
  ],
  messages: {
    createSuccessEn: 'Category created successfully',
    createSuccessAr: 'تم إنشاء الفئة بنجاح',
    updateSuccessEn: 'Category updated successfully',
    updateSuccessAr: 'تم تحديث الفئة بنجاح',
    deleteSuccessEn: 'Category deleted successfully',
    deleteSuccessAr: 'تم حذف الفئة بنجاح',
    deleteConfirmEn: 'Are you sure you want to delete this category? This may affect related events.',
    deleteConfirmAr: 'هل أنت متأكد من حذف هذه الفئة؟ قد يؤثر ذلك على الأحداث المرتبطة.',
    noItemsEn: 'No categories yet',
    noItemsAr: 'لا توجد فئات',
    addButtonEn: 'Add Category',
    addButtonAr: 'إضافة فئة',
    dialogTitleAddEn: 'Add New Category',
    dialogTitleAddAr: 'إضافة فئة جديدة',
    dialogTitleEditEn: 'Edit Category',
    dialogTitleEditAr: 'تعديل الفئة',
  },
};

// Organizations configuration
export const organizationsConfig: DropdownConfig = {
  key: 'organizations',
  titleEn: 'Organizations',
  titleAr: 'المنظمات',
  subtitleEn: 'Manage organizations for contacts, speakers, and partnerships',
  subtitleAr: 'إدارة المنظمات لجهات الاتصال والمتحدثين والشراكات',
  icon: Building,
  apiEndpoint: '/api/organizations',
  queryKey: ['organizations'],
  tableColumns: [
    { key: 'nameEn', headerEn: 'English Name', headerAr: 'الاسم بالإنجليزية' },
    { key: 'nameAr', headerEn: 'Arabic Name', headerAr: 'الاسم بالعربية' },
    {
      key: 'country',
      headerEn: 'Country',
      headerAr: 'الدولة',
      render: (item, isArabic) => {
        if (!item.country) return '-';
        return isArabic && item.country.nameAr ? item.country.nameAr : item.country.nameEn;
      },
    },
    {
      key: 'website',
      headerEn: 'Website',
      headerAr: 'الموقع',
      render: (item) => {
        if (!item.website) return '-';
        return (
          <a
            href={item.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline truncate max-w-[200px] block"
          >
            {item.website.replace(/^https?:\/\//, '')}
          </a>
        );
      },
    },
  ],
  additionalFields: [
    {
      key: 'countryId',
      labelEn: 'Country',
      labelAr: 'الدولة',
      type: 'select',
      optionsEndpoint: '/api/countries',
      optionsQueryKey: ['countries'],
      optionValueKey: 'id',
      optionLabelEnKey: 'nameEn',
      optionLabelArKey: 'nameAr',
      placeholder: 'Select country (optional)',
      placeholderAr: 'اختر الدولة (اختياري)',
    },
    {
      key: 'website',
      labelEn: 'Website',
      labelAr: 'الموقع الإلكتروني',
      type: 'url',
      placeholder: 'https://example.com',
      placeholderAr: 'https://example.com',
      helperText: 'Enter the full URL (e.g., https://www.example.com)',
      helperTextAr: 'أدخل الرابط الكامل (مثال: https://www.example.com)',
    },
  ],
  messages: {
    createSuccessEn: 'Organization created successfully',
    createSuccessAr: 'تم إنشاء المنظمة بنجاح',
    updateSuccessEn: 'Organization updated successfully',
    updateSuccessAr: 'تم تحديث المنظمة بنجاح',
    deleteSuccessEn: 'Organization deleted successfully',
    deleteSuccessAr: 'تم حذف المنظمة بنجاح',
    deleteConfirmEn: 'Are you sure you want to delete this organization? This may affect related contacts and partnerships.',
    deleteConfirmAr: 'هل أنت متأكد من حذف هذه المنظمة؟ قد يؤثر ذلك على جهات الاتصال والشراكات المرتبطة.',
    noItemsEn: 'No organizations yet',
    noItemsAr: 'لا توجد منظمات',
    addButtonEn: 'Add Organization',
    addButtonAr: 'إضافة منظمة',
    dialogTitleAddEn: 'Add New Organization',
    dialogTitleAddAr: 'إضافة منظمة جديدة',
    dialogTitleEditEn: 'Edit Organization',
    dialogTitleEditAr: 'تعديل المنظمة',
  },
};

// Positions configuration
export const positionsConfig: DropdownConfig = {
  key: 'positions',
  titleEn: 'Positions',
  titleAr: 'المناصب',
  subtitleEn: 'Manage job positions/titles for contacts and speakers',
  subtitleAr: 'إدارة المناصب الوظيفية لجهات الاتصال والمتحدثين',
  icon: Briefcase,
  apiEndpoint: '/api/positions',
  queryKey: ['positions'],
  tableColumns: [
    { key: 'nameEn', headerEn: 'English Name', headerAr: 'الاسم بالإنجليزية' },
    { key: 'nameAr', headerEn: 'Arabic Name', headerAr: 'الاسم بالعربية' },
  ],
  messages: {
    createSuccessEn: 'Position created successfully',
    createSuccessAr: 'تم إنشاء المنصب بنجاح',
    updateSuccessEn: 'Position updated successfully',
    updateSuccessAr: 'تم تحديث المنصب بنجاح',
    deleteSuccessEn: 'Position deleted successfully',
    deleteSuccessAr: 'تم حذف المنصب بنجاح',
    deleteConfirmEn: 'Are you sure you want to delete this position? This may affect related contacts.',
    deleteConfirmAr: 'هل أنت متأكد من حذف هذا المنصب؟ قد يؤثر ذلك على جهات الاتصال المرتبطة.',
    noItemsEn: 'No positions yet',
    noItemsAr: 'لا توجد مناصب',
    addButtonEn: 'Add Position',
    addButtonAr: 'إضافة منصب',
    dialogTitleAddEn: 'Add New Position',
    dialogTitleAddAr: 'إضافة منصب جديد',
    dialogTitleEditEn: 'Edit Position',
    dialogTitleEditAr: 'تعديل المنصب',
  },
};

// Partnership Types configuration
export const partnershipTypesConfig: DropdownConfig = {
  key: 'partnership-types',
  titleEn: 'Partnership Types',
  titleAr: 'أنواع الشراكات',
  subtitleEn: 'Manage partnership classification types',
  subtitleAr: 'إدارة أنواع تصنيف الشراكات',
  icon: Handshake,
  apiEndpoint: '/api/partnership-types',
  queryKey: ['partnership-types'],
  tableColumns: [
    { key: 'nameEn', headerEn: 'English Name', headerAr: 'الاسم بالإنجليزية' },
    { key: 'nameAr', headerEn: 'Arabic Name', headerAr: 'الاسم بالعربية' },
  ],
  messages: {
    createSuccessEn: 'Partnership type created successfully',
    createSuccessAr: 'تم إنشاء نوع الشراكة بنجاح',
    updateSuccessEn: 'Partnership type updated successfully',
    updateSuccessAr: 'تم تحديث نوع الشراكة بنجاح',
    deleteSuccessEn: 'Partnership type deleted successfully',
    deleteSuccessAr: 'تم حذف نوع الشراكة بنجاح',
    deleteConfirmEn: 'Are you sure you want to delete this partnership type? This may affect related partnerships.',
    deleteConfirmAr: 'هل أنت متأكد من حذف نوع الشراكة هذا؟ قد يؤثر ذلك على الشراكات المرتبطة.',
    noItemsEn: 'No partnership types yet',
    noItemsAr: 'لا توجد أنواع شراكات',
    addButtonEn: 'Add Type',
    addButtonAr: 'إضافة نوع',
    dialogTitleAddEn: 'Add New Partnership Type',
    dialogTitleAddAr: 'إضافة نوع شراكة جديد',
    dialogTitleEditEn: 'Edit Partnership Type',
    dialogTitleEditAr: 'تعديل نوع الشراكة',
  },
};

// Agreement Types configuration
export const agreementTypesConfig: DropdownConfig = {
  key: 'agreement-types',
  titleEn: 'Agreement Types',
  titleAr: 'أنواع الاتفاقيات',
  subtitleEn: 'Manage agreement/contract types for partnerships',
  subtitleAr: 'إدارة أنواع الاتفاقيات والعقود للشراكات',
  icon: FileText,
  apiEndpoint: '/api/agreement-types',
  queryKey: ['agreement-types'],
  tableColumns: [
    { key: 'nameEn', headerEn: 'English Name', headerAr: 'الاسم بالإنجليزية' },
    { key: 'nameAr', headerEn: 'Arabic Name', headerAr: 'الاسم بالعربية' },
  ],
  messages: {
    createSuccessEn: 'Agreement type created successfully',
    createSuccessAr: 'تم إنشاء نوع الاتفاقية بنجاح',
    updateSuccessEn: 'Agreement type updated successfully',
    updateSuccessAr: 'تم تحديث نوع الاتفاقية بنجاح',
    deleteSuccessEn: 'Agreement type deleted successfully',
    deleteSuccessAr: 'تم حذف نوع الاتفاقية بنجاح',
    deleteConfirmEn: 'Are you sure you want to delete this agreement type? This may affect related agreements.',
    deleteConfirmAr: 'هل أنت متأكد من حذف نوع الاتفاقية هذا؟ قد يؤثر ذلك على الاتفاقيات المرتبطة.',
    noItemsEn: 'No agreement types yet',
    noItemsAr: 'لا توجد أنواع اتفاقيات',
    addButtonEn: 'Add Type',
    addButtonAr: 'إضافة نوع',
    dialogTitleAddEn: 'Add New Agreement Type',
    dialogTitleAddAr: 'إضافة نوع اتفاقية جديد',
    dialogTitleEditEn: 'Edit Agreement Type',
    dialogTitleEditAr: 'تعديل نوع الاتفاقية',
  },
};

// Export all configs as a map for easy lookup
export const dropdownConfigs: Record<string, DropdownConfig> = {
  categories: categoriesConfig,
  organizations: organizationsConfig,
  positions: positionsConfig,
  'partnership-types': partnershipTypesConfig,
  'agreement-types': agreementTypesConfig,
};

// Export list for the hub page
export const dropdownConfigList = [
  categoriesConfig,
  organizationsConfig,
  positionsConfig,
  partnershipTypesConfig,
  agreementTypesConfig,
];
