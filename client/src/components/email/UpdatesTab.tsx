import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Palette, ChevronDown, Info, Eye, Save } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useTranslation } from 'react-i18next';
import { EmailPreviewModal } from './EmailPreviewModal';
import { useState } from 'react';

interface UpdatesTabProps {
  updatesEmailTemplate: string;
  setUpdatesEmailTemplate: (value: string) => void;
  updatesEmailTemplateAr: string;
  setUpdatesEmailTemplateAr: (value: string) => void;
  
  // Styling props
  updatesBrandColor: string;
  setUpdatesBrandColor: (value: string) => void;
  updatesTextColor: string;
  setUpdatesTextColor: (value: string) => void;
  updatesBgColor: string;
  setUpdatesBgColor: (value: string) => void;
  updatesFontFamily: string;
  setUpdatesFontFamily: (value: string) => void;
  updatesFontSize: string;
  setUpdatesFontSize: (value: string) => void;
  
  updatesStylingOpen: boolean;
  setUpdatesStylingOpen: (value: boolean) => void;
  
  updatesQuillRef: any;
  updatesQuillRefAr: any;
  
  handleSaveUpdatesTemplate: () => void;
  saveSettingsMutation: any;
  
  FONT_FAMILIES: Array<{ value: string; label: string }>;
  FONT_SIZES: string[];
  
  insertVariable: (editorRef: any, variable: string) => void;
  replaceVariables?: (template: string, sampleData: any) => string;
}

export default function UpdatesTab({
  updatesEmailTemplate,
  setUpdatesEmailTemplate,
  updatesEmailTemplateAr,
  setUpdatesEmailTemplateAr,
  updatesBrandColor,
  setUpdatesBrandColor,
  updatesTextColor,
  setUpdatesTextColor,
  updatesBgColor,
  setUpdatesBgColor,
  updatesFontFamily,
  setUpdatesFontFamily,
  updatesFontSize,
  setUpdatesFontSize,
  updatesStylingOpen,
  setUpdatesStylingOpen,
  updatesQuillRef,
  updatesQuillRefAr,
  handleSaveUpdatesTemplate,
  saveSettingsMutation,
  FONT_FAMILIES,
  FONT_SIZES,
  insertVariable,
}: UpdatesTabProps) {
  const { t } = useTranslation();
  const [previewOpen, setPreviewOpen] = useState(false);

  const UPDATES_VARIABLES = [
    { key: '{{updates}}', description: 'All department updates formatted as sections' },
    { key: '{{period_label}}', description: 'The formatted date range (e.g. Nov 17, 2025 - Nov 23, 2025)' },
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('updates.title')} Email Template</CardTitle>
          <CardDescription>
            Customize the email template for sending department updates digests. Use the variables below to control where the updates and the period label appear.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Template Variables */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Available Variable</AlertTitle>
            <AlertDescription>
              <div className="mt-2 space-y-1">
                {UPDATES_VARIABLES.map((variable) => (
                  <div key={variable.key} className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {variable.key}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{variable.description}</span>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>

          {/* English Template */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>English Template</Label>
              <div className="flex gap-2">
                {UPDATES_VARIABLES.map((variable) => (
                  <Button
                    key={variable.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertVariable(updatesQuillRef, variable.key)}
                  >
                    {variable.key}
                  </Button>
                ))}
              </div>
            </div>
            <ReactQuill
              ref={updatesQuillRef}
              value={updatesEmailTemplate}
              onChange={setUpdatesEmailTemplate}
              theme="snow"
              modules={{
                toolbar: [
                  [{ header: [1, 2, 3, false] }],
                  ['bold', 'italic', 'underline'],
                  [{ list: 'ordered' }, { list: 'bullet' }],
                  [{ align: [] }],
                  ['link'],
                  ['clean'],
                ],
              }}
            />
            <p className="text-xs text-muted-foreground">
              This template wraps the updates content. Use {'{{updates}}'} for the sections and {'{{period_label}}'} to show the covered date range.
            </p>
          </div>

          {/* Arabic Template */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Arabic Template / قالب عربي</Label>
              <div className="flex gap-2">
                {UPDATES_VARIABLES.map((variable) => (
                  <Button
                    key={variable.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertVariable(updatesQuillRefAr, variable.key)}
                  >
                    {variable.key}
                  </Button>
                ))}
              </div>
            </div>
            <ReactQuill
              ref={updatesQuillRefAr}
              value={updatesEmailTemplateAr}
              onChange={setUpdatesEmailTemplateAr}
              theme="snow"
              modules={{
                toolbar: [
                  [{ header: [1, 2, 3, false] }],
                  ['bold', 'italic', 'underline'],
                  [{ list: 'ordered' }, { list: 'bullet' }],
                  [{ align: [] }],
                  ['link'],
                  ['clean'],
                ],
              }}
            />
            <p className="text-xs text-muted-foreground" dir="rtl">
              يغلف هذا القالب محتوى المستجدات. استخدم {'{{updates}}'} للأقسام و {'{{period_label}}'} لعرض نطاق التواريخ.
            </p>
          </div>

          <Separator />

          {/* Styling Section */}
          <Collapsible open={updatesStylingOpen} onOpenChange={setUpdatesStylingOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Email Styling & Colors
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${updatesStylingOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Brand Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={updatesBrandColor}
                      onChange={(e) => setUpdatesBrandColor(e.target.value)}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={updatesBrandColor}
                      onChange={(e) => setUpdatesBrandColor(e.target.value)}
                      placeholder="#BC9F6D"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Text Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={updatesTextColor}
                      onChange={(e) => setUpdatesTextColor(e.target.value)}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={updatesTextColor}
                      onChange={(e) => setUpdatesTextColor(e.target.value)}
                      placeholder="#333333"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Background Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={updatesBgColor}
                      onChange={(e) => setUpdatesBgColor(e.target.value)}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={updatesBgColor}
                      onChange={(e) => setUpdatesBgColor(e.target.value)}
                      placeholder="#FFFFFF"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Font Size</Label>
                  <Select value={updatesFontSize} onValueChange={setUpdatesFontSize}>
                    <SelectTrigger>
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

                <div className="space-y-2 col-span-2">
                  <Label>Font Family</Label>
                  <Select value={updatesFontFamily} onValueChange={setUpdatesFontFamily}>
                    <SelectTrigger>
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
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="w-4 h-4 me-2" />
            Preview
          </Button>
          <Button 
            onClick={handleSaveUpdatesTemplate}
            disabled={saveSettingsMutation.isPending}
          >
            <Save className="w-4 h-4 me-2" />
            {saveSettingsMutation.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </CardFooter>
      </Card>

      <EmailPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        templateType="updates"
      />
    </>
  );
}
