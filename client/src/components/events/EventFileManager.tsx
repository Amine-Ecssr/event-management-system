import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Folder,
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  Upload,
  Download,
  Trash2,
  FolderPlus,
  MoreVertical,
  ChevronRight,
  Home,
  ArrowLeft,
  RefreshCw,
  Grid3X3,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EventFolder {
  id: number;
  eventId: string;
  name: string;
  parentFolderId: number | null;
  path: string;
  createdAt: string;
  createdByUserId: number | null;
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
  downloadUrl?: string;
  thumbnailUrl?: string;
}

interface FolderContents {
  folder: EventFolder;
  folders: EventFolder[];
  files: EventFile[];
  permission: {
    level: 'view' | 'upload' | 'manage';
    isAdmin: boolean;
    source?: 'folder' | 'event';
  } | null;
}

interface EventFileManagerProps {
  eventId: string;
  eventName?: string;
  className?: string;
}

// Helper to get file icon based on mime type
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (mimeType.includes('pdf') || mimeType.includes('document')) return FileText;
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) return FileArchive;
  return File;
}

// Helper to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function EventFileManager({ eventId, eventName, className }: EventFileManagerProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const locale = isArabic ? ar : undefined;
  const { toast } = useToast();
  
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [folderPath, setFolderPath] = useState<EventFolder[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch root folders for the event
  const { data: rootFolders = [], isLoading: loadingRoots, refetch: refetchRoots } = useQuery<EventFolder[]>({
    queryKey: ['/api/events', eventId, 'folders'],
    enabled: currentFolderId === null,
  });

  // Fetch folder contents when a folder is selected
  const { data: folderContents, isLoading: loadingFolder, refetch: refetchFolder } = useQuery<FolderContents>({
    queryKey: ['/api/folders', currentFolderId],
    enabled: currentFolderId !== null,
  });

  // Initialize folders mutation
  const initFoldersMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/events/${eventId}/folders/initialize`);
    },
    onSuccess: () => {
      toast({ title: t('Success'), description: t('Folders initialized successfully') });
      refetchRoots();
    },
    onError: (error: Error) => {
      toast({ 
        title: t('Error'), 
        description: error.message || t('Failed to initialize folders'),
        variant: 'destructive',
      });
    },
  });

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async ({ name, parentFolderId }: { name: string; parentFolderId: number | null }) => {
      return await apiRequest('POST', `/api/events/${eventId}/folders`, { name, parentFolderId });
    },
    onSuccess: () => {
      toast({ title: t('Success'), description: t('Folder created successfully') });
      setShowNewFolderDialog(false);
      setNewFolderName('');
      if (currentFolderId) {
        refetchFolder();
      } else {
        refetchRoots();
      }
    },
    onError: (error: Error) => {
      toast({ 
        title: t('Error'), 
        description: error.message || t('Failed to create folder'),
        variant: 'destructive',
      });
    },
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async ({ file, folderId }: { file: File; folderId: number }) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`/api/folders/${folderId}/files`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload file');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('Success'), description: t('File uploaded successfully') });
      refetchFolder();
    },
    onError: (error: Error) => {
      toast({ 
        title: t('Error'), 
        description: error.message || t('Failed to upload file'),
        variant: 'destructive',
      });
    },
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: number) => {
      return await apiRequest('DELETE', `/api/files/${fileId}`);
    },
    onSuccess: () => {
      toast({ title: t('Success'), description: t('File deleted successfully') });
      refetchFolder();
    },
    onError: (error: Error) => {
      toast({ 
        title: t('Error'), 
        description: error.message || t('Failed to delete file'),
        variant: 'destructive',
      });
    },
  });

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: number) => {
      return await apiRequest('DELETE', `/api/folders/${folderId}`);
    },
    onSuccess: () => {
      toast({ title: t('Success'), description: t('Folder deleted successfully') });
      if (currentFolderId) {
        refetchFolder();
      } else {
        refetchRoots();
      }
    },
    onError: (error: Error) => {
      toast({ 
        title: t('Error'), 
        description: error.message || t('Failed to delete folder'),
        variant: 'destructive',
      });
    },
  });

  // Navigate into a folder
  const handleFolderClick = (folder: EventFolder) => {
    setFolderPath([...folderPath, folder]);
    setCurrentFolderId(folder.id);
  };

  // Navigate to a specific path
  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      // Root
      setFolderPath([]);
      setCurrentFolderId(null);
    } else {
      const newPath = folderPath.slice(0, index + 1);
      setFolderPath(newPath);
      setCurrentFolderId(newPath[newPath.length - 1].id);
    }
  };

  // Navigate back
  const handleGoBack = () => {
    if (folderPath.length > 0) {
      const newPath = folderPath.slice(0, -1);
      setFolderPath(newPath);
      setCurrentFolderId(newPath.length > 0 ? newPath[newPath.length - 1].id : null);
    }
  };

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentFolderId) return;
    
    Array.from(files).forEach(file => {
      uploadFileMutation.mutate({ file, folderId: currentFolderId });
    });
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [currentFolderId, uploadFileMutation]);

  // Handle file download
  const handleDownload = (file: EventFile) => {
    if (file.downloadUrl) {
      window.open(file.downloadUrl, '_blank');
    }
  };

  // Get permission level
  const canUpload = folderContents?.permission?.level === 'upload' || 
                    folderContents?.permission?.level === 'manage' ||
                    folderContents?.permission?.isAdmin;
  const canManage = folderContents?.permission?.level === 'manage' ||
                    folderContents?.permission?.isAdmin;

  // Loading state
  const isLoading = loadingRoots || loadingFolder;

  // Determine what to show
  const folders = currentFolderId === null ? rootFolders : (folderContents?.folders || []);
  const files = currentFolderId === null ? [] : (folderContents?.files || []);
  const isEmpty = folders.length === 0 && files.length === 0;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {eventName ? `${t('Files')}: ${eventName}` : t('Event Files')}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            >
              {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => currentFolderId ? refetchFolder() : refetchRoots()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => handleBreadcrumbClick(-1)}
          >
            <Home className="h-3 w-3 mr-1" />
            {t('Root')}
          </Button>
          {folderPath.map((folder, index) => (
            <div key={folder.id} className="flex items-center">
              <ChevronRight className="h-3 w-3 mx-1" />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={() => handleBreadcrumbClick(index)}
              >
                {folder.name}
              </Button>
            </div>
          ))}
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-4">
          {folderPath.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleGoBack}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t('Back')}
            </Button>
          )}
          
          {currentFolderId && canUpload && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadFileMutation.isPending}
              >
                <Upload className="h-4 w-4 mr-1" />
                {t('Upload')}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={handleFileUpload}
              />
            </>
          )}
          
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewFolderDialog(true)}
            >
              <FolderPlus className="h-4 w-4 mr-1" />
              {t('New Folder')}
            </Button>
          )}
          
          {rootFolders.length === 0 && currentFolderId === null && (
            <Button
              variant="default"
              size="sm"
              onClick={() => initFoldersMutation.mutate()}
              disabled={initFoldersMutation.isPending}
            >
              <FolderPlus className="h-4 w-4 mr-1" />
              {t('Initialize Folders')}
            </Button>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            {t('Loading...')}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Folder className="h-12 w-12 mb-2 opacity-50" />
            <p>{currentFolderId === null ? t('No folders yet') : t('This folder is empty')}</p>
            {currentFolderId === null && (
              <p className="text-sm mt-1">{t('Click "Initialize Folders" to create the default folder structure')}</p>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {/* Folders */}
            {folders.map((folder) => (
              <div
                key={`folder-${folder.id}`}
                className="flex flex-col items-center p-3 rounded-lg border hover:bg-accent cursor-pointer group relative"
                onClick={() => handleFolderClick(folder)}
              >
                <Folder className="h-12 w-12 text-yellow-500 mb-2" />
                <span className="text-sm text-center truncate w-full" title={folder.name}>
                  {folder.name}
                </span>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(t('Are you sure you want to delete this folder and all its contents?'))) {
                            deleteFolderMutation.mutate(folder.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('Delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
            
            {/* Files */}
            {files.map((file) => {
              const FileIcon = getFileIcon(file.mimeType);
              return (
                <div
                  key={`file-${file.id}`}
                  className="flex flex-col items-center p-3 rounded-lg border hover:bg-accent cursor-pointer group relative"
                  onClick={() => handleDownload(file)}
                >
                  {file.thumbnailUrl && file.mimeType.startsWith('image/') ? (
                    <img
                      src={file.thumbnailUrl}
                      alt={file.originalFileName}
                      className="h-12 w-12 object-cover rounded mb-2"
                    />
                  ) : (
                    <FileIcon className="h-12 w-12 text-blue-500 mb-2" />
                  )}
                  <span className="text-sm text-center truncate w-full" title={file.originalFileName}>
                    {file.originalFileName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(file.fileSize)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(file);
                      }}>
                        <Download className="h-4 w-4 mr-2" />
                        {t('Download')}
                      </DropdownMenuItem>
                      {canManage && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(t('Are you sure you want to delete this file?'))) {
                              deleteFileMutation.mutate(file.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('Delete')}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        ) : (
          /* List view */
          <div className="border rounded-lg divide-y">
            {/* Folders */}
            {folders.map((folder) => (
              <div
                key={`folder-${folder.id}`}
                className="flex items-center justify-between p-3 hover:bg-accent cursor-pointer"
                onClick={() => handleFolderClick(folder)}
              >
                <div className="flex items-center gap-3">
                  <Folder className="h-5 w-5 text-yellow-500" />
                  <span className="text-sm">{folder.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(t('Are you sure you want to delete this folder and all its contents?'))) {
                              deleteFolderMutation.mutate(folder.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('Delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
            
            {/* Files */}
            {files.map((file) => {
              const FileIcon = getFileIcon(file.mimeType);
              return (
                <div
                  key={`file-${file.id}`}
                  className="flex items-center justify-between p-3 hover:bg-accent cursor-pointer"
                  onClick={() => handleDownload(file)}
                >
                  <div className="flex items-center gap-3">
                    <FileIcon className="h-5 w-5 text-blue-500" />
                    <div>
                      <span className="text-sm block">{file.originalFileName}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(file.fileSize)} • {format(parseISO(file.uploadedAt), 'MMM d, yyyy', { locale })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(file);
                        }}>
                          <Download className="h-4 w-4 mr-2" />
                          {t('Download')}
                        </DropdownMenuItem>
                        {canManage && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(t('Are you sure you want to delete this file?'))) {
                                deleteFileMutation.mutate(file.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('Delete')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Create New Folder')}</DialogTitle>
            <DialogDescription>
              {t('Enter a name for the new folder')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder={t('Folder name')}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
              {t('Cancel')}
            </Button>
            <Button
              onClick={() => createFolderMutation.mutate({ 
                name: newFolderName, 
                parentFolderId: currentFolderId 
              })}
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
            >
              {t('Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
