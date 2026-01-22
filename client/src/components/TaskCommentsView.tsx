import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import {
  Download,
  Image,
  FileText,
  Archive,
  File,
  Paperclip,
  X,
} from 'lucide-react';

interface TaskComment {
  id: number;
  taskId: number;
  authorUserId: number;
  body: string;
  createdAt: string;
  authorUsername?: string;
  attachments?: Array<{
    id: number;
    commentId: number;
    fileName: string;
    storedFileName: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: string;
    uploadedByUserId: number | null;
  }>;
}

interface TaskCommentsViewProps {
  taskId: number;
}

export default function TaskCommentsView({ taskId }: TaskCommentsViewProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const locale = isArabic ? ar : undefined;
  const { toast } = useToast();
  const [commentText, setCommentText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: comments = [], isLoading } = useQuery<TaskComment[]>({
    queryKey: ['/api/tasks', taskId, 'comments'],
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ body }: { body: string }) => {
      return await apiRequest('POST', `/api/tasks/${taskId}/comments`, { body });
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async ({ commentId, file }: { commentId: number; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`/api/task-comments/${commentId}/attachments`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload file');
      }
      
      return response.json();
    },
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (mimeType === 'application/pdf') return <FileText className="h-4 w-4" />;
    if (mimeType.includes('zip')) return <Archive className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    
    try {
      const comment: any = await addCommentMutation.mutateAsync({ 
        body: commentText.trim() 
      });
      
      // Upload file if one is selected
      if (selectedFile && comment?.id) {
        await uploadFileMutation.mutateAsync({
          commentId: comment.id,
          file: selectedFile,
        });
        setSelectedFile(null);
      }
      
      // Invalidate and clear after success
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', taskId, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tasks'] });
      setCommentText('');
      
      toast({
        title: t('tasks.commentAdded'),
        description: selectedFile ? t('tasks.commentAndAttachmentPosted') : t('tasks.commentPosted'),
      });
    } catch (error: any) {
      toast({ 
        title: t('common.error'), 
        description: error.message || t('tasks.commentPostError'),
        variant: 'destructive',
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/zip', 'application/x-zip-compressed'];

    if (file.size > maxSize) {
      toast({
        title: t('common.error'),
        description: t('tasks.fileSizeError'),
        variant: 'destructive',
      });
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: t('common.error'),
        description: t('tasks.fileTypeError'),
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (attachmentId: number, fileName: string) => {
    try {
      const response = await fetch(`/api/task-comment-attachments/${attachmentId}/download`, {
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({ 
        title: t('common.error'), 
        description: t('tasks.downloadError'),
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        {t('tasks.loadingComments')}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="task-comments-view">
      {/* Existing Comments */}
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8 bg-muted rounded-md" data-testid="text-no-comments">
          {t('tasks.noComments')}
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <Card key={comment.id} className="p-4" data-testid={`card-comment-${comment.id}`}>
          <div className="flex items-start justify-between mb-2">
            <span className="font-semibold text-sm">
              {comment.authorUsername || t('tasks.unknownUser')}
            </span>
            <span className="text-xs text-muted-foreground">
              {format(parseISO(comment.createdAt), isArabic ? 'MMM d yyyy h:mm a' : 'MMM d, yyyy h:mm a', { locale })}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {comment.body}
          </p>
          
          {comment.attachments && comment.attachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {comment.attachments.map((attachment) => (
                <div 
                  key={attachment.id}
                  className="flex items-center gap-2 text-xs bg-muted/50 p-2 rounded-md hover-elevate"
                  data-testid={`attachment-${attachment.id}`}
                >
                  {getFileIcon(attachment.mimeType)}
                  <span className="flex-1 truncate" title={attachment.fileName}>
                    {attachment.fileName}
                  </span>
                  <span className="text-muted-foreground">
                    {formatFileSize(attachment.fileSize)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(attachment.id, attachment.fileName)}
                    data-testid={`button-download-${attachment.id}`}
                    title={t('common.download')}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
            </Card>
          ))}
        </div>
      )}

      {/* Add Comment Section */}
      <div className="space-y-3">
        <Textarea
          placeholder={t('tasks.writeComment')}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          data-testid={`textarea-admin-comment-${taskId}`}
          rows={3}
        />
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,application/zip"
        />
        
        {!selectedFile && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            data-testid="button-attach-file-admin"
          >
            <Paperclip className="h-4 w-4 me-2" />
            {t('tasks.attachFile')}
          </Button>
        )}
        
        {selectedFile && (
          <div className="flex items-center gap-2 text-sm bg-muted p-2 rounded-md">
            <Paperclip className="h-4 w-4" />
            <span className="flex-1 truncate">{selectedFile.name}</span>
            <span className="text-muted-foreground">{formatFileSize(selectedFile.size)}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFile(null)}
              data-testid="button-remove-file-admin"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        <Button
          variant="default"
          onClick={handleAddComment}
          disabled={!commentText.trim() || addCommentMutation.isPending || uploadFileMutation.isPending}
          data-testid={`button-submit-admin-comment-${taskId}`}
        >
          {addCommentMutation.isPending || uploadFileMutation.isPending ? t('tasks.posting') : t('tasks.postComment')}
        </Button>
      </div>
    </div>
  );
}
