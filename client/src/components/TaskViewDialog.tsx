import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import {
  Calendar,
  Building2,
  Download,
  Image,
  FileText,
  Archive,
  File,
  Paperclip,
  X,
  Trash2,
  Loader2,
} from 'lucide-react';

interface TaskDetails {
  id: number;
  eventDepartmentId: number;
  title: string;
  titleAr?: string | null;
  description: string | null;
  descriptionAr?: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'waiting';
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  notificationEmails: string[] | null;
  event: {
    id: string;
    name: string;
    nameAr?: string | null;
    startDate: string;
    endDate: string;
  } | null;
  department: {
    id: number;
    name: string;
    nameAr?: string | null;
  } | null;
  commentCount: number;
}

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

interface TaskViewDialogProps {
  taskId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If true, auto-focus the comment input when opened */
  focusComment?: boolean;
}

export function TaskViewDialog({ taskId, open, onOpenChange, focusComment = false }: TaskViewDialogProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const isArabic = i18n.language === 'ar';
  const locale = isArabic ? ar : undefined;
  
  const [commentText, setCommentText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch task details
  const { data: task, isLoading: isLoadingTask, error: taskError } = useQuery<TaskDetails>({
    queryKey: ['/api/tasks', taskId],
    queryFn: () => apiRequest('GET', `/api/tasks/${taskId}`),
    enabled: !!taskId && open,
  });

  // Fetch comments
  const { data: comments = [], isLoading: isLoadingComments } = useQuery<TaskComment[]>({
    queryKey: ['/api/tasks', taskId, 'comments'],
    enabled: !!taskId && open,
  });

  // Check if user can edit this task (is from their department or is admin)
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const canEditStatus = isAdmin || (task?.department?.id === user?.departmentId);

  // Status update mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      return await apiRequest('PATCH', `/api/tasks/${taskId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', taskId] });
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-workflows'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stakeholder-dashboard'] });
      toast({
        title: t('common.success'),
        description: t('tasks.taskUpdated'),
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('tasks.taskUpdateError'),
        variant: 'destructive',
      });
    },
  });

  // Comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async ({ body }: { body: string }) => {
      return await apiRequest('POST', `/api/tasks/${taskId}/comments`, { body });
    },
  });

  // File upload mutation
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

  // Delete attachment mutation
  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: number) => {
      const response = await fetch(`/api/task-comment-attachments/${attachmentId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Delete failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', taskId, 'comments'] });
      toast({ 
        title: t('common.success'), 
        description: t('files.fileDeleted') 
      });
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('files.fileDeleteError'),
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
    if (mimeType === 'application/pdf') return <FileText className="h-4 w-4" />;
    if (mimeType.includes('zip')) return <Archive className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'waiting':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  const handleStatusUpdate = (newStatus: string) => {
    updateTaskMutation.mutate({ status: newStatus });
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
  };

  const handleDownload = (attachmentId: number, fileName: string) => {
    const link = document.createElement('a');
    link.href = `/api/task-comment-attachments/${attachmentId}/download`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteAttachment = (attachmentId: number) => {
    if (confirm(t('files.confirmDelete'))) {
      deleteAttachmentMutation.mutate(attachmentId);
    }
  };

  const canDeleteAttachment = (attachment: NonNullable<TaskComment['attachments']>[0]) => {
    return attachment.uploadedByUserId === user?.id || isAdmin;
  };

  // Focus comment input when dialog opens with focusComment=true
  const handleOpenAutoFocus = (e: Event) => {
    if (focusComment && commentInputRef.current) {
      e.preventDefault();
      commentInputRef.current.focus();
    }
  };

  const displayTitle = task ? (isArabic && task.titleAr ? task.titleAr : task.title) : '';
  const displayDescription = task ? (isArabic && task.descriptionAr ? task.descriptionAr : task.description) : '';
  const displayEventName = task?.event ? (isArabic && task.event.nameAr ? task.event.nameAr : task.event.name) : '';
  const displayDepartmentName = task?.department ? (isArabic && task.department.nameAr ? task.department.nameAr : task.department.name) : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-3xl max-h-[90vh] overflow-y-auto" 
        data-testid="dialog-task-view"
        onOpenAutoFocus={handleOpenAutoFocus}
      >
        {isLoadingTask ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : taskError ? (
          <div className="text-center py-8">
            <p className="text-destructive">{t('tasks.taskLoadError')}</p>
          </div>
        ) : task ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">{displayTitle}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2">
                {displayEventName && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {displayEventName}
                  </span>
                )}
                {displayDepartmentName && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    {displayDepartmentName}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Task Details */}
              {displayDescription && (
                <div>
                  <h3 className="font-semibold mb-2">{t('tasks.fields.description')}</h3>
                  <p className="text-sm text-muted-foreground">{displayDescription}</p>
                </div>
              )}

              {/* Status Update - only show for users who can edit */}
              {canEditStatus && (
                <div>
                  <h3 className="font-semibold mb-2">{t('tasks.updateStatus')}</h3>
                  {task.status === 'waiting' ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Select value={task.status} disabled={true}>
                              <SelectTrigger className="opacity-60 cursor-not-allowed">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="waiting">{t('tasks.status.waiting')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[250px]">
                          <p>{t('tasks.waitingDescription')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Select
                      value={task.status}
                      onValueChange={handleStatusUpdate}
                      disabled={updateTaskMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">{t('tasks.status.pending')}</SelectItem>
                        <SelectItem value="in_progress">{t('tasks.status.in_progress')}</SelectItem>
                        <SelectItem value="completed">{t('tasks.status.completed')}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Task Metadata */}
              <div className="flex flex-wrap gap-2">
                <Badge className={getStatusBadgeColor(task.status)}>
                  {t(`tasks.status.${task.status}`)}
                </Badge>
                {task.dueDate && (
                  <Badge variant="outline" className="gap-1">
                    <Calendar className="h-3 w-3" />
                    {t('tasks.dueOn', { date: format(parseISO(task.dueDate), 'MMM d, yyyy', { locale }) })}
                  </Badge>
                )}
                {!canEditStatus && (
                  <Badge variant="secondary" className="text-xs">
                    {t('workflows.viewOnlyAccess')}
                  </Badge>
                )}
              </div>

              {/* Comments Section */}
              <div>
                <h3 className="font-semibold mb-4">{t('tasks.comments')}</h3>

                {isLoadingComments ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8 bg-muted rounded-md">
                    {t('tasks.noComments')}
                  </p>
                ) : (
                  <div className="space-y-4 mb-4">
                    {comments.map((comment) => (
                      <Card key={comment.id} className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-semibold text-sm">
                            {comment.authorUsername || t('tasks.unknownUser')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(comment.createdAt), 'MMM d, yyyy h:mm a', { locale })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{comment.body}</p>
                        
                        {comment.attachments && comment.attachments.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {comment.attachments.map((attachment) => (
                              <div 
                                key={attachment.id}
                                className="flex items-center gap-2 text-xs bg-muted/50 p-2 rounded-md"
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
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                                {canDeleteAttachment(attachment) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteAttachment(attachment.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}

                {/* Add Comment Form */}
                <div className="space-y-3">
                  <Textarea
                    ref={commentInputRef}
                    placeholder={t('tasks.writeComment')}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={3}
                  />
                  
                  {!selectedFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
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
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.zip"
                    onChange={handleFileSelect}
                  />
                  
                  <Button
                    variant="default"
                    onClick={handleAddComment}
                    disabled={!commentText.trim() || addCommentMutation.isPending || uploadFileMutation.isPending}
                  >
                    {addCommentMutation.isPending || uploadFileMutation.isPending ? t('tasks.posting') : t('tasks.postComment')}
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
