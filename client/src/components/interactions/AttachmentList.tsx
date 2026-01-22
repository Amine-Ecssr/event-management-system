import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Image,
  FileSpreadsheet,
  Presentation,
  Archive,
  File,
  Download,
  Trash2,
  Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type InteractionAttachment,
  formatFileSize,
  getFileIconType,
} from './types';

interface AttachmentListProps {
  attachments: InteractionAttachment[];
  onDelete?: (attachmentId: number) => void;
  isDeleting?: number | null;
  showDelete?: boolean;
  compact?: boolean;
  className?: string;
}

export function AttachmentList({
  attachments,
  onDelete,
  isDeleting,
  showDelete = true,
  compact = false,
  className,
}: AttachmentListProps) {
  const { t } = useTranslation();

  const getFileIcon = (mimeType: string) => {
    const iconType = getFileIconType(mimeType);
    const iconClass = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';
    switch (iconType) {
      case 'image':
        return <Image className={cn(iconClass, 'text-green-500')} />;
      case 'document':
        return <FileText className={cn(iconClass, 'text-blue-500')} />;
      case 'spreadsheet':
        return <FileSpreadsheet className={cn(iconClass, 'text-emerald-500')} />;
      case 'presentation':
        return <Presentation className={cn(iconClass, 'text-orange-500')} />;
      case 'archive':
        return <Archive className={cn(iconClass, 'text-purple-500')} />;
      default:
        return <File className={cn(iconClass, 'text-gray-500')} />;
    }
  };

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Paperclip className="h-3 w-3" />
        <span>
          {t('interactions.attachments.title')} ({attachments.length})
        </span>
      </div>
      <div className={cn('space-y-1', compact && 'space-y-0.5')}>
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className={cn(
              'flex items-center gap-2 group',
              compact ? 'py-0.5' : 'p-1.5 rounded border bg-muted/30'
            )}
          >
            {getFileIcon(attachment.mimeType)}
            <a
              href={attachment.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex-1 min-w-0 hover:underline text-primary',
                compact ? 'text-xs' : 'text-sm'
              )}
              title={attachment.originalFileName}
            >
              <span className="truncate block">{attachment.originalFileName}</span>
            </a>
            <span className={cn(
              'text-muted-foreground shrink-0',
              compact ? 'text-[10px]' : 'text-xs'
            )}>
              ({formatFileSize(attachment.fileSize)})
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <a
                href={attachment.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(compact ? 'h-5 w-5' : 'h-6 w-6')}
                  title={t('common.download')}
                >
                  <Download className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                </Button>
              </a>
              {showDelete && onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity',
                    compact ? 'h-5 w-5' : 'h-6 w-6'
                  )}
                  onClick={() => onDelete(attachment.id)}
                  disabled={isDeleting === attachment.id}
                  title={t('common.delete')}
                >
                  <Trash2 className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
