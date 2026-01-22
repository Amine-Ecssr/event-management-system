import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FolderOpen, ArrowLeft, Upload, Download, Trash2, FileText, Image, File, Archive } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { format } from "date-fns";
import EventFileManager from "@/components/events/EventFileManager";

interface Event {
  id: string;
  name: string;
  nameAr?: string;
  date: string;
  type: string;
}

interface EventFolder {
  id: number;
  eventId: string;
  name: string;
  parentFolderId: number | null;
  path: string;
  createdAt: string;
  createdByUserId: number | null;
  fileCount?: number;
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
}

export default function EventFiles() {
  const { eventId } = useParams<{ eventId: string }>();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);

  // Fetch event details
  const { data: events } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  const event = events?.find(e => e.id === eventId);

  // Fetch folders for this event
  const { data: folders, isLoading: loadingFolders } = useQuery<EventFolder[]>({
    queryKey: [`/api/events/${eventId}/folders`],
    enabled: !!eventId,
  });

  // Fetch files for selected folder
  const { data: folderContents, isLoading: loadingFiles } = useQuery<{
    files: EventFile[];
    subfolders: EventFolder[];
  }>({
    queryKey: [`/api/folders/${selectedFolderId}`],
    enabled: !!selectedFolderId,
  });

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-5 w-5 text-blue-500" />;
    if (mimeType === 'application/pdf') return <FileText className="h-5 w-5 text-red-500" />;
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return <Archive className="h-5 w-5 text-yellow-500" />;
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDownload = async (fileId: number, fileName: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}/download`, {
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
        description: 'Failed to download file',
        variant: 'destructive',
      });
    }
  };

  const rootFolders = folders?.filter(f => !f.parentFolderId) || [];
  const selectedFolder = folders?.find(f => f.id === selectedFolderId);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => setLocation('/admin')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Events
        </Button>
      </div>

      <PageHeader
        title={event?.name || 'Event Files'}
        subtitle={event ? `Manage files and documents for this event` : 'Loading...'}
        icon={FolderOpen}
        iconColor="text-primary"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Folder Tree */}
        <Card className="lg:col-span-1">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Folders
            </h3>
            
            {loadingFolders ? (
              <p className="text-sm text-muted-foreground">Loading folders...</p>
            ) : rootFolders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">No folders yet</p>
                <p className="text-xs text-muted-foreground">Use the Event File Manager below to initialize folders</p>
              </div>
            ) : (
              <div className="space-y-1">
                {rootFolders.map((folder) => (
                  <Button
                    key={folder.id}
                    variant={selectedFolderId === folder.id ? "secondary" : "ghost"}
                    className="w-full justify-start gap-2"
                    onClick={() => setSelectedFolderId(folder.id)}
                  >
                    <FolderOpen className="h-4 w-4" />
                    <span className="truncate">{folder.name}</span>
                    {folder.fileCount !== undefined && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {folder.fileCount}
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* File List */}
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            {!selectedFolderId ? (
              <div className="text-center py-12">
                <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Select a Folder</h3>
                <p className="text-sm text-muted-foreground">
                  Choose a folder from the left to view its contents
                </p>
              </div>
            ) : loadingFiles ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">Loading files...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    {selectedFolder?.name}
                  </h3>
                  <span className="text-sm text-muted-foreground">
                    {folderContents?.files.length || 0} files
                  </span>
                </div>

                {folderContents?.subfolders && folderContents.subfolders.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase mb-2">Subfolders</p>
                    {folderContents.subfolders.map((subfolder) => (
                      <Button
                        key={subfolder.id}
                        variant="outline"
                        className="w-full justify-start gap-2"
                        onClick={() => setSelectedFolderId(subfolder.id)}
                      >
                        <FolderOpen className="h-4 w-4" />
                        {subfolder.name}
                      </Button>
                    ))}
                  </div>
                )}

                {!folderContents?.files || folderContents.files.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg">
                    <File className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No files in this folder</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {folderContents.files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
                      >
                        {getFileIcon(file.mimeType)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{file.originalFileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.fileSize)} • {format(new Date(file.uploadedAt), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(file.id, file.originalFileName)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event File Manager Component */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4">File Management</h3>
          {eventId && event && (
            <EventFileManager
              eventId={eventId}
              eventName={event.name}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
