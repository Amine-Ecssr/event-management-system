import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileType,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type ExportFormat = 'xlsx' | 'csv' | 'pdf';
type ExportLanguage = 'en' | 'ar' | 'both';
type ExportEntityType =
  | 'events'
  | 'events/archived'
  | 'tasks'
  | 'tasks/overdue'
  | 'contacts'
  | 'speakers'
  | 'organizations'
  | 'partnerships'
  | 'leads';

interface ExportButtonProps {
  /** Entity type to export */
  entityType: ExportEntityType;
  /** Optional query parameters/filters to include */
  filters?: Record<string, string | number | boolean>;
  /** Button variant */
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Show text label or icon only */
  iconOnly?: boolean;
  /** Custom class name */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

const FORMAT_ICONS: Record<ExportFormat, React.ReactNode> = {
  xlsx: <FileSpreadsheet className="h-4 w-4" />,
  csv: <FileText className="h-4 w-4" />,
  pdf: <FileType className="h-4 w-4" />,
};

const FORMAT_LABELS: Record<ExportFormat, string> = {
  xlsx: 'Excel (.xlsx)',
  csv: 'CSV (.csv)',
  pdf: 'PDF (.pdf)',
};

export function ExportButton({
  entityType,
  filters = {},
  variant = 'outline',
  size = 'default',
  iconOnly = false,
  className = '',
  disabled = false,
}: ExportButtonProps) {
  const { t, i18n } = useTranslation(['export', 'common']);
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat, language: ExportLanguage) => {
    setIsExporting(true);
    setExportingFormat(format);

    try {
      // Build query parameters
      const params = new URLSearchParams({
        format,
        language,
        ...Object.fromEntries(
          Object.entries(filters).map(([key, value]) => [key, String(value)])
        ),
      });

      const response = await fetch(`/api/export/${entityType}?${params}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Export failed: ${response.statusText}`);
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `${entityType}_export.${format}`;

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: t('export:success.title'),
        description: t('export:success.description', { filename }),
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: t('export:error.title'),
        description:
          error instanceof Error ? error.message : t('export:error.description'),
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  };

  const currentLanguage = i18n.language as ExportLanguage;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={disabled || isExporting}
          className={className}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {!iconOnly && (
            <span className="ml-2">
              {isExporting ? t('export:exporting') : t('common:export')}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t('export:selectFormat')}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {(['xlsx', 'csv', 'pdf'] as ExportFormat[]).map((format) => (
          <DropdownMenuSub key={format}>
            <DropdownMenuSubTrigger
              disabled={isExporting && exportingFormat === format}
            >
              <span className="flex items-center gap-2">
                {exportingFormat === format ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  FORMAT_ICONS[format]
                )}
                {FORMAT_LABELS[format]}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {t('export:selectLanguage')}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport(format, 'en')}>
                <span className="flex items-center justify-between w-full">
                  English
                  {currentLanguage === 'en' && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport(format, 'ar')}>
                <span className="flex items-center justify-between w-full">
                  العربية
                  {currentLanguage === 'ar' && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport(format, 'both')}>
                <span className="flex items-center gap-2">
                  {t('export:bilingual')}
                </span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}

        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          {t('export:hint')}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
