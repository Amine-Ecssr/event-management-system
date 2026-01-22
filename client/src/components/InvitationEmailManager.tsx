import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, Mail, Send, Loader2, Clock, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InvitationEmailManagerProps {
  eventId: string;
  eventName: string;
}

interface CustomEmail {
  id: number;
  subject: string;
  body: string;
  isActive: boolean;
  createdAt: string;
}

interface InvitationJob {
  id: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  totalRecipients: number;
  emailsSent: number;
  emailsFailed: number;
  waitTimeSeconds: number;
  useCustomEmail: boolean;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  createdAt: string;
  isRunning?: boolean;
}

export default function InvitationEmailManager({ eventId, eventName }: InvitationEmailManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testEmail, setTestEmail] = useState("");
  const [waitTimeSeconds, setWaitTimeSeconds] = useState(2);
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");

  // Fetch custom email
  const { data: customEmail, isLoading: isLoadingCustomEmail } = useQuery<CustomEmail>({
    queryKey: [`/api/events/${eventId}/custom-email`],
    retry: false,
  });

  // Fetch jobs
  const { data: jobs = [], isLoading: isLoadingJobs } = useQuery<InvitationJob[]>({
    queryKey: [`/api/events/${eventId}/invitation-jobs`],
    refetchInterval: (query) => {
      // Refetch every 2 seconds if there's an active job
      const data = query.state.data;
      const hasActiveJob = data?.some((job: InvitationJob) => job.status === 'pending' || job.status === 'in_progress');
      return hasActiveJob ? 2000 : false;
    },
  });

  // Save custom email mutation
  const saveCustomEmailMutation = useMutation({
    mutationFn: async (data: { subject: string; body: string }) => {
      const res = await fetch(`/api/events/${eventId}/custom-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/custom-email`] });
      toast({
        title: "Success",
        description: "Custom email template saved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send test email mutation
  const sendTestEmailMutation = useMutation({
    mutationFn: async (data: { testEmail: string; useCustomEmail: boolean }) => {
      const res = await fetch(`/api/events/${eventId}/send-test-invitation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Test email sent successfully",
      });
      setTestEmail("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send invitations mutation
  const sendInvitationsMutation = useMutation({
    mutationFn: async (data: { useCustomEmail: boolean; waitTimeSeconds: number }) => {
      const res = await fetch(`/api/events/${eventId}/send-invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/invitation-jobs`] });
      toast({
        title: "Success",
        description: "Invitation email job started successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Cancel job mutation
  const cancelJobMutation = useMutation({
    mutationFn: async (jobId: number) => {
      const res = await fetch(`/api/invitation-jobs/${jobId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/invitation-jobs`] });
      toast({
        title: "Success",
        description: "Job cancelled successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveCustomEmail = () => {
    if (!customSubject.trim() || !customBody.trim()) {
      toast({
        title: "Validation Error",
        description: "Subject and body are required",
        variant: "destructive",
      });
      return;
    }
    saveCustomEmailMutation.mutate({ subject: customSubject, body: customBody });
  };

  const handleSendTestEmail = (useCustomEmail: boolean) => {
    if (!testEmail.trim()) {
      toast({
        title: "Validation Error",
        description: "Test email address is required",
        variant: "destructive",
      });
      return;
    }
    sendTestEmailMutation.mutate({ testEmail, useCustomEmail });
  };

  const handleSendInvitations = (useCustomEmail: boolean) => {
    if (useCustomEmail && !customEmail) {
      toast({
        title: "Error",
        description: "Please create a custom email template first",
        variant: "destructive",
      });
      return;
    }
    sendInvitationsMutation.mutate({ useCustomEmail, waitTimeSeconds });
  };

  const getJobStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any }> = {
      pending: { variant: "outline", icon: Clock },
      in_progress: { variant: "default", icon: Loader2 },
      completed: { variant: "default", icon: CheckCircle2 },
      failed: { variant: "destructive", icon: XCircle },
      cancelled: { variant: "secondary", icon: XCircle },
    };
    const { variant, icon: Icon } = variants[status] || variants.pending;
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invitation Emails for {eventName}
          </CardTitle>
          <CardDescription>
            Manage and send invitation emails to event invitees
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="generic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="generic">Generic Template</TabsTrigger>
              <TabsTrigger value="custom">Custom Email</TabsTrigger>
              <TabsTrigger value="jobs">Email Jobs</TabsTrigger>
            </TabsList>

            <TabsContent value="generic" className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  The generic template uses the system-wide invitation email template configured in email settings.
                  It will dynamically fill in event details for each invitee.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="test-email-generic">Test Email Address</Label>
                  <div className="flex gap-2">
                    <Input
                      id="test-email-generic"
                      type="email"
                      placeholder="test@example.com"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                    />
                    <Button
                      onClick={() => handleSendTestEmail(false)}
                      disabled={sendTestEmailMutation.isPending}
                    >
                      {sendTestEmailMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      <span className="ml-2">Send Test</span>
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="wait-time-generic">Wait Time Between Emails (seconds)</Label>
                  <Input
                    id="wait-time-generic"
                    type="number"
                    min={1}
                    max={60}
                    value={waitTimeSeconds}
                    onChange={(e) => setWaitTimeSeconds(parseInt(e.target.value) || 2)}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Time to wait between sending each email (1-60 seconds)
                  </p>
                </div>

                <Button
                  onClick={() => handleSendInvitations(false)}
                  disabled={sendInvitationsMutation.isPending}
                  size="lg"
                  className="w-full"
                >
                  {sendInvitationsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="ml-2">Send Invitations to All Invitees</span>
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="custom" className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Custom emails are sent as-is without template processing. You have full control over the subject and body.
                  No variables or placeholders will be replaced.
                </AlertDescription>
              </Alert>

              {customEmail && (
                <Alert className="bg-green-50 dark:bg-green-950">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    A custom email template is already saved for this event. You can edit it below.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div>
                  <Label htmlFor="custom-subject">Subject</Label>
                  <Input
                    id="custom-subject"
                    placeholder="Invitation to [Event Name]"
                    value={customSubject || customEmail?.subject || ""}
                    onChange={(e) => setCustomSubject(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="custom-body">Email Body (HTML)</Label>
                  <Textarea
                    id="custom-body"
                    placeholder="<h1>You're Invited!</h1><p>...</p>"
                    value={customBody || customEmail?.body || ""}
                    onChange={(e) => setCustomBody(e.target.value)}
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>

                <Button
                  onClick={handleSaveCustomEmail}
                  disabled={saveCustomEmailMutation.isPending}
                >
                  {saveCustomEmailMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span className="ml-2">Save Custom Email</span>
                </Button>

                <div>
                  <Label htmlFor="test-email-custom">Test Email Address</Label>
                  <div className="flex gap-2">
                    <Input
                      id="test-email-custom"
                      type="email"
                      placeholder="test@example.com"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                    />
                    <Button
                      onClick={() => handleSendTestEmail(true)}
                      disabled={sendTestEmailMutation.isPending || !customEmail}
                    >
                      {sendTestEmailMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      <span className="ml-2">Send Test</span>
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="wait-time-custom">Wait Time Between Emails (seconds)</Label>
                  <Input
                    id="wait-time-custom"
                    type="number"
                    min={1}
                    max={60}
                    value={waitTimeSeconds}
                    onChange={(e) => setWaitTimeSeconds(parseInt(e.target.value) || 2)}
                  />
                </div>

                <Button
                  onClick={() => handleSendInvitations(true)}
                  disabled={sendInvitationsMutation.isPending || !customEmail}
                  size="lg"
                  className="w-full"
                >
                  {sendInvitationsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="ml-2">Send Custom Invitations to All Invitees</span>
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="jobs" className="space-y-4">
              <div className="space-y-4">
                {isLoadingJobs ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : jobs.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No invitation email jobs have been created yet.
                    </AlertDescription>
                  </Alert>
                ) : (
                  jobs.map((job) => (
                    <Card key={job.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            Job #{job.id}
                          </CardTitle>
                          {getJobStatusBadge(job.status)}
                        </div>
                        <CardDescription>
                          {job.useCustomEmail ? "Custom Email" : "Generic Template"} •
                          Created {new Date(job.createdAt).toLocaleString()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Total Recipients:</span>
                            <span className="ml-2 font-medium">{job.totalRecipients}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Emails Sent:</span>
                            <span className="ml-2 font-medium text-green-600">{job.emailsSent}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Emails Failed:</span>
                            <span className="ml-2 font-medium text-red-600">{job.emailsFailed}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Wait Time:</span>
                            <span className="ml-2 font-medium">{job.waitTimeSeconds}s</span>
                          </div>
                        </div>

                        {job.status === 'in_progress' && (
                          <div className="mt-4">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span>Progress</span>
                              <span>{Math.round((job.emailsSent / job.totalRecipients) * 100)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                              <div
                                className="bg-blue-600 h-2.5 rounded-full transition-all"
                                style={{ width: `${(job.emailsSent / job.totalRecipients) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        )}

                        {job.errorMessage && (
                          <Alert variant="destructive">
                            <XCircle className="h-4 w-4" />
                            <AlertDescription>{job.errorMessage}</AlertDescription>
                          </Alert>
                        )}

                        {(job.status === 'pending' || job.status === 'in_progress') && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => cancelJobMutation.mutate(job.id)}
                            disabled={cancelJobMutation.isPending}
                          >
                            Cancel Job
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
