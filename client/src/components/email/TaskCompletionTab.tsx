import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, Palette, Save, Info, CheckCircle2, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useState } from 'react';
import { EmailPreviewModal } from './EmailPreviewModal';

interface TaskCompletionTabProps {
  emailLanguage: 'en' | 'ar';
  taskCompletionSubject: string;
  setTaskCompletionSubject: (value: string) => void;
  taskCompletionBody: string;
  setTaskCompletionBody: (value: string) => void;
  taskCompletionBrandColor: string;
  setTaskCompletionBrandColor: (value: string) => void;
  taskCompletionTextColor: string;
  setTaskCompletionTextColor: (value: string) => void;
  taskCompletionBgColor: string;
  setTaskCompletionBgColor: (value: string) => void;
  taskCompletionFontFamily: string;
  setTaskCompletionFontFamily: (value: string) => void;
  taskCompletionFontSize: string;
  setTaskCompletionFontSize: (value: string) => void;
  taskCompletionFooter: string;
  setTaskCompletionFooter: (value: string) => void;
  taskCompletionFooterBrandColor: string;
  setTaskCompletionFooterBrandColor: (value: string) => void;
  taskCompletionFooterTextColor: string;
  setTaskCompletionFooterTextColor: (value: string) => void;
  taskCompletionFooterBgColor: string;
  setTaskCompletionFooterBgColor: (value: string) => void;
  taskCompletionFooterFontFamily: string;
  setTaskCompletionFooterFontFamily: (value: string) => void;
  taskCompletionFooterFontSize: string;
  setTaskCompletionFooterFontSize: (value: string) => void;
  taskCompletionStylingOpen: boolean;
  setTaskCompletionStylingOpen: (value: boolean) => void;
  taskCompletionFooterStylingOpen: boolean;
  setTaskCompletionFooterStylingOpen: (value: boolean) => void;
  taskCompletionQuillRef: any;
  taskCompletionFooterQuillRef: any;
  handleSaveTaskCompletionTemplate: () => void;
  saveSettingsMutation: any;
  FONT_FAMILIES: Array<{ value: string; label: string }>;
  FONT_SIZES: string[];
  insertVariable: (variable: string, quillRef: any) => void;
  replaceVariables: (template: string) => string;
}

