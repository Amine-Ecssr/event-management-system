import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Download, FileText, Image, Archive, File, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { PageHeader } from '@/components/PageHeader';

interface TaskCommentAttachment {
  id: number;
  commentId: number;
  fileName: string;
  storedFileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploadedByUserId: number | null;
  comment: {
    id: number;
    taskId: number;
    authorUserId: number | null;
    body: string;
    createdAt: string;
  };
  task: {
    id: number;
    title: string;
    description: string | null;
    status: string;
    dueDate: string | null;
    eventDepartmentId: number;
    createdAt: string;
    updatedAt: string;
  };
  event?: {
    id: string;
    name: string;
    nameAr?: string;
  } | null;
  eventStakeholder?: {
    id: number;
    eventId: string;
    departmentId: number;
  } | null;
}

interface EventFile {
  id: number;
  eventFolderId: number;
  objectKey: string;
  thumbnailKey: string | null;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  sourceType: string;
  sourceId: number | null;
  uploadedByUserId: number | null;
  uploadedAt: string;
  folder: {
    id: number;
    eventId: string;
    name: string;
    path: string;
  };
  event: {
    id: string;
    name: string;
  };
}

export default function FilesManagement() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{ id: number; type: 'task' | 'event' } | null>(null);

  // Redirect if not superadmin
  if (user && user.role !== 'superadmin') {
    setLocation('/admin');
    return null;
  }

  // Fetch all task attachments
  const { data: taskAttachments, isLoading: isLoadingTasks } = useQuery<TaskCommentAttachment[]>({
    queryKey: ['/api/admin/all-attachments'],
    enabled: !!user && user.role === 'superadmin',
  });

  // Fetch all event files
  const { data: eventFiles, isLoading: isLoadingEvents } = useQuery<EventFile[]>({
    queryKey: ['/api/admin/all-event-files'],
    enabled: !!user && user.role === 'superadmin',
  });

  // Delete mutation
  const deleteTaskFileMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/task-comment-attachments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/all-attachments'] });
      toast({
        title: t('common.success'),
        description: t('files.fileDeleted'),
      });
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('files.fileDeleteError'),
        variant: "destructive",
      });
    },
  });

  const deleteEventFileMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/files/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/all-event-files'] });
      toast({
        title: t('common.success'),
        description: t('files.fileDeleted'),
      });
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('files.fileDeleteError'),
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: number, type: 'task' | 'event') => {
    setFileToDelete({ id, type });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (fileToDelete) {
      if (fileToDelete.type === 'task') {
        deleteTaskFileMutation.mutate(fileToDelete.id);
      } else {
        deleteEventFileMutation.mutate(fileToDelete.id);
      }
    }
  };

  const handleDownload = async (id: number, fileName: string, type: 'task' | 'event') => {
    try {
      const url = type === 'task' 
        ? `/api/task-comment-attachments/${id}/download`
        : `/api/files/${id}/download`;
        
      const response = await fetch(url, {
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      toast({ 
        title: t('common.error'), 
        description: t('files.downloadFailed'),
        variant: 'destructive',
      });
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (mimeType === 'application/pdf') return <FileText className="h-4 w-4" />;
    if (mimeType.includes('zip')) return <Archive className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const totalTaskStorage = taskAttachments?.reduce((sum, a) => sum + a.fileSize, 0) || 0;
  const totalEventStorage = eventFiles?.reduce((sum, a) => sum + a.fileSize, 0) || 0;
  const totalStorage = totalTaskStorage + totalEventStorage;

  // Group event files by event
  const eventFilesGrouped = eventFiles?.reduce((acc, file) => {
    const eventId = file.event.id;
    if (!acc[eventId]) {
      acc[eventId] = {
        event: file.event,
        files: [],
        totalSize: 0,
      };
    }
    acc[eventId].files.push(file);
    acc[eventId].totalSize += file.fileSize;
    return acc;
  }, {} as Record<string, { event: { id: string; name: string }; files: EventFile[]; totalSize: number }>);

  const eventGroups = eventFilesGrouped ? Object.values(eventFilesGrouped) : [];

  // Group task attachments by event
  const taskAttachmentsGrouped = taskAttachments?.reduce((acc, attachment) => {
    const eventId = attachment.event?.id || 'no-event';
    const eventName = attachment.event?.name || 'No Event';
    
    if (!acc[eventId]) {
      acc[eventId] = {
        event: { id: eventId, name: eventName },
        attachments: [],
        totalSize: 0,
      };
    }
    acc[eventId].attachments.push(attachment);
    acc[eventId].totalSize += attachment.fileSize;
    return acc;
  }, {} as Record<string, { event: { id: string; name: string }; attachments: TaskCommentAttachment[]; totalSize: number }>);

  const taskGroups = taskAttachmentsGrouped ? Object.values(taskAttachmentsGrouped) : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <PageHeader
        title={t('files.title')}
        subtitle={t('files.subtitle', { size: formatFileSize(totalStorage) })}
        icon={FolderOpen}
        iconColor="text-primary"
      />

      {/* Files tabs */}
      <Tabs defaultValue="event-files" className="w-full">
        <TabsList>
          <TabsTrigger value="event-files">
            Event Files ({eventFiles?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="task-attachments">
            Task Attachments ({taskAttachments?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Event Files Tab */}
        <TabsContent value="event-files" className="space-y-4">
          {isLoadingEvents ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center py-8" data-testid="text-loading-events">{t('files.loadingFiles')}</div>
              </CardContent>
            </Card>
          ) : !eventFiles || eventFiles.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground text-center py-8" data-testid="text-no-event-files">
                  {t('files.noFiles')}
                </p>
              </CardContent>
            </Card>
          ) : (
            eventGroups.map((group) => (
              <Card key={group.event.id} data-testid={`event-group-${group.event.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <FolderOpen className="h-5 w-5 text-primary" />
                      <div>
                        <h3 className="font-semibold text-lg">{group.event.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {group.files.length} {group.files.length === 1 ? 'file' : 'files'} • {formatFileSize(group.totalSize)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation(`/admin/events/${group.event.id}/files`)}
                      className="gap-2"
                    >
                      <FolderOpen className="h-4 w-4" />
                      View Details
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('files.file')}</TableHead>
                          <TableHead>{t('files.size')}</TableHead>
                          <TableHead>{t('files.uploadDate')}</TableHead>
                          <TableHead>Folder</TableHead>
                          <TableHead className="text-right">{t('files.actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.files.map((file) => (
                          <TableRow key={file.id} data-testid={`row-event-file-${file.id}`}>
                            <TableCell className="flex items-center gap-2">
                              {getFileIcon(file.mimeType)}
                              <span className="truncate max-w-[200px]" title={file.originalFileName}>
                                {file.originalFileName}
                              </span>
                            </TableCell>
                            <TableCell data-testid={`text-event-file-size-${file.id}`}>
                              {formatFileSize(file.fileSize)}
                            </TableCell>
                            <TableCell data-testid={`text-event-upload-date-${file.id}`}>
                              {format(new Date(file.uploadedAt), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell className="truncate max-w-[150px]" data-testid={`text-folder-path-${file.id}`}>
                              {file.folder?.path || 'N/A'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDownload(file.id, file.originalFileName, 'event')}
                                  data-testid={`button-download-event-file-${file.id}`}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(file.id, 'event')}
                                  data-testid={`button-delete-event-file-${file.id}`}
                                  disabled={deleteEventFileMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Task Attachments Tab */}
        <TabsContent value="task-attachments" className="space-y-4">
          {isLoadingTasks ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center py-8" data-testid="text-loading-tasks">{t('files.loadingFiles')}</div>
              </CardContent>
            </Card>
          ) : !taskAttachments || taskAttachments.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground text-center py-8" data-testid="text-no-files">
                  {t('files.noFiles')}
                </p>
              </CardContent>
            </Card>
          ) : (
            taskGroups.map((group) => (
              <Card key={group.event.id} data-testid={`task-group-${group.event.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <FolderOpen className="h-5 w-5 text-primary" />
                      <div>
                        <h3 className="font-semibold text-lg">{group.event.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {group.attachments.length} {group.attachments.length === 1 ? 'attachment' : 'attachments'} • {formatFileSize(group.totalSize)}
                        </p>
                      </div>
                    </div>
                    {group.event.id !== 'no-event' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(`/admin/events/${group.event.id}/files`)}
                        className="gap-2"
                      >
                        <FolderOpen className="h-4 w-4" />
                        View Event Files
                      </Button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('files.file')}</TableHead>
                          <TableHead>{t('files.size')}</TableHead>
                          <TableHead>{t('files.uploadDate')}</TableHead>
                          <TableHead>{t('files.task')}</TableHead>
                          <TableHead className="text-right">{t('files.actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.attachments.map((attachment) => (
                          <TableRow key={attachment.id} data-testid={`row-file-${attachment.id}`}>
                            <TableCell className="flex items-center gap-2">
                              {getFileIcon(attachment.mimeType)}
                              <span className="truncate max-w-[200px]" title={attachment.fileName}>
                                {attachment.fileName}
                              </span>
                            </TableCell>
                            <TableCell data-testid={`text-file-size-${attachment.id}`}>
                              {formatFileSize(attachment.fileSize)}
                            </TableCell>
                            <TableCell data-testid={`text-upload-date-${attachment.id}`}>
                              {format(new Date(attachment.uploadedAt), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell className="truncate max-w-[200px]" data-testid={`text-task-title-${attachment.id}`}>
                              {attachment.task?.title || 'N/A'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDownload(attachment.id, attachment.fileName, 'task')}
                                  data-testid={`button-download-file-${attachment.id}`}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(attachment.id, 'task')}
                                  data-testid={`button-delete-file-${attachment.id}`}
                                  disabled={deleteTaskFileMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('files.deleteFileTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('files.deleteFileDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-file">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              data-testid="button-confirm-delete-file"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
