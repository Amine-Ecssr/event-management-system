# Email Config Refactoring Guide

## Overview

The EmailConfig component has been refactored into smaller, reusable components to improve maintainability and reduce complexity.

## New Components Created

### 1. `EmailProviderConfig.tsx`
Handles email provider settings (Resend/SMTP configuration)
- Email enable/disable toggle
- Email language selection  
- Provider selection (Resend vs SMTP)
- API key or SMTP credentials input
- From email/name settings
- Test email functionality

### 2. `EmailRecipientsConfig.tsx`
Manages email recipient lists
- Primary recipients
- Management summary recipients
- Management summary enable/disable toggle

### 3. `EmailCCListsConfig.tsx`
Handles CC list configuration
- Global CC list
- Stakeholder-specific CC list
- Reminder-specific CC list
- Management summary CC list

### 4. `EmailStylingControls.tsx`
Reusable component for email styling options
- Brand color picker
- Text color picker
- Background color picker
- Font family selector
- Font size selector

### 5. `EmailTemplatePreview.tsx`
Preview component for email templates
- Subject line preview
- Body preview with HTML rendering
- Requirements section preview
- Footer preview
- Test email functionality

### 6. `emailTemplateHelpers.ts`
Utility functions for email templates
- `SAMPLE_EVENT` - Sample event data for previews
- `SAMPLE_REQUIREMENTS` - Sample requirements for previews
- `replaceVariables()` - Replace template variables with sample data
- `generatePreviewHtml()` - Generate preview HTML for email body
- `generateRequirementsPreviewHtml()` - Generate requirements section HTML
- `generateFooterPreviewHtml()` - Generate footer HTML

### 7. `use-email-config.ts`
Custom hook for managing email configuration state
- Centralized state management
- Settings fetching and syncing
- Save mutations
- Test email mutations

## How to Use the Refactored Components

### Example: Refactoring the Provider Tab

**Before (inline in EmailConfig.tsx):**
```tsx
<TabsContent value="provider" className="space-y-6">
  <Card>
    <CardHeader>
      <CardTitle>Email Provider</CardTitle>
      // ... 300+ lines of code
    </CardHeader>
  </Card>
</TabsContent>
```

**After (using new components):**
```tsx
import { 
  EmailProviderConfig, 
  EmailRecipientsConfig, 
  EmailCCListsConfig 
} from '@/components/email';
import { useEmailConfig } from '@/hooks/use-email-config';

export default function EmailConfig() {
  const config = useEmailConfig();
  const [activeTab, setActiveTab] = useState('provider');
  
  return (
    <div className="p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="provider">Provider & Settings</TabsTrigger>
          // ... other tabs
        </TabsList>
        
        <TabsContent value="provider" className="space-y-6">
          <EmailProviderConfig
            emailEnabled={config.emailEnabled}
            setEmailEnabled={config.setEmailEnabled}
            emailLanguage={config.emailLanguage}
            setEmailLanguage={config.setEmailLanguage}
            emailProvider={config.emailProvider}
            setEmailProvider={config.setEmailProvider}
            emailApiKey={config.emailApiKey}
            setEmailApiKey={config.setEmailApiKey}
            smtpHost={config.smtpHost}
            setSmtpHost={config.setSmtpHost}
            smtpPort={config.smtpPort}
            setSmtpPort={config.setSmtpPort}
            smtpSecure={config.smtpSecure}
            setSmtpSecure={config.setSmtpSecure}
            smtpUser={config.smtpUser}
            setSmtpUser={config.setSmtpUser}
            smtpPassword={config.smtpPassword}
            setSmtpPassword={config.setSmtpPassword}
            emailFromEmail={config.emailFromEmail}
            setEmailFromEmail={config.setEmailFromEmail}
            emailFromName={config.emailFromName}
            setEmailFromName={config.setEmailFromName}
            testEmailRecipient={config.testEmailRecipient}
            setTestEmailRecipient={config.setTestEmailRecipient}
            onSendTestEmail={config.handleSendTestEmail}
            isTestEmailPending={config.testEmailMutation.isPending}
          />
          
          <EmailRecipientsConfig
            emailRecipients={config.emailRecipients}
            setEmailRecipients={config.setEmailRecipients}
            managementSummaryEnabled={config.managementSummaryEnabled}
            setManagementSummaryEnabled={config.setManagementSummaryEnabled}
            managementSummaryRecipients={config.managementSummaryRecipients}
            setManagementSummaryRecipients={config.setManagementSummaryRecipients}
          />
          
          <EmailCCListsConfig
            globalCcList={config.globalCcList}
            setGlobalCcList={config.setGlobalCcList}
            stakeholderCcList={config.stakeholderCcList}
            setStakeholderCcList={config.setStakeholderCcList}
            reminderCcList={config.reminderCcList}
            setReminderCcList={config.setReminderCcList}
            managementSummaryCcList={config.managementSummaryCcList}
            setManagementSummaryCcList={config.setManagementSummaryCcList}
          />
          
          <div className="flex justify-end">
            <Button
              onClick={config.handleSaveProviderSettings}
              disabled={config.saveSettingsMutation.isPending}
              className="gap-2"
              size="lg"
            >
              <Save className="h-4 w-4" />
              {config.saveSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

## Benefits of Refactoring

1. **Reduced Complexity**: Main component went from 3000+ lines to ~200 lines
2. **Reusability**: Components can be used in other parts of the application
3. **Testability**: Each component can be tested independently
4. **Maintainability**: Easier to find and fix bugs in smaller components
5. **Type Safety**: Better TypeScript support with explicit prop types
6. **Separation of Concerns**: Logic, state, and UI are properly separated

## Migration Path

1. ✅ Create all new sub-components (Done)
2. ✅ Create custom hook for state management (Done)
3. ✅ Create helper utilities (Done)
4. ⏳ Refactor Provider tab (In Progress)
5. ⏳ Refactor Stakeholder tab
6. ⏳ Refactor Reminder tab
7. ⏳ Refactor Management Summary tab
8. ⏳ Remove old code
9. ⏳ Add tests for new components

## Files Created

- `/client/src/components/email/EmailProviderConfig.tsx`
- `/client/src/components/email/EmailRecipientsConfig.tsx`
- `/client/src/components/email/EmailCCListsConfig.tsx`
- `/client/src/components/email/EmailStylingControls.tsx`
- `/client/src/components/email/EmailTemplatePreview.tsx`
- `/client/src/components/email/emailTemplateHelpers.ts`
- `/client/src/components/email/index.ts`
- `/client/src/hooks/use-email-config.ts`

## Next Steps

To complete the refactoring:

1. Create template editor components for Stakeholder, Reminder, and Management Summary tabs
2. Update the main EmailConfig.tsx to use all new components
3. Test thoroughly to ensure all functionality works
4. Remove backup file once confirmed working
5. Add unit tests for new components

## Backup

Original file backed up at: `/client/src/pages/EmailConfig.tsx.backup`
