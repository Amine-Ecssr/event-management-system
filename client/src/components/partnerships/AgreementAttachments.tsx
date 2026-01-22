import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import {
  Upload,
  Download,
  Trash2,
  FileText,
  FileSpreadsheet,
  Image,
  File,
  Paperclip,
  Loader2,
} from 'lucide-react';

interface AgreementAttachment {
  id: number;
  agreementId: number;
  fileName: string;
  originalFileName: string;
  objectKey: string;
  fileSize: number;
  mimeType: string;
  uploadedByUserId: number | null;
  uploadedAt: string;
  downloadUrl: string;
}

interface AgreementAttachmentsProps {
  agreementId: number;
  agreementTitle: string;
}

export default function AgreementAttachments({ agreementId, agreementTitle }: AgreementAttachmentsProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const locale = isArabic ? ar : undefined;
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingAttachment, setDeletingAttachment] = useState<AgreementAttachment | null>(null);

  // Fetch attachments
  const { data: attachments = [], isLoading } = useQuery<AgreementAttachment[]>({
    queryKey: [`/api/agreements/${agreementId}/attachments`],
    enabled: !!agreementId,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`/api/agreements/${agreementId}/attachments`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload attachment');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/agreements/${agreementId}/attachments`] });
      toast({
        description: t('partnerships.agreements.attachments.uploadSuccess'),
      });
    },
    onError: (error: any) => {
      toast({
        description: error.message || t('partnerships.agreements.attachments.uploadError'),
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (attachmentId: number) => {
      return apiRequest('DELETE', `/api/agreements/${agreementId}/attachments/${attachmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/agreements/${agreementId}/attachments`] });
      toast({
        description: t('partnerships.agreements.attachments.deleteSuccess'),
      });
      setDeletingAttachment(null);
    },
    onError: (error: any) => {
      toast({
        description: error.message || t('partnerships.agreements.attachments.deleteError'),
        variant: 'destructive',
      });
    },
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (mimeType === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />;
    if (mimeType.includes('word')) return <FileText className="h-4 w-4 text-blue-500" />;
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
    return <File className="h-4 w-4" />;
  };

  const getFileTypeBadge = (mimeType: string) => {
    if (mimeType === 'application/pdf') return 'PDF';
    if (mimeType.includes('word')) return 'Word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'Excel';
    if (mimeType.startsWith('image/')) return 'Image';
    return 'File';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    if (file.size > maxSize) {
      toast({
        description: t('partnerships.agreements.attachments.fileSizeError'),
        variant: 'destructive',
      });
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      toast({
        description: t('partnerships.agreements.attachments.fileTypeError'),
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = (attachment: AgreementAttachment) => {
    // Open download URL in new tab
    window.open(attachment.downloadUrl, '_blank');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <Paperclip className="h-5 w-5" />
          {t('partnerships.agreements.attachments.title')}
        </CardTitle>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
            onChange={handleFileSelect}
            disabled={isUploading}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {t('common.uploading')}
              </>
            ) : (
              <>
                <Upload className="me-2 h-4 w-4" />
                {t('partnerships.agreements.attachments.uploadAttachment')}
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : attachments.length === 0 ? (
          <div className="py-8 text-center">
            <Paperclip className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('partnerships.agreements.attachments.noAttachments')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('partnerships.agreements.attachments.uploadHint')}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('partnerships.agreements.attachments.fileName')}</TableHead>
                <TableHead>{t('partnerships.agreements.attachments.type')}</TableHead>
                <TableHead>{t('partnerships.agreements.attachments.size')}</TableHead>
                <TableHead>{t('partnerships.agreements.attachments.uploadedAt')}</TableHead>
                <TableHead className="text-end">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attachments.map((attachment) => (
                <TableRow key={attachment.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getFileIcon(attachment.mimeType)}
                      <span className="truncate max-w-[200px]" title={attachment.originalFileName}>
                        {attachment.originalFileName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {getFileTypeBadge(attachment.mimeType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatFileSize(attachment.fileSize)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(parseISO(attachment.uploadedAt), 'PP', { locale })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownload(attachment)}
                        title={t('common.download')}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingAttachment(attachment)}
                        title={t('common.delete')}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          {t('partnerships.agreements.attachments.allowedTypes')}
        </p>
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingAttachment} onOpenChange={(open) => !open && setDeletingAttachment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('partnerships.agreements.attachments.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('partnerships.agreements.attachments.deleteConfirm', { fileName: deletingAttachment?.originalFileName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingAttachment && deleteMutation.mutate(deletingAttachment.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : null}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
