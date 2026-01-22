import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, AlertCircle, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { Event } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/PageHeader';

type ReminderType = '1_week' | '1_day' | 'weekly' | 'daily' | 'morning_of';

type Reminder = {
  id: number;
  eventId: string;
  reminderType: ReminderType;
  scheduledFor: string;
  status: 'pending' | 'sent' | 'error';
  sentAt: string | null;
  attempts: number;
  errorMessage: string | null;
  event: Event;
};

export default function Reminders() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedReminderType, setSelectedReminderType] = useState<ReminderType>('1_week');
  const [deletingReminder, setDeletingReminder] = useState<Reminder | null>(null);
  const { toast } = useToast();

  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  const { data: reminders = [], isLoading: remindersLoading } = useQuery<Reminder[]>({
    queryKey: ['/api/reminders'],
  });

  const createReminderMutation = useMutation({
    mutationFn: async (data: { eventId: string; reminderType: ReminderType }) => {
      return await apiRequest('POST', '/api/reminders', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
      setSelectedEventId('');
      setSelectedReminderType('1_week');
      toast({
        title: t('reminders.reminderCreated'),
        description: t('reminders.reminderScheduled'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('reminders.createFailed'),
        variant: 'destructive',
      });
    },
  });

  const resendReminderMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('POST', `/api/reminders/${id}/resend`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
      toast({
        title: t('reminders.reminderResent'),
        description: t('reminders.reminderResentDesc'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('reminders.resendFailed'),
        variant: 'destructive',
      });
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/reminders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reminders'] });
      setDeletingReminder(null);
      toast({
        title: t('reminders.reminderDeleted'),
        description: t('reminders.reminderRemoved'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('reminders.deleteFailed'),
        variant: 'destructive',
      });
    },
  });

  const handleCreateReminder = () => {
    if (!selectedEventId) {
      toast({
        title: t('common.error'),
        description: t('reminders.pleaseSelectEvent'),
        variant: 'destructive',
      });
      return;
    }

    createReminderMutation.mutate({
      eventId: selectedEventId,
      reminderType: selectedReminderType,
    });
  };

  const handleDeleteReminder = (reminder: Reminder) => {
    setDeletingReminder(reminder);
  };

  const confirmDelete = () => {
    if (deletingReminder) {
      deleteReminderMutation.mutate(deletingReminder.id);
    }
  };

  const sortedReminders = [...reminders].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    
    if (a.status === 'pending' && b.status === 'pending') {
      return new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime();
    }
    
    return new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime();
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: 'default' as const, label: t('reminders.status.pending') },
      sent: { variant: 'default' as const, label: t('reminders.status.sent') },
      error: { variant: 'destructive' as const, label: t('reminders.status.error') },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

    return (
      <Badge 
        variant={config.variant} 
        data-testid={`badge-status-${status}`}
        className={
          status === 'pending' 
            ? 'bg-yellow-500 hover:bg-yellow-600' 
            : status === 'sent' 
            ? 'bg-green-500 hover:bg-green-600' 
            : ''
        }
      >
        {config.label}
      </Badge>
    );
  };

  const getReminderTypeBadge = (type: ReminderType) => {
    const typeLabels: Record<ReminderType, string> = {
      '1_week': t('reminders.types.1_week'),
      '1_day': t('reminders.types.1_day'),
      'weekly': t('reminders.types.weekly'),
      'daily': t('reminders.types.daily'),
      'morning_of': t('reminders.types.morning_of')
    };

    return (
      <Badge variant="outline" data-testid={`badge-type-${type}`}>
        {typeLabels[type]}
      </Badge>
    );
  };

  return (
    <div className="p-6">
      <PageHeader
        title={t('reminders.title')}
        subtitle={t('reminders.description')}
        icon={Bell}
        iconColor="text-primary"
      />

      <div className="max-w-7xl mx-auto space-y-6">

        <Card data-testid="card-create-reminder">
          <CardHeader>
            <CardTitle>{t('reminders.createNew')}</CardTitle>
            <CardDescription>
              {t('reminders.createDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event-select">{t('reminders.event')}</Label>
                <Select
                  value={selectedEventId}
                  onValueChange={setSelectedEventId}
                  disabled={eventsLoading}
                >
                  <SelectTrigger id="event-select" data-testid="select-event">
                    <SelectValue placeholder={t('reminders.selectEvent')} />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event) => (
                      <SelectItem 
                        key={event.id} 
                        value={event.id}
                        data-testid={`option-event-${event.id}`}
                      >
                        {event.name} ({format(new Date(event.startDate), 'MMM d, yyyy')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('reminders.reminderType')}</Label>
                <RadioGroup
                  value={selectedReminderType}
                  onValueChange={(value) => setSelectedReminderType(value as ReminderType)}
                  className="space-y-3"
                >
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem 
                      value="1_week" 
                      id="1_week" 
                      data-testid="radio-1-week"
                    />
                    <div className="space-y-1">
                      <Label htmlFor="1_week" className="font-medium cursor-pointer">
                        {t('reminders.types.1_week')}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {t('reminders.descriptions.1_week')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem 
                      value="1_day" 
                      id="1_day" 
                      data-testid="radio-1-day"
                    />
                    <div className="space-y-1">
                      <Label htmlFor="1_day" className="font-medium cursor-pointer">
                        {t('reminders.types.1_day')}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {t('reminders.descriptions.1_day')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem 
                      value="weekly" 
                      id="weekly" 
                      data-testid="radio-weekly"
                    />
                    <div className="space-y-1">
                      <Label htmlFor="weekly" className="font-medium cursor-pointer">
                        {t('reminders.types.weekly')}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {t('reminders.descriptions.weekly')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem 
                      value="daily" 
                      id="daily" 
                      data-testid="radio-daily"
                    />
                    <div className="space-y-1">
                      <Label htmlFor="daily" className="font-medium cursor-pointer">
                        {t('reminders.types.daily')}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {t('reminders.descriptions.daily')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <RadioGroupItem 
                      value="morning_of" 
                      id="morning_of" 
                      data-testid="radio-morning-of"
                    />
                    <div className="space-y-1">
                      <Label htmlFor="morning_of" className="font-medium cursor-pointer">
                        {t('reminders.types.morning_of')}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {t('reminders.descriptions.morning_of')}
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <Button
              onClick={handleCreateReminder}
              disabled={createReminderMutation.isPending || !selectedEventId}
              data-testid="button-create-reminder"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('reminders.createReminder')}
            </Button>
          </CardContent>
        </Card>

        <Card data-testid="card-reminders-list">
          <CardHeader>
            <CardTitle>{t('reminders.scheduledReminders')}</CardTitle>
            <CardDescription>
              {t('reminders.viewManageReminders')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {remindersLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('reminders.loadingReminders')}
              </div>
            ) : sortedReminders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('reminders.noReminders')}
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {sortedReminders.map((reminder) => (
                    <Card key={reminder.id} data-testid={`card-reminder-${reminder.id}`}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate" data-testid={`text-event-name-${reminder.id}`}>
                              {reminder.event.name}
                            </p>
                            <p className="text-sm text-muted-foreground" data-testid={`text-scheduled-${reminder.id}`}>
                              {format(new Date(reminder.scheduledFor), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                          {getStatusBadge(reminder.status)}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {getReminderTypeBadge(reminder.reminderType)}
                          {reminder.sentAt && (
                            <Badge variant="outline" className="text-xs">
                              {t('reminders.table.sentAt')}: {format(new Date(reminder.sentAt), 'MMM d h:mm a')}
                            </Badge>
                          )}
                        </div>
                        {reminder.errorMessage && (
                          <div className="flex items-center gap-1 text-destructive text-sm" data-testid={`text-error-${reminder.id}`}>
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{reminder.errorMessage}</span>
                          </div>
                        )}
                        <div className="flex gap-2 pt-2 border-t">
                          {user?.role === 'superadmin' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => resendReminderMutation.mutate(reminder.id)}
                              data-testid={`button-resend-${reminder.id}`}
                              disabled={resendReminderMutation.isPending}
                            >
                              {t('reminders.resendNow')}
                            </Button>
                          )}
                          {reminder.status !== 'sent' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteReminder(reminder)}
                              data-testid={`button-delete-${reminder.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('reminders.table.event')}</TableHead>
                        <TableHead>{t('reminders.table.type')}</TableHead>
                        <TableHead>{t('reminders.table.scheduledFor')}</TableHead>
                        <TableHead>{t('reminders.table.status')}</TableHead>
                        <TableHead>{t('reminders.table.sentAt')}</TableHead>
                        <TableHead>{t('reminders.table.attempts')}</TableHead>
                        <TableHead>{t('reminders.table.error')}</TableHead>
                        <TableHead className="text-right">{t('reminders.table.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedReminders.map((reminder) => (
                        <TableRow key={reminder.id} data-testid={`row-reminder-${reminder.id}`}>
                          <TableCell className="font-medium" data-testid={`text-event-name-${reminder.id}`}>
                            {reminder.event.name}
                          </TableCell>
                          <TableCell>
                            {getReminderTypeBadge(reminder.reminderType)}
                          </TableCell>
                          <TableCell data-testid={`text-scheduled-${reminder.id}`}>
                            {format(new Date(reminder.scheduledFor), 'MMM d, yyyy h:mm a')}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(reminder.status)}
                          </TableCell>
                          <TableCell data-testid={`text-sent-at-${reminder.id}`}>
                            {reminder.sentAt 
                              ? format(new Date(reminder.sentAt), 'MMM d, yyyy h:mm a')
                              : '-'
                            }
                          </TableCell>
                          <TableCell data-testid={`text-attempts-${reminder.id}`}>
                            {reminder.attempts}
                          </TableCell>
                          <TableCell>
                            {reminder.errorMessage && (
                              <div 
                                className="flex items-center gap-1 text-destructive max-w-xs"
                                data-testid={`text-error-${reminder.id}`}
                              >
                                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                <span className="text-sm truncate">{reminder.errorMessage}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {user?.role === 'superadmin' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => resendReminderMutation.mutate(reminder.id)}
                                  data-testid={`button-resend-${reminder.id}`}
                                  disabled={resendReminderMutation.isPending}
                                >
                                  {t('reminders.resendNow')}
                                </Button>
                              )}
                              {reminder.status !== 'sent' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteReminder(reminder)}
                                  data-testid={`button-delete-${reminder.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deletingReminder} onOpenChange={() => setDeletingReminder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('reminders.deleteReminder')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('reminders.deleteConfirmation', { eventName: deletingReminder?.event.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              data-testid="button-confirm-delete"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