export default function TaskCompletionTab(props: TaskCompletionTabProps) {
  const { t } = useTranslation();
  const {
    emailLanguage,
    taskCompletionSubject,
    setTaskCompletionSubject,
    taskCompletionBody,
    setTaskCompletionBody,
    taskCompletionBrandColor,
    setTaskCompletionBrandColor,
    taskCompletionTextColor,
    setTaskCompletionTextColor,
    taskCompletionBgColor,
    setTaskCompletionBgColor,
    taskCompletionFontFamily,
    setTaskCompletionFontFamily,
    taskCompletionFontSize,
    setTaskCompletionFontSize,
    taskCompletionFooter,
    setTaskCompletionFooter,
    taskCompletionFooterBrandColor,
    setTaskCompletionFooterBrandColor,
    taskCompletionFooterTextColor,
    setTaskCompletionFooterTextColor,
    taskCompletionFooterBgColor,
    setTaskCompletionFooterBgColor,
    taskCompletionFooterFontFamily,
    setTaskCompletionFooterFontFamily,
    taskCompletionFooterFontSize,
    setTaskCompletionFooterFontSize,
    taskCompletionStylingOpen,
    setTaskCompletionStylingOpen,
    taskCompletionFooterStylingOpen,
    setTaskCompletionFooterStylingOpen,
    taskCompletionQuillRef,
    taskCompletionFooterQuillRef,
    handleSaveTaskCompletionTemplate,
    saveSettingsMutation,
    FONT_FAMILIES,
    FONT_SIZES,
    insertVariable,
    replaceVariables,
  } = props;

  // State for preview modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Task completion specific template variables
  const TASK_TEMPLATE_VARIABLES = [
    { key: '{{taskTitle}}', description: 'Task title' },
    { key: '{{eventName}}', description: 'Event name' },
    { key: '{{taskDescription}}', description: 'Task description (optional)' },
    { key: '{{completedByStakeholder}}', description: 'Name of stakeholder who completed the task' },
    { key: '{{startDate}}', description: 'Event start date' },
    { key: '{{endDate}}', description: 'Event end date' },
  ];

  return (
    <div className="space-y-6">
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Task Completion Notifications</AlertTitle>
        <AlertDescription>
          These emails are automatically sent to configured recipients when a task is marked as completed.
          Recipients are configured on a per-task basis in the task settings (notificationEmails field).
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Task Completion Email Template {emailLanguage === 'ar' && '(Arabic)'}
          </CardTitle>
          <CardDescription>
            Customize the email sent when a task is marked as complete
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Subject Line */}
          <div className="space-y-2">
            <Label htmlFor="taskCompletionSubject">Email Subject</Label>
            <Input
              id="taskCompletionSubject"
              value={taskCompletionSubject}
              onChange={(e) => setTaskCompletionSubject(e.target.value)}
              placeholder="Task Completed: {{taskTitle}} - {{eventName}}"
              dir={emailLanguage === 'ar' ? 'rtl' : 'ltr'}
              style={{ textAlign: emailLanguage === 'ar' ? 'right' : 'left' }}
            />
            <p className="text-sm text-muted-foreground">
              Available variables: {TASK_TEMPLATE_VARIABLES.map(v => v.key).join(', ')}
            </p>
          </div>

          {/* Body/Intro Text */}
          <div className="space-y-2">
            <Label htmlFor="taskCompletionBody">Email Introduction Text</Label>
            <div className="border rounded-md" dir={emailLanguage === 'ar' ? 'rtl' : 'ltr'}>
              <ReactQuill
                ref={taskCompletionQuillRef}
                theme="snow"
                value={taskCompletionBody}
                onChange={setTaskCompletionBody}
                placeholder="Dear Team,..."
              />
            </div>
            <p className="text-sm text-muted-foreground">
              This text appears before the task details. Use variables like {'{{'}{'}'}taskTitle{'}'}{'}'}, {'{{'}{'}'}eventName{'}'}{'}'}, etc.
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {TASK_TEMPLATE_VARIABLES.map((variable) => (
                <Badge
                  key={variable.key}
                  variant="outline"
                  className="cursor-pointer hover:bg-secondary"
                  onClick={() => insertVariable(variable.key, taskCompletionQuillRef)}
                >
                  {variable.key}
                </Badge>
              ))}
            </div>
          </div>

          {/* Email Styling */}
          <Collapsible open={taskCompletionStylingOpen} onOpenChange={setTaskCompletionStylingOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Email Styling
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${taskCompletionStylingOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="taskCompletionBrandColor">Brand Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="taskCompletionBrandColor"
                      type="color"
                      value={taskCompletionBrandColor}
                      onChange={(e) => setTaskCompletionBrandColor(e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={taskCompletionBrandColor}
                      onChange={(e) => setTaskCompletionBrandColor(e.target.value)}
                      placeholder="#BC9F6D"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taskCompletionTextColor">Text Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="taskCompletionTextColor"
                      type="color"
                      value={taskCompletionTextColor}
                      onChange={(e) => setTaskCompletionTextColor(e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={taskCompletionTextColor}
                      onChange={(e) => setTaskCompletionTextColor(e.target.value)}
                      placeholder="#333333"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taskCompletionBgColor">Background Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="taskCompletionBgColor"
                      type="color"
                      value={taskCompletionBgColor}
                      onChange={(e) => setTaskCompletionBgColor(e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={taskCompletionBgColor}
                      onChange={(e) => setTaskCompletionBgColor(e.target.value)}
                      placeholder="#FFFFFF"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taskCompletionFontFamily">Font Family</Label>
                  <Select value={taskCompletionFontFamily} onValueChange={setTaskCompletionFontFamily}>
                    <SelectTrigger id="taskCompletionFontFamily">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_FAMILIES.map((font) => (
                        <SelectItem key={font.value} value={font.value}>
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taskCompletionFontSize">Font Size</Label>
                  <Select value={taskCompletionFontSize} onValueChange={setTaskCompletionFontSize}>
                    <SelectTrigger id="taskCompletionFontSize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_SIZES.map((size) => (
                        <SelectItem key={size} value={size}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Footer */}
          <div className="space-y-2">
            <Label htmlFor="taskCompletionFooter">Email Footer</Label>
            <div className="border rounded-md" dir={emailLanguage === 'ar' ? 'rtl' : 'ltr'}>
              <ReactQuill
                ref={taskCompletionFooterQuillRef}
                theme="snow"
                value={taskCompletionFooter}
                onChange={setTaskCompletionFooter}
                placeholder="Best regards,..."
              />
            </div>
          </div>

          {/* Footer Styling */}
          <Collapsible open={taskCompletionFooterStylingOpen} onOpenChange={setTaskCompletionFooterStylingOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Footer Styling
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${taskCompletionFooterStylingOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="taskCompletionFooterBrandColor">Footer Brand Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="taskCompletionFooterBrandColor"
                      type="color"
                      value={taskCompletionFooterBrandColor}
                      onChange={(e) => setTaskCompletionFooterBrandColor(e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={taskCompletionFooterBrandColor}
                      onChange={(e) => setTaskCompletionFooterBrandColor(e.target.value)}
                      placeholder="#BC9F6D"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taskCompletionFooterTextColor">Footer Text Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="taskCompletionFooterTextColor"
                      type="color"
                      value={taskCompletionFooterTextColor}
                      onChange={(e) => setTaskCompletionFooterTextColor(e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={taskCompletionFooterTextColor}
                      onChange={(e) => setTaskCompletionFooterTextColor(e.target.value)}
                      placeholder="#666666"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taskCompletionFooterBgColor">Footer Background Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="taskCompletionFooterBgColor"
                      type="color"
                      value={taskCompletionFooterBgColor}
                      onChange={(e) => setTaskCompletionFooterBgColor(e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={taskCompletionFooterBgColor}
                      onChange={(e) => setTaskCompletionFooterBgColor(e.target.value)}
                      placeholder="#FFFFFF"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taskCompletionFooterFontFamily">Footer Font Family</Label>
                  <Select value={taskCompletionFooterFontFamily} onValueChange={setTaskCompletionFooterFontFamily}>
                    <SelectTrigger id="taskCompletionFooterFontFamily">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_FAMILIES.map((font) => (
                        <SelectItem key={font.value} value={font.value}>
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taskCompletionFooterFontSize">Footer Font Size</Label>
                  <Select value={taskCompletionFooterFontSize} onValueChange={setTaskCompletionFooterFontSize}>
                    <SelectTrigger id="taskCompletionFooterFontSize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_SIZES.map((size) => (
                        <SelectItem key={size} value={size}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button 
            onClick={() => setPreviewModalOpen(true)}
            variant="outline"
            className="flex-1"
          >
            <Eye className="mr-2 h-4 w-4" />
            Preview Email
          </Button>
          <Button 
            onClick={handleSaveTaskCompletionTemplate}
            disabled={saveSettingsMutation.isPending}
            className="flex-1"
          >
            <Save className="mr-2 h-4 w-4" />
            Save Task Completion Template
          </Button>
        </CardFooter>
      </Card>

      <EmailPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        templateType="taskCompletion"
      />
    </div>
  );
}
