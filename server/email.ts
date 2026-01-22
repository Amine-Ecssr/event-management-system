import type { Event, Stakeholder, StakeholderRequirement, Task, Update, Contact, EmailTemplate } from '@shared/schema';
import type { AppSettings } from './services/configService';
import { addDays, format, startOfWeek } from 'date-fns';
import { createEmailProvider } from './emailProvider';
import { getCombinedCcList, replaceTemplateVariables } from './email-helpers';
import { renderTaskList, renderRequirementsSection } from './email-renderers';
import {
  generateStakeholderPreview,
  generateReminderPreview,
  generateManagementPreview,
  generateTaskCompletionPreview,
} from './email-previews';
import { formatUpdatePeriodLabel, type UpdateSection } from './updates-formatter';
import { generateIcsFile, getIcsBuffer } from './icsGenerator';
import { storage } from './storage';

export class EmailService {
  private buildIcsAttachment(event: Event) {
    const { filename } = generateIcsFile(event);
    const content = getIcsBuffer(event);

    return {
      filename,
      content,
      contentType: 'text/calendar',
    };
  }

  /**
   * Send an email notification about an event (generic reminder)
   */
  async sendEventNotification(
    event: Event,
    toEmail: string,
    settings: AppSettings,
    prefix?: string
  ): Promise<void> {
    if (!settings.emailFromEmail) {
      throw new Error('Email from address is required');
    }

    const provider = createEmailProvider(settings);
    const { subject, html } = this.formatEventEmail(event, settings, prefix);
    const fromName = settings.emailFromName || 'ECSSR Events';
    
    // Combine reminder CC + global CC
    const ccList = getCombinedCcList(settings.reminderCcList, settings.globalCcList);
    
    try {
      await provider.send({
        from: `${fromName} <${settings.emailFromEmail}>`,
        to: toEmail,
        cc: ccList.length > 0 ? ccList : undefined,
        subject,
        html,
        attachments: [this.buildIcsAttachment(event)],
      });
      
      console.log(`Reminder email sent to ${toEmail} with ${ccList.length} CCs`);
    } catch (error) {
      console.error('Failed to send reminder email:', error);
      throw new Error(`Failed to send reminder email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format an event into an HTML email using templates (for reminder emails)
   */
  formatEventEmail(
    event: Event,
    settings: AppSettings,
    prefix?: string
  ): { subject: string; html: string } {
    // Determine language from global settings
    const language = settings.emailLanguage || 'en';
    const isArabic = language === 'ar';
    
    // Get templates from settings based on language or use defaults
    const subjectTemplate = isArabic
      ? (settings.reminderSubjectAr || settings.emailSubjectTemplate || 'تذكير بالفعالية: {{eventName}}')
      : (settings.reminderSubject || settings.emailSubjectTemplate || 'Event Reminder: {{eventName}}');
    const bodyTemplate = isArabic
      ? (settings.reminderBodyAr || settings.emailBodyTemplate || '<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>التاريخ:</strong> {{startDate}} - {{endDate}}</p>')
      : (settings.reminderBody || settings.emailBodyTemplate || `
      <h1>{{eventName}}</h1>
      <p>{{description}}</p>
      <p><strong>Date:</strong> {{startDate}} - {{endDate}}</p>
      <p><strong>Location:</strong> {{location}}</p>
      <p><strong>Organizers:</strong> {{organizers}}</p>
      <p><strong>Category:</strong> {{category}}</p>
      <p><strong>Type:</strong> {{eventType}}</p>
      <p><strong>Expected Attendance:</strong> {{expectedAttendance}}</p>
      <p><a href="{{url}}">More Information</a></p>
    `);
    
    // Get styling from settings or use defaults
    const brandColor = settings.reminderBrandColor || '#BC9F6D';
    const textColor = settings.reminderTextColor || '#333333';
    const bgColor = settings.reminderBgColor || '#FFFFFF';
    const fontFamily = settings.reminderFontFamily || 'Arial, sans-serif';
    const fontSize = settings.reminderFontSize || '16px';
    
    const footerBrandColor = settings.reminderFooterBrandColor || '#BC9F6D';
    const footerTextColor = settings.reminderFooterTextColor || '#666666';
    const footerBgColor = settings.reminderFooterBgColor || '#FFFFFF';
    const footerFontFamily = settings.reminderFooterFontFamily || 'Arial, sans-serif';
    const footerFontSize = settings.reminderFooterFontSize || '14px';
    
    const footerTemplate = isArabic
      ? (settings.reminderFooterAr || '<p>مع أطيب التحيات،<br/>فريق فعاليات المركز</p>')
      : (settings.reminderFooter || '<p>Best regards,<br/>ECSSR Events Team</p>');
    
    // RTL support - automatically enable for Arabic
    const isRtl = isArabic || settings.reminderEmailRtl || false;
    const dir = isRtl ? 'rtl' : 'ltr';
    const textAlign = isRtl ? 'right' : 'left';
    
    // Replace all placeholders in subject
    let subject = replaceTemplateVariables(String(subjectTemplate || ''), event, undefined, undefined, isArabic);
    
    // Add prefix if provided
    if (prefix) {
      subject = prefix + subject;
    }
    
    // Replace all placeholders in body
    let customMessageHtml = replaceTemplateVariables(String(bodyTemplate || ''), event, undefined, undefined, isArabic);
    
    // Handle {{requirements}} placeholder gracefully
    // Reminder emails don't have requirements data, so we remove the placeholder if present
    if (customMessageHtml.includes('{{requirements}}')) {
      customMessageHtml = customMessageHtml.replace(/\{\{requirements\}\}/g, '');
    }
    
    // Replace placeholders in footer
    const footerHtml = replaceTemplateVariables(String(footerTemplate || ''), event, undefined, undefined, isArabic);
    
    // Build complete HTML with styling and RTL support
    const html = `
<!DOCTYPE html>
<html dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="background-color: ${bgColor}; font-family: ${fontFamily}; font-size: ${fontSize}; color: ${textColor}; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; direction: ${isRtl ? 'rtl' : 'ltr'}; text-align: ${textAlign};">
  <!-- CUSTOM MESSAGE SECTION -->
  <div>
    ${customMessageHtml}
  </div>
  
  <!-- FOOTER SECTION -->
  <div style="background-color: ${footerBgColor}; color: ${footerTextColor}; font-family: ${footerFontFamily}; font-size: ${footerFontSize}; margin-top: 32px; padding: 16px; border-top: 1px solid #E0E0E0;">
    ${footerHtml}
  </div>
</body>
</html>
    `;
    
    return { subject, html };
  }

  /**
   * Send stakeholder notification email for an event
   */
  async sendStakeholderNotification(
    event: Event,
    stakeholder: Stakeholder,
    emails: string[],
    selectedRequirements: StakeholderRequirement[],
    customRequirements: string,
    settings: AppSettings,
    tasks: Task[] = []
  ): Promise<void> {
    if (!settings.emailFromEmail) {
      throw new Error('Email from address is required');
    }

    const provider = createEmailProvider(settings);
    const fromName = settings.emailFromName || 'ECSSR Events';
    
    // Determine language from global settings
    const language = settings.emailLanguage || 'en';
    const isArabic = language === 'ar';
    
    // Get templates from settings based on language
    const subjectTemplate = isArabic 
      ? (settings.stakeholderSubjectAr || 'فعالية جديدة: {{eventName}}')
      : (settings.stakeholderSubject || 'New Event: {{eventName}}');
    const bodyTemplate = isArabic
      ? (settings.stakeholderBodyAr || '<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>التاريخ:</strong> {{startDate}} - {{endDate}}</p><p><strong>الموقع:</strong> {{location}}</p>')
      : (settings.stakeholderBody || '<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>Date:</strong> {{startDate}} - {{endDate}}</p><p><strong>Location:</strong> {{location}}</p>');
    const greetingTemplate = isArabic
      ? (settings.stakeholderGreetingAr || settings.stakeholderGreeting || 'عزيزي {{name}}')
      : (settings.stakeholderGreeting || 'Dear {{name}},');
    
    // Get styling from settings or use defaults
    const brandColor = settings.stakeholderBrandColor || '#BC9F6D';
    const textColor = settings.stakeholderTextColor || '#333333';
    const bgColor = settings.stakeholderBgColor || '#FFFFFF';
    const fontFamily = settings.stakeholderFontFamily || 'Arial, sans-serif';
    const fontSize = settings.stakeholderFontSize || '16px';
    
    const footerBrandColor = settings.stakeholderFooterBrandColor || '#BC9F6D';
    const footerTextColor = settings.stakeholderFooterTextColor || '#666666';
    const footerBgColor = settings.stakeholderFooterBgColor || '#FFFFFF';
    const footerFontFamily = settings.stakeholderFooterFontFamily || 'Arial, sans-serif';
    const footerFontSize = settings.stakeholderFooterFontSize || '14px';
    
    const footerTemplate = isArabic
      ? (settings.stakeholderFooterAr || '<p>مع أطيب التحيات،<br/>فريق فعاليات المركز</p>')
      : (settings.stakeholderFooter || '<p>Best regards,<br/>ECSSR Events Team</p>');
    
    // RTL support - automatically enable for Arabic
    const isRtl = isArabic || settings.stakeholderEmailRtl || false;
    const dir = isRtl ? 'rtl' : 'ltr';
    const textAlign = isRtl ? 'right' : 'left';
    
    // Replace template variables in subject (with stakeholder name)
    const subject = replaceTemplateVariables(String(subjectTemplate || ''), event, stakeholder, undefined, isArabic);
    
    // Build greeting with stakeholder name
    const greetingHtml = greetingTemplate 
      ? `<p>${replaceTemplateVariables(String(greetingTemplate), event, stakeholder, undefined, isArabic)}</p>`
      : '';
    
    // Replace template variables in custom message (with stakeholder name)
    let customMessageHtml = replaceTemplateVariables(String(bodyTemplate || ''), event, stakeholder, undefined, isArabic);
    
    // Filter tasks to show only incomplete ones (pending, in_progress)
    const incompleteTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
    
    // Build task list HTML
    const taskListHtml = incompleteTasks.length > 0 
      ? renderTaskList(incompleteTasks, settings, 'stakeholder')
      : '';
    
    // Build requirements section HTML
    let requirementsHtml = renderRequirementsSection(
      selectedRequirements,
      customRequirements,
      settings,
      'stakeholder',
      isArabic
    );
    
    // Handle {{requirements}} template variable
    const hasRequirementsPlaceholder = customMessageHtml.includes('{{requirements}}');
    if (hasRequirementsPlaceholder) {
      // Replace {{requirements}} with the actual requirements HTML
      customMessageHtml = customMessageHtml.replace(/\{\{requirements\}\}/g, requirementsHtml);
      requirementsHtml = ''; // Clear it so we don't append it again
    }
    
    // Replace template variables in footer
    const footerHtml = replaceTemplateVariables(String(footerTemplate || ''), event, stakeholder, undefined, isArabic);
    
    // Build complete HTML with styling and RTL support
    const html = `
<!DOCTYPE html>
<html dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="background-color: ${bgColor}; font-family: ${fontFamily}; font-size: ${fontSize}; color: ${textColor}; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; direction: ${isRtl ? 'rtl' : 'ltr'}; text-align: ${textAlign};">
  <!-- GREETING SECTION -->
  ${greetingHtml}
  
  <!-- CUSTOM MESSAGE SECTION -->
  <div>
    ${customMessageHtml}
  </div>
  
  <!-- TASK LIST SECTION -->
  ${taskListHtml}
  
  <!-- REQUIREMENTS SECTION (only if not embedded via {{requirements}}) -->
  ${requirementsHtml}
  
  <!-- FOOTER SECTION -->
  <div style="background-color: ${footerBgColor}; color: ${footerTextColor}; font-family: ${footerFontFamily}; font-size: ${footerFontSize}; margin-top: 32px; padding: 16px; border-top: 1px solid #E0E0E0;">
    ${footerHtml}
  </div>
</body>
</html>
    `;
    
    // Combine stakeholder-specific CC + global CC
    const ccList = getCombinedCcList(stakeholder.ccList || null, settings.globalCcList);
    
    try {
      await provider.send({
        from: `${fromName} <${settings.emailFromEmail}>`,
        to: emails,
        cc: ccList.length > 0 ? ccList : undefined,
        subject,
        html,
        attachments: [this.buildIcsAttachment(event)],
      });
      console.log(`Stakeholder notification sent to ${emails.join(', ')} with ${ccList.length} CCs for event ${event.name}`);
    } catch (error) {
      console.error('Failed to send stakeholder notification:', error);
      throw new Error(`Failed to send stakeholder notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send management summary email for an event
   * Includes full event details plus all stakeholder assignments and requirements
   */
  async sendManagementSummary(
    event: Event,
    stakeholderAssignments: Array<{
      stakeholder: Stakeholder;
      selectedRequirements: StakeholderRequirement[];
      customRequirements: string;
      emails: string[];
    }>,
    settings: AppSettings
  ): Promise<void> {
    if (!settings.managementSummaryEnabled || !settings.managementSummaryRecipients) {
      return; // Silently skip if not enabled or no recipients
    }

    if (!settings.emailFromEmail) {
      throw new Error('Email from address is required');
    }

    const provider = createEmailProvider(settings);
    const fromName = settings.emailFromName || 'ECSSR Events';
    
    // Determine language from global settings
    const language = settings.emailLanguage || 'en';
    const isArabic = language === 'ar';
    
    // Get templates from settings based on language or use defaults
    const subjectTemplate = isArabic
      ? (settings.managementSummarySubjectAr || settings.managementSummarySubjectTemplate || 'ملخص إداري: {{eventName}}')
      : (settings.managementSummarySubjectTemplate || 'Event Summary: {{eventName}}');
    const bodyTemplate = isArabic
      ? (settings.managementSummaryBodyAr || settings.managementSummaryBody || '<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>التاريخ:</strong> {{startDate}} - {{endDate}}</p><p><strong>العدد المتوقع للحضور:</strong> {{expectedAttendance}}</p>')
      : (settings.managementSummaryBody || '<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>Date:</strong> {{startDate}} - {{endDate}}</p><p><strong>Expected Attendance:</strong> {{expectedAttendance}}</p>');
    
    // Get styling from settings or use defaults
    const brandColor = settings.managementSummaryBrandColor || '#BC9F6D';
    const textColor = settings.managementSummaryTextColor || '#333333';
    const bgColor = settings.managementSummaryBgColor || '#FFFFFF';
    const fontFamily = settings.managementSummaryFontFamily || 'Arial, sans-serif';
    const fontSize = settings.managementSummaryFontSize || '16px';
    
    const reqBrandColor = settings.managementSummaryRequirementsBrandColor || '#BC9F6D';
    const reqTextColor = settings.managementSummaryRequirementsTextColor || '#333333';
    const reqBgColor = settings.managementSummaryRequirementsBgColor || '#F5F5F5';
    const reqFontFamily = settings.managementSummaryRequirementsFontFamily || 'Arial, sans-serif';
    const reqFontSize = settings.managementSummaryRequirementsFontSize || '16px';
    
    const footerBrandColor = settings.managementSummaryFooterBrandColor || '#BC9F6D';
    const footerTextColor = settings.managementSummaryFooterTextColor || '#666666';
    const footerBgColor = settings.managementSummaryFooterBgColor || '#FFFFFF';
    const footerFontFamily = settings.managementSummaryFooterFontFamily || 'Arial, sans-serif';
    const footerFontSize = settings.managementSummaryFooterFontSize || '14px';
    
    const footerTemplate = isArabic
      ? (settings.managementSummaryFooterAr || '<p>مع أطيب التحيات،<br/>إدارة المركز</p>')
      : (settings.managementSummaryFooter || '<p>Best regards,<br/>ECSSR Management</p>');
    
    // RTL support - automatically enable for Arabic
    const isRtl = isArabic || settings.managementSummaryEmailRtl || false;
    const dir = isRtl ? 'rtl' : 'ltr';
    const textAlign = isRtl ? 'right' : 'left';
    
    // Prepare data for greeting with stakeholder variables
    const stakeholderCount = stakeholderAssignments.length.toString();
    const stakeholderNames = stakeholderAssignments.map(a => a.stakeholder.name).join(', ');
    const additionalVars = {
      stakeholderCount,
      stakeholderNames,
    };
    
    // Replace template variables in subject
    const subject = replaceTemplateVariables(String(subjectTemplate || ''), event, undefined, additionalVars, isArabic);
    
    // Build greeting if template is provided
    let greetingHtml = '';
    const greetingTemplate = isArabic
      ? (settings.managementSummaryGreetingAr || settings.managementSummaryGreeting)
      : settings.managementSummaryGreeting;
    if (greetingTemplate) {
      greetingHtml = `<p>${replaceTemplateVariables(String(greetingTemplate), event, undefined, additionalVars, isArabic)}</p>`;
    }
    
    // Replace template variables in custom message
    let customMessageHtml = replaceTemplateVariables(String(bodyTemplate || ''), event, undefined, additionalVars, isArabic);
    
    // Build stakeholder assignments HTML with advanced customization (if enabled)
    let stakeholdersHtml = '';
    const includeRequirements = settings.managementSummaryIncludeRequirements !== false; // Default to true
    if (stakeholderAssignments.length > 0 && includeRequirements) {
      // Check if custom stakeholder template is provided
      const useCustomTemplate = !!settings.managementSummaryStakeholderTemplate;
      const separator = settings.managementSummaryStakeholderSeparator || '';
      
      if (useCustomTemplate) {
        // Use custom template for each stakeholder
        stakeholdersHtml = '<div>';
        stakeholderAssignments.forEach((assignment, index) => {
          const stakeholderName = isArabic
            ? (assignment.stakeholder.nameAr || assignment.stakeholder.name)
            : assignment.stakeholder.name;
          
          const requirementsListHtml = assignment.selectedRequirements
            .map((req, idx) => {
              const title = isArabic ? (req.titleAr || req.title) : req.title;
              const description = isArabic ? (req.descriptionAr || req.description) : req.description;
              return `<li>${title}${description ? `: ${description}` : ''}</li>`;
            })
            .join('');
          
          const requirementsHtml = requirementsListHtml 
            ? `<ul>${requirementsListHtml}</ul>`
            : '';
          
          let stakeholderHtml = String(settings.managementSummaryStakeholderTemplate || '');
          stakeholderHtml = stakeholderHtml
            .replace(/\{\{stakeholderName\}\}/g, stakeholderName)
            .replace(/\{\{requirements\}\}/g, requirementsHtml)
            .replace(/\{\{customRequirements\}\}/g, assignment.customRequirements || '');
          
          stakeholdersHtml += stakeholderHtml;
          
          if (separator && index < stakeholderAssignments.length - 1) {
            stakeholdersHtml += separator;
          }
        });
        stakeholdersHtml += '</div>';
      } else {
        // Use default template
        const stakeholderTitle = isArabic ? 'تكليفات الإدارات' : 'Department Assignments';
        stakeholdersHtml = `
          <div style="background-color: ${reqBgColor}; color: ${reqTextColor}; font-family: ${reqFontFamily}; font-size: ${reqFontSize}; margin-top: 24px; padding: 16px; border-radius: 4px;">
            <h2 style="color: ${reqBrandColor}; font-size: 18px; margin-bottom: 12px; margin-top: 0;">${stakeholderTitle}</h2>
        `;
        
        stakeholderAssignments.forEach((assignment, idx) => {
          const requirementsHtml = renderRequirementsSection(
            assignment.selectedRequirements,
            assignment.customRequirements,
            settings,
            'management',
            isArabic
          );
          
          const deptName = isArabic 
            ? (assignment.stakeholder.nameAr || assignment.stakeholder.name)
            : assignment.stakeholder.name;
          
          stakeholdersHtml += `
            <div style="margin-bottom: 16px; ${idx > 0 ? 'padding-top: 16px; border-top: 1px solid rgba(0,0,0,0.1);' : ''}">
              <h3 style="color: ${reqBrandColor}; font-size: 16px; margin-bottom: 8px; margin-top: 0;">${deptName}</h3>
              ${requirementsHtml}
            </div>
          `;
        });
        
        stakeholdersHtml += '</div>';
      }
    }
    
    // Handle {{requirements}} template variable
    const hasRequirementsPlaceholder = customMessageHtml.includes('{{requirements}}');
    if (hasRequirementsPlaceholder) {
      // Replace {{requirements}} with the actual stakeholder assignments HTML
      customMessageHtml = customMessageHtml.replace(/\{\{requirements\}\}/g, stakeholdersHtml);
      stakeholdersHtml = ''; // Clear it so we don't append it again
    }
    
    // Replace template variables in footer
    const footerHtml = replaceTemplateVariables(String(footerTemplate || ''), event, undefined, undefined, isArabic);
    
    // Build complete HTML with styling and RTL support
    const html = `
<!DOCTYPE html>
<html dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="background-color: ${bgColor}; font-family: ${fontFamily}; font-size: ${fontSize}; color: ${textColor}; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; direction: ${isRtl ? 'rtl' : 'ltr'}; text-align: ${textAlign};">
  <!-- GREETING SECTION -->
  ${greetingHtml}
  
  <!-- CUSTOM MESSAGE SECTION -->
  <div>
    ${customMessageHtml}
  </div>
  
  <!-- STAKEHOLDER ASSIGNMENTS SECTION (only if not embedded via {{requirements}}) -->
  ${stakeholdersHtml}
  
  <!-- FOOTER SECTION -->
  <div style="background-color: ${footerBgColor}; color: ${footerTextColor}; font-family: ${footerFontFamily}; font-size: ${footerFontSize}; margin-top: 32px; padding: 16px; border-top: 1px solid #E0E0E0;">
    ${footerHtml}
  </div>
</body>
</html>
    `;
    
    // Combine management summary CC + global CC
    const ccList = getCombinedCcList(settings.managementSummaryCcList, settings.globalCcList);
    
    // Parse recipients
    const recipients = String(settings.managementSummaryRecipients || '')
      .split(',')
      .map(e => e.trim())
      .filter(e => e);
    
    try {
      await provider.send({
        from: `${fromName} <${settings.emailFromEmail}>`,
        to: recipients,
        cc: ccList.length > 0 ? ccList : undefined,
        subject,
        html,
        attachments: [this.buildIcsAttachment(event)],
      });
      console.log(`Management summary sent to ${recipients.join(', ')} with ${ccList.length} CCs for event ${event.name}`);
    } catch (error) {
      console.error('Failed to send management summary:', error);
      throw new Error(`Failed to send management summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test email configuration by sending a test email
   */
  async testConnection(
    settings: AppSettings,
    toEmail: string
  ): Promise<void> {
    if (!settings.emailFromEmail) {
      throw new Error('Email from address is required');
    }

    const provider = createEmailProvider(settings);
    const fromName = settings.emailFromName || 'ECSSR Events';
    
    try {
      await provider.send({
        from: `${fromName} <${settings.emailFromEmail}>`,
        to: toEmail,
        subject: 'Test Email from ECSSR Events Calendar',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Email</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #BC9F6D;">Test Email</h1>
  <p>This is a test email from the ECSSR Events Calendar system.</p>
  <p>If you're receiving this email, your email configuration is working correctly!</p>
  <div style="margin-top: 32px; padding: 16px; background-color: #F5F5F5; border-radius: 4px;">
    <p style="margin: 0;"><strong>Configuration Details:</strong></p>
    <ul style="margin: 8px 0;">
      <li>Provider: ${settings.emailProvider}</li>
      <li>From: ${fromName} &lt;${settings.emailFromEmail}&gt;</li>
      <li>To: ${toEmail}</li>
    </ul>
  </div>
  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #E0E0E0; color: #666666; font-size: 14px;">
    <p>Best regards,<br/>ECSSR Events Team</p>
  </div>
</body>
</html>
        `,
      });
      console.log(`Test email sent successfully to ${toEmail}`);
    } catch (error) {
      console.error('Failed to send test email:', error);
      throw new Error(`Failed to send test email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Schedule and send daily reminders to stakeholders with pending tasks
   * Should be called periodically (e.g., every hour) by the scheduler
   */
  async scheduleStakeholderDailyReminders(storage: any): Promise<void> {
    try {
      const settings = await storage.getSettings();
      
      // Check if daily task reminders are enabled
      if (!settings.enableDailyTaskReminders) {
        console.log('Daily task reminders are disabled');
        return;
      }
      
      // Get all event departments with pending tasks
      const eventDepartmentsWithTasks = await storage.getEventDepartmentsWithPendingTasks();
      
      if (eventDepartmentsWithTasks.length === 0) {
        console.log('No pending tasks found for daily reminders');
        return;
      }
      
      const provider = createEmailProvider(settings);
      const fromName = settings.emailFromName || 'ECSSR Events';
      const language = settings.emailLanguage || 'en';
      const isArabic = language === 'ar';
      
      // Send reminder to each stakeholder with pending tasks
      for (const item of eventDepartmentsWithTasks) {
        const { stakeholder, event, tasks: pendingTasks, primaryEmail } = item;
        
        if (!primaryEmail) {
          console.log(`No email found for stakeholder ${stakeholder.id}, skipping daily reminder`);
          continue;
        }
        
        const subject = isArabic
          ? `تذكير يومي: لديك ${pendingTasks.length} مهمة معلقة`
          : `Daily Reminder: You have ${pendingTasks.length} pending task(s)`;
        
        // Build HTML email
        let tasksHtml = '';
        for (const task of pendingTasks) {
          const eventName = isArabic ? (event.nameAr || event.name) : event.name;
          const dueDate = task.dueDate ? format(new Date(task.dueDate), 'MMM dd, yyyy') : null;
          const taskTitle = isArabic ? (task.titleAr || task.title) : task.title;
          const taskDescription = isArabic ? (task.descriptionAr || task.description) : task.description;
          
          tasksHtml += `
            <div style="margin-bottom: 16px; padding: 12px; background-color: #F5F5F5; border-left: 4px solid #BC9F6D; border-radius: 4px;">
              <h3 style="margin: 0 0 8px 0; color: #BC9F6D;">${taskTitle}</h3>
              <p style="margin: 4px 0;"><strong>${isArabic ? 'الفعالية:' : 'Event:'}</strong> ${eventName}</p>
              ${taskDescription ? `<p style="margin: 4px 0;">${taskDescription}</p>` : ''}
              ${dueDate ? `<p style="margin: 4px 0; color: #EF4444;"><strong>${isArabic ? 'تاريخ الاستحقاق:' : 'Due:'}</strong> ${dueDate}</p>` : ''}
            </div>
          `;
        }
        
        const html = `
<!DOCTYPE html>
<html dir="${isArabic ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; direction: ${isArabic ? 'rtl' : 'ltr'};">
  <h1 style="color: #BC9F6D;">${subject}</h1>
  <p>${isArabic ? `عزيزي ${stakeholder.nameAr || stakeholder.name}،` : `Dear ${stakeholder.name},`}</p>
  <p>${isArabic ? 'لديك المهام التالية المعلقة:' : 'You have the following pending tasks:'}</p>
  ${tasksHtml}
  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #E0E0E0; color: #666666; font-size: 14px;">
    <p>${isArabic ? 'مع أطيب التحيات،<br/>فريق فعاليات المركز' : 'Best regards,<br/>ECSSR Events Team'}</p>
  </div>
</body>
</html>
        `;
        
        // Combine stakeholder CC + global CC
        const ccList = getCombinedCcList(stakeholder.ccList, settings.globalCcList);
        
        try {
          await provider.send({
            from: `${fromName} <${settings.emailFromEmail}>`,
            to: primaryEmail,
            cc: ccList.length > 0 ? ccList : undefined,
            subject,
            html,
          });
          
          // Update last reminder timestamp
          await storage.updateEventDepartmentLastReminder(item.eventDepartment.id);
          
          console.log(`Daily reminder sent to ${stakeholder.name} (${primaryEmail}): ${pendingTasks.length} tasks`);
        } catch (error) {
          console.error(`Failed to send daily reminder to ${stakeholder.name}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to send daily task reminders:', error);
    }
  }

  /**
   * Send task completion notification email
   * Notifies configured recipients when a task is marked as completed
   */
  async sendTaskCompletionNotification(params: {
    taskTitle: string;
    taskDescription: string | null;
    eventName: string;
    eventStartDate: string;
    eventEndDate: string;
    completedByStakeholder: string;
    recipients: string[];
    ccList?: string[];
    settings: AppSettings;
  }): Promise<void> {
    const { taskTitle, taskDescription, eventName, eventStartDate, eventEndDate, completedByStakeholder, recipients, ccList, settings } = params;
    
    if (!settings.emailFromEmail) {
      throw new Error('Email from address is required');
    }

    const provider = createEmailProvider(settings);
    const fromName = settings.emailFromName || 'ECSSR Events';
    
    // Format dates
    const startDate = format(new Date(eventStartDate), 'MMM dd, yyyy');
    const endDate = format(new Date(eventEndDate), 'MMM dd, yyyy');
    
    // Determine language
    const isArabic = settings.emailLanguage === 'ar';
    
    // Get template fields based on language
    const subjectTemplate = isArabic 
      ? (settings.taskCompletionSubjectAr || settings.taskCompletionSubject || 'Task Completed: {{taskTitle}} - {{eventName}}')
      : (settings.taskCompletionSubject || 'Task Completed: {{taskTitle}} - {{eventName}}');
    
    const bodyTemplate = isArabic
      ? (settings.taskCompletionBodyAr || settings.taskCompletionBody || '<p>Dear Team,</p><p>Kindly note that the following task has been marked as completed:</p>')
      : (settings.taskCompletionBody || '<p>Dear Team,</p><p>Kindly note that the following task has been marked as completed:</p>');
    
    const footerTemplate = isArabic
      ? (settings.taskCompletionFooterAr || settings.taskCompletionFooter || '<p>Best regards,<br/>ECSSR Events Team</p>')
      : (settings.taskCompletionFooter || '<p>Best regards,<br/>ECSSR Events Team</p>');
    
    // Build subject with template variables
    const subject = String(subjectTemplate || '')
      .replace(/\{\{taskTitle\}\}/g, taskTitle)
      .replace(/\{\{eventName\}\}/g, eventName);
    
    // Build body with template variables
    const bodyIntro = String(bodyTemplate || '')
      .replace(/\{\{taskTitle\}\}/g, taskTitle)
      .replace(/\{\{eventName\}\}/g, eventName);
    
    // Get styling from settings (use task completion specific or fallback to stakeholder)
    const brandColor = settings.taskCompletionBrandColor || settings.stakeholderBrandColor || '#BC9F6D';
    const textColor = settings.taskCompletionTextColor || settings.stakeholderTextColor || '#333333';
    const bgColor = settings.taskCompletionBgColor || settings.stakeholderBgColor || '#FFFFFF';
    const fontFamily = settings.taskCompletionFontFamily || settings.stakeholderFontFamily || 'Arial, sans-serif';
    const fontSize = settings.taskCompletionFontSize || settings.stakeholderFontSize || '16px';
    
    const footerBrandColor = settings.taskCompletionFooterBrandColor || settings.stakeholderFooterBrandColor || '#BC9F6D';
    const footerTextColor = settings.taskCompletionFooterTextColor || settings.stakeholderFooterTextColor || '#666666';
    const footerBgColor = settings.taskCompletionFooterBgColor || settings.stakeholderFooterBgColor || '#FFFFFF';
    const footerFontFamily = settings.taskCompletionFooterFontFamily || settings.stakeholderFooterFontFamily || 'Arial, sans-serif';
    const footerFontSize = settings.taskCompletionFooterFontSize || settings.stakeholderFooterFontSize || '14px';
    
    // RTL support
    const isRtl = settings.taskCompletionEmailRtl || false;
    const dir = isRtl ? 'rtl' : 'ltr';
    const textAlign = isRtl ? 'right' : 'left';
    
    // Localized labels
    const taskLabel = isArabic ? 'المهمة' : 'Task';
    const descriptionLabel = isArabic ? 'الوصف' : 'Description';
    const statusLabel = isArabic ? 'الحالة' : 'Status';
    const completedLabel = isArabic ? '✓ مكتملة' : '✓ Completed';
    const completedByLabel = isArabic ? 'أكملها' : 'Completed By';
    const eventDetailsLabel = isArabic ? 'تفاصيل الفعالية' : 'Event Details';
    const eventNameLabel = isArabic ? 'اسم الفعالية' : 'Event Name';
    const eventDatesLabel = isArabic ? 'تواريخ الفعالية' : 'Event Dates';
    const taskDetailsLabel = isArabic ? 'تفاصيل المهمة' : 'Task Details';
    
    // Build HTML email
    const html = `
<!DOCTYPE html>
<html dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="background-color: ${bgColor}; font-family: ${fontFamily}; font-size: ${fontSize}; color: ${textColor}; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; direction: ${dir}; text-align: ${textAlign};">
  <!-- GREETING/INTRO SECTION -->
  ${bodyIntro}
  
  <!-- TASK DETAILS SECTION -->
  <div style="background-color: #F5F5F5; padding: 16px; border-radius: 4px; margin: 20px 0; border-${isRtl ? 'right' : 'left'}: 4px solid ${brandColor};">
    <h2 style="color: ${brandColor}; font-size: 18px; margin-bottom: 12px; margin-top: 0;">${taskDetailsLabel}</h2>
    <p style="margin: 8px 0;"><strong>${taskLabel}:</strong> ${taskTitle}</p>
    ${taskDescription ? `<p style="margin: 8px 0;"><strong>${descriptionLabel}:</strong> ${taskDescription}</p>` : ''}
    <p style="margin: 8px 0;"><strong>${statusLabel}:</strong> <span style="color: #228B22;">${completedLabel}</span></p>
    <p style="margin: 8px 0;"><strong>${completedByLabel}:</strong> ${completedByStakeholder}</p>
  </div>
  
  <!-- EVENT DETAILS SECTION -->
  <div style="background-color: #F5F5F5; padding: 16px; border-radius: 4px; margin: 20px 0; border-${isRtl ? 'right' : 'left'}: 4px solid ${brandColor};">
    <h2 style="color: ${brandColor}; font-size: 18px; margin-bottom: 12px; margin-top: 0;">${eventDetailsLabel}</h2>
    <p style="margin: 8px 0;"><strong>${eventNameLabel}:</strong> ${eventName}</p>
    <p style="margin: 8px 0;"><strong>${eventDatesLabel}:</strong> ${startDate} - ${endDate}</p>
  </div>
  
  <!-- FOOTER SECTION -->
  <div style="background-color: ${footerBgColor}; color: ${footerTextColor}; font-family: ${footerFontFamily}; font-size: ${footerFontSize}; margin-top: 32px; padding: 16px; border-top: 1px solid #E0E0E0;">
    ${footerTemplate}
  </div>
</body>
</html>
    `;
    
    // Combine notification emails CC + global CC
    const combinedCcList = getCombinedCcList(ccList?.join(','), settings.globalCcList);
    
    try {
      await provider.send({
        from: `${fromName} <${settings.emailFromEmail}>`,
        to: recipients,
        cc: combinedCcList.length > 0 ? combinedCcList : undefined,
        subject,
        html,
      });
      console.log(`Task completion notification sent to ${recipients.join(', ')} with ${combinedCcList.length} CCs`);
    } catch (error) {
      console.error('Failed to send task completion notification:', error);
      throw new Error(`Failed to send task completion notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send task activated notification email
   * Notifies recipients when a dependent task has been activated because its prerequisite was completed
   */
  async sendTaskActivatedNotification(params: {
    taskTitle: string;
    taskDescription: string | null;
    eventName: string;
    completedPrerequisiteTask: string;
    completedByDepartment: string;
    recipients: string[];
    settings: AppSettings;
  }): Promise<void> {
    const { taskTitle, taskDescription, eventName, completedPrerequisiteTask, completedByDepartment, recipients, settings } = params;
    
    if (!settings.emailFromEmail) {
      throw new Error('Email from address is required');
    }

    const provider = createEmailProvider(settings);
    const fromName = settings.emailFromName || 'ECSSR Events';
    
    // Determine language
    const isArabic = settings.emailLanguage === 'ar';
    
    // Build subject
    const subject = isArabic 
      ? `تم تفعيل المهمة: ${taskTitle} - ${eventName}`
      : `Task Activated: ${taskTitle} - ${eventName}`;
    
    // Get styling from settings (fallback to task completion or stakeholder settings)
    const brandColor = settings.taskCompletionBrandColor || settings.stakeholderBrandColor || '#BC9F6D';
    const textColor = settings.taskCompletionTextColor || settings.stakeholderTextColor || '#333333';
    const bgColor = settings.taskCompletionBgColor || settings.stakeholderBgColor || '#FFFFFF';
    const fontFamily = settings.taskCompletionFontFamily || settings.stakeholderFontFamily || 'Arial, sans-serif';
    const fontSize = settings.taskCompletionFontSize || settings.stakeholderFontSize || '16px';
    
    const footerBrandColor = settings.taskCompletionFooterBrandColor || settings.stakeholderFooterBrandColor || '#BC9F6D';
    const footerTextColor = settings.taskCompletionFooterTextColor || settings.stakeholderFooterTextColor || '#666666';
    const footerBgColor = settings.taskCompletionFooterBgColor || settings.stakeholderFooterBgColor || '#FFFFFF';
    const footerFontFamily = settings.taskCompletionFooterFontFamily || settings.stakeholderFooterFontFamily || 'Arial, sans-serif';
    const footerFontSize = settings.taskCompletionFooterFontSize || settings.stakeholderFooterFontSize || '14px';
    
    // RTL support
    const isRtl = settings.taskCompletionEmailRtl || false;
    const dir = isRtl ? 'rtl' : 'ltr';
    const textAlign = isRtl ? 'right' : 'left';
    
    // Localized labels
    const taskActivatedLabel = isArabic ? 'تم تفعيل المهمة' : 'Task Activated';
    const taskLabel = isArabic ? 'المهمة' : 'Task';
    const descriptionLabel = isArabic ? 'الوصف' : 'Description';
    const statusLabel = isArabic ? 'الحالة' : 'Status';
    const readyToStartLabel = isArabic ? '🚀 جاهزة للبدء' : '🚀 Ready to Start';
    const prerequisiteCompletedLabel = isArabic ? 'المهمة المسبقة المكتملة' : 'Completed Prerequisite';
    const completedByLabel = isArabic ? 'تم إكمالها بواسطة' : 'Completed By';
    const taskDetailsLabel = isArabic ? 'تفاصيل المهمة' : 'Task Details';
    const eventLabel = isArabic ? 'الفعالية' : 'Event';
    
    // Greeting text
    const greetingText = isArabic 
      ? '<p>فريقنا الكريم،</p><p>تم تفعيل المهمة التالية بعد اكتمال المهمة المسبقة لها:</p>'
      : '<p>Dear Team,</p><p>The following task has been activated after its prerequisite was completed:</p>';
    
    // Footer text
    const footerText = isArabic
      ? '<p>يرجى البدء في العمل على هذه المهمة في أقرب وقت ممكن.</p><p>مع أطيب التحيات،<br/>فريق فعاليات مركز الإمارات للدراسات</p>'
      : '<p>Please begin working on this task at your earliest convenience.</p><p>Best regards,<br/>ECSSR Events Team</p>';
    
    // Build HTML email
    const html = `
<!DOCTYPE html>
<html dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="background-color: ${bgColor}; font-family: ${fontFamily}; font-size: ${fontSize}; color: ${textColor}; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; direction: ${dir}; text-align: ${textAlign};">
  <!-- GREETING/INTRO SECTION -->
  ${greetingText}
  
  <!-- TASK ACTIVATED BANNER -->
  <div style="background-color: #22C55E; color: white; padding: 12px 16px; border-radius: 4px; margin: 20px 0; text-align: center;">
    <strong style="font-size: 18px;">${taskActivatedLabel}</strong>
  </div>
  
  <!-- TASK DETAILS SECTION -->
  <div style="background-color: #F5F5F5; padding: 16px; border-radius: 4px; margin: 20px 0; border-${isRtl ? 'right' : 'left'}: 4px solid ${brandColor};">
    <h2 style="color: ${brandColor}; font-size: 18px; margin-bottom: 12px; margin-top: 0;">${taskDetailsLabel}</h2>
    <p style="margin: 8px 0;"><strong>${taskLabel}:</strong> ${taskTitle}</p>
    ${taskDescription ? `<p style="margin: 8px 0;"><strong>${descriptionLabel}:</strong> ${taskDescription}</p>` : ''}
    <p style="margin: 8px 0;"><strong>${statusLabel}:</strong> <span style="color: #22C55E;">${readyToStartLabel}</span></p>
    <p style="margin: 8px 0;"><strong>${eventLabel}:</strong> ${eventName}</p>
  </div>
  
  <!-- PREREQUISITE INFO SECTION -->
  <div style="background-color: #F0FDF4; padding: 16px; border-radius: 4px; margin: 20px 0; border-${isRtl ? 'right' : 'left'}: 4px solid #22C55E;">
    <p style="margin: 8px 0;"><strong>${prerequisiteCompletedLabel}:</strong> ${completedPrerequisiteTask}</p>
    <p style="margin: 8px 0;"><strong>${completedByLabel}:</strong> ${completedByDepartment}</p>
  </div>
  
  <!-- FOOTER SECTION -->
  <div style="background-color: ${footerBgColor}; color: ${footerTextColor}; font-family: ${footerFontFamily}; font-size: ${footerFontSize}; margin-top: 32px; padding: 16px; border-top: 1px solid #E0E0E0;">
    ${footerText}
  </div>
</body>
</html>
    `;
    
    // Combine with global CC
    const combinedCcList = getCombinedCcList(undefined, settings.globalCcList);
    
    try {
      await provider.send({
        from: `${fromName} <${settings.emailFromEmail}>`,
        to: recipients,
        cc: combinedCcList.length > 0 ? combinedCcList : undefined,
        subject,
        html,
      });
      console.log(`Task activation notification sent to ${recipients.join(', ')}`);
    } catch (error) {
      console.error('Failed to send task activation notification:', error);
      throw new Error(`Failed to send task activation notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendDepartmentUpdateEmail(params: {
    update: Update;
    departmentName: string;
    toEmail: string;
    type: 'weekly' | 'monthly';
    periodStart: string;
    settings: AppSettings;
    language?: 'en' | 'ar';
  }): Promise<void> {
    if (!params.settings.emailFromEmail) {
      throw new Error('Email from address is required');
    }

    const provider = createEmailProvider(params.settings);
    const fromName = params.settings.emailFromName || 'ECSSR Events';
    const language = params.language || 'en';
    const isRtl = language === 'ar';
    const dir = isRtl ? 'rtl' : 'ltr';
    const textAlign = isRtl ? 'right' : 'left';

    const periodStartDate = new Date(params.periodStart);
    const weekStart = startOfWeek(periodStartDate, { weekStartsOn: 1 });
    const periodLabel = params.type === 'weekly'
      ? `${format(weekStart, 'MMM d, yyyy')} - ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`
      : format(periodStartDate, 'MMMM yyyy');

    const updateTypeLabel = language === 'ar'
      ? (params.type === 'weekly' ? 'التحديث الأسبوعي' : 'التحديث الشهري')
      : (params.type === 'weekly' ? 'Weekly update' : 'Monthly update');
    
    const departmentLabel = language === 'ar' ? 'إدارة' : '';
    const coveringLabel = language === 'ar' ? 'للفترة' : 'covering';
    const introText = language === 'ar'
      ? `هذا هو التحديث لـ${departmentLabel} ${params.departmentName} ${coveringLabel} ${periodLabel}.`
      : `Here is the update for ${params.departmentName} ${coveringLabel} ${periodLabel}.`;

    const subject = `${updateTypeLabel} - ${params.departmentName} (${periodLabel})`;
    
    // Use custom template from settings if available
    const customTemplate = language === 'ar' 
      ? params.settings.updatesEmailTemplateAr 
      : params.settings.updatesEmailTemplate;
    
    const updateContentHtml = params.update.content?.trim() ||
      `<p>${language === 'ar' ? 'لم يتم تقديم محتوى تحديث.' : 'No update content provided.'}</p>`;

    let contentHtml: string;
    const customTemplateStr = String(customTemplate || '');
    if (customTemplateStr.trim()) {
      const replacedTemplate = customTemplateStr
        .replace(/{{updates}}/gi, updateContentHtml)
        .replace(/{{period_label}}/gi, periodLabel);

      // If the template doesn't include the updates placeholder, append the update content
      contentHtml = /{{updates}}/i.test(customTemplateStr)
        ? replacedTemplate
        : `${replacedTemplate}\n<div style="margin-top: 12px;">${updateContentHtml}</div>`;
    } else {
      contentHtml = updateContentHtml;
    }

    const html = `
<!DOCTYPE html>
<html dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 720px; margin: 0 auto; padding: 24px; background-color: #ffffff; direction: ${dir}; text-align: ${textAlign};">
  <h1 style="margin: 0 0 12px 0; font-size: 20px;">${subject}</h1>
  <p style="margin: 0 0 16px 0;">${introText}</p>
  <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; background-color: #f9fafb;">
    ${contentHtml}
  </div>
</body>
</html>
    `;

    await provider.send({
      from: `${fromName} <${params.settings.emailFromEmail}>`,
      to: params.toEmail,
      subject,
      html,
    });
  }

  /**
   * Send compiled updates digest via email
   */
  async sendUpdatesDigest(params: {
    type: 'weekly' | 'monthly';
    periodStart: string;
    toEmail: string;
    settings: AppSettings;
    sections: UpdateSection[];
    language?: 'en' | 'ar';
    customHtml?: string;
    usedFallback?: boolean;
  }): Promise<void> {
    const { type, periodStart, toEmail, settings, sections, language: requestedLanguage, customHtml, usedFallback = false } = params;

    if (!settings.emailEnabled) {
      throw new Error('Email notifications are not enabled');
    }

    if (!settings.emailFromEmail) {
      throw new Error('Email from address is required');
    }

    const provider = createEmailProvider(settings);
    const language = (requestedLanguage || settings.emailLanguage || 'en') as 'en' | 'ar';
    const periodLabel = formatUpdatePeriodLabel(type, periodStart, language);
    const subject = this.buildUpdatesSubject(type, periodStart, language);
    const html = this.renderUpdatesHtml({
      subject,
      language,
      sections,
      settings,
      customHtml,
      periodLabel,
      usedFallback,
    });

    const fromName = settings.emailFromName || 'ECSSR Events';
    const ccList = getCombinedCcList(undefined, settings.globalCcList);

    await provider.send({
      from: `${fromName} <${settings.emailFromEmail}>`,
      to: toEmail,
      cc: ccList.length > 0 ? ccList : undefined,
      subject,
      html,
    });
  }

  private buildUpdatesSubject(
    type: 'weekly' | 'monthly',
    periodStart: string,
    language: 'en' | 'ar'
  ): string {
    const periodLabel = formatUpdatePeriodLabel(type, periodStart, language);
    const prefix = language === 'ar'
      ? (type === 'weekly' ? 'المستجدات الأسبوعية' : 'المستجدات الشهرية')
      : (type === 'weekly' ? 'Weekly Updates' : 'Monthly Updates');

    return `${prefix} - ${periodLabel}`;
  }

  private renderUpdatesHtml(options: {
    subject: string;
    language: 'en' | 'ar';
    sections: UpdateSection[];
    settings: AppSettings;
    customHtml?: string;
    usedFallback: boolean;
    periodLabel: string;
  }): string {
    const { subject, language, sections, settings, customHtml, usedFallback, periodLabel } = options;

    const brandColor = settings.reminderBrandColor || '#BC9F6D';
    const textColor = settings.reminderTextColor || '#333333';
    const bgColor = settings.reminderBgColor || '#FFFFFF';
    const fontFamily = settings.reminderFontFamily || 'Arial, sans-serif';
    const fontSize = settings.reminderFontSize || '16px';

    const isRtl = language === 'ar' || settings.reminderEmailRtl || false;
    const dir = isRtl ? 'rtl' : 'ltr';
    const textAlign = isRtl ? 'right' : 'left';

    const noContentLabel = language === 'ar' ? 'لا يوجد محتوى مضاف' : 'No content provided yet';
    const fallbackNotice = usedFallback
      ? `<p style="color: #6B7280;">${language === 'ar'
        ? 'لم يتم العثور على مستجدات خاصة بالإدارات، تم استخدام التحديث العام.'
        : 'No department-specific updates were found for this period, so the general update was used.'}</p>`
      : '';

    // Build the updates HTML content
    const updatesContentHtml = sections.map((section) => `
      <div style="margin-bottom: 24px; border: 1px solid rgba(0,0,0,0.05); padding: 16px; border-radius: 8px;">
        <h2 style="margin: 0 0 8px 0; color: ${brandColor}; font-size: 18px;">${section.title}</h2>
        <div style="font-size: ${fontSize}; color: ${textColor};">${section.content || `<p style=\"color:#6B7280;\">${noContentLabel}</p>`}</div>
      </div>
    `).join('');

    // Use custom HTML if provided, otherwise use DB template, otherwise use default
    let template: string | undefined = customHtml?.trim();
    if (!template) {
      // Use DB template based on language
      template = String((language === 'ar' ? settings.updatesEmailTemplateAr : settings.updatesEmailTemplate) || '') || undefined;
    }

    // If we have a template, replace variables with the actual content
    const replaceVariables = (content: string) =>
      content
        .replace(/{{updates}}/g, updatesContentHtml)
        .replace(/{{period_label}}/gi, periodLabel);

    let bodyHtml: string;
    if (template?.trim()) {
      bodyHtml = replaceVariables(template);
    } else {
      // Fall back to default rendering
      bodyHtml = replaceVariables(updatesContentHtml);
    }

    return `
<!DOCTYPE html>
<html dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="background-color: ${bgColor}; font-family: ${fontFamily}; font-size: ${fontSize}; color: ${textColor}; line-height: 1.6; max-width: 640px; margin: 0 auto; padding: 20px; direction: ${dir}; text-align: ${textAlign};">
  <h1 style="color: ${brandColor}; margin-bottom: 12px;">${subject}</h1>
  ${fallbackNotice}
  ${bodyHtml}
</body>
</html>
    `;
  }

  /**
   * Send invitation email using generic template
   */
  async sendInvitationEmail(
    event: Event,
    contact: Contact
  ): Promise<void> {
    const settings = await storage.getSettings();
    
    if (!settings.emailFromEmail) {
      throw new Error('Email from address is required');
    }

    const provider = createEmailProvider(settings);
    const language = settings.emailLanguage || 'en';
    const isArabic = language === 'ar';

    // Use invitation-specific from email if configured
    const fromEmail = settings.invitationFromEmail || settings.emailFromEmail;
    const fromName = settings.invitationFromName || settings.emailFromName || 'ECSSR Events';

    // Get invitation template from database
    const template = await storage.getEmailTemplate('invitation', language);
    
    if (!template) {
      throw new Error(`Invitation email template not found for language: ${language}`);
    }

    // Build email using template
    const { subject, html } = this.formatInvitationEmail(event, contact, template, settings);

    const ccList = settings.globalCcList ? settings.globalCcList.split(',').map(e => e.trim()).filter(Boolean) : [];

    try {
      await provider.send({
        from: `${fromName} <${fromEmail}>`,
        to: contact.email || '',
        cc: ccList.length > 0 ? ccList : undefined,
        subject,
        html,
        attachments: [this.buildIcsAttachment(event)],
      });

      console.log(`Invitation email sent to ${contact.email}`);
    } catch (error) {
      console.error('Failed to send invitation email:', error);
      throw new Error(`Failed to send invitation email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send custom invitation email (fully customized by admin)
   */
  async sendCustomInvitationEmail(
    event: Event,
    contact: Contact,
    customSubject: string,
    customBody: string
  ): Promise<void> {
    const settings = await storage.getSettings();
    
    if (!settings.emailFromEmail) {
      throw new Error('Email from address is required');
    }

    const provider = createEmailProvider(settings);

    // Use invitation-specific from email if configured
    const fromEmail = settings.invitationFromEmail || settings.emailFromEmail;
    const fromName = settings.invitationFromName || settings.emailFromName || 'ECSSR Events';

    const ccList = settings.globalCcList ? String(settings.globalCcList).split(',').map(e => e.trim()).filter(Boolean) : [];

    // Custom email is sent as-is without template processing
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${customSubject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${customBody}
</body>
</html>
    `;

    try {
      await provider.send({
        from: `${fromName} <${fromEmail}>`,
        to: contact.email || '',
        cc: ccList.length > 0 ? ccList : undefined,
        subject: customSubject,
        html,
        attachments: [this.buildIcsAttachment(event)],
      });

      console.log(`Custom invitation email sent to ${contact.email}`);
    } catch (error) {
      console.error('Failed to send custom invitation email:', error);
      throw new Error(`Failed to send custom invitation email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format invitation email using template
   */
  formatInvitationEmail(
    event: Event,
    contact: Contact,
    template: EmailTemplate,
    settings: AppSettings
  ): { subject: string; html: string } {
    const language = settings.emailLanguage || 'en';
    const isArabic = language === 'ar';

    // Get template values or use defaults
    const subjectTemplate = template.subject || (isArabic ? 'دعوة للحضور: {{eventName}}' : 'You are invited: {{eventName}}');
    const bodyTemplate = template.body || '';
    const greetingTemplate = template.greeting || (isArabic ? 'عزيزي {{contactName}}،' : 'Dear {{contactName}},');
    const footerTemplate = template.footer || (isArabic ? '<p>مع أطيب التحيات،<br/>فريق فعاليات المركز</p>' : '<p>Best regards,<br/>ECSSR Events Team</p>');

    // Get styling from template
    const brandColor = template.brandColor || '#BC9F6D';
    const textColor = template.textColor || '#333333';
    const bgColor = template.bgColor || '#FFFFFF';
    const fontFamily = template.fontFamily || 'Arial, sans-serif';
    const fontSize = template.fontSize || '16px';

    const footerBrandColor = template.footerBrandColor || '#BC9F6D';
    const footerTextColor = template.footerTextColor || '#666666';
    const footerBgColor = template.footerBgColor || '#FFFFFF';
    const footerFontFamily = template.footerFontFamily || 'Arial, sans-serif';
    const footerFontSize = template.footerFontSize || '14px';

    const isRtl = template.isRtl || isArabic;
    const dir = isRtl ? 'rtl' : 'ltr';
    const textAlign = isRtl ? 'right' : 'left';

    // Replace variables - use contact name instead of stakeholder
    const replaceVars = (text: string): string => {
      return replaceTemplateVariables(text, event, undefined, undefined, isArabic)
        .replace(/{{contactName}}/g, contact.nameEn || contact.email || '');
    };

    const subject = replaceVars(subjectTemplate);
    const greetingHtml = greetingTemplate ? `<p>${replaceVars(greetingTemplate)}</p>` : '';
    const bodyHtml = replaceVars(bodyTemplate);
    const footerHtml = replaceVars(footerTemplate);

    const html = `
<!DOCTYPE html>
<html dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="background-color: ${bgColor}; font-family: ${fontFamily}; font-size: ${fontSize}; color: ${textColor}; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; direction: ${dir}; text-align: ${textAlign};">
  ${greetingHtml}
  
  <div>
    ${bodyHtml}
  </div>
  
  <div style="background-color: ${footerBgColor}; color: ${footerTextColor}; font-family: ${footerFontFamily}; font-size: ${footerFontSize}; margin-top: 32px; padding: 16px; border-top: 1px solid #E0E0E0;">
    ${footerHtml}
  </div>
</body>
</html>
    `;

    return { subject, html };
  }

  /**
   * Generate preview HTML for stakeholder email (without sending)
   */
  generateStakeholderPreview(settings: AppSettings): { subject: string; html: string } {
    return generateStakeholderPreview(settings, this.formatEventEmail.bind(this));
  }

  /**
   * Generate preview HTML for reminder email (without sending)
   */
  generateReminderPreview(settings: AppSettings): { subject: string; html: string } {
    return generateReminderPreview(settings, this.formatEventEmail.bind(this));
  }

  /**
   * Generate preview HTML for management summary email (without sending)
   */
  generateManagementPreview(settings: AppSettings): { subject: string; html: string } {
    return generateManagementPreview(settings);
  }

  /**
   * Generate preview HTML for task completion email (without sending)
   */
  generateTaskCompletionPreview(settings: AppSettings): { subject: string; html: string } {
    return generateTaskCompletionPreview(settings);
  }

  /**
   * Generate preview HTML for updates email (without sending)
   */
  generateUpdatesPreview(settings: AppSettings): { subject: string; html: string } {
    const language = (settings.emailLanguage || 'en') as 'en' | 'ar';
    const samplePeriodStart = '2025-11-17';
    const subject = this.buildUpdatesSubject('weekly', samplePeriodStart, language);
    const periodLabel = formatUpdatePeriodLabel('weekly', samplePeriodStart, language);
    
    // Sample updates for preview
    const sampleSections = [
      {
        title: language === 'ar' ? 'البحث والترجمة' : 'Research & Translation',
        content: language === 'ar' 
          ? '<p>تم إكمال ترجمة 5 وثائق بحثية جديدة.</p><p>جارٍ العمل على تحديث المكتبة الرقمية.</p>' 
          : '<p>Completed translation of 5 new research documents.</p><p>Working on digital library updates.</p>'
      },
      {
        title: language === 'ar' ? 'الاتصالات الاستراتيجية' : 'Strategic Communications',
        content: language === 'ar'
          ? '<p>إطلاق حملة إعلامية جديدة على وسائل التواصل الاجتماعي.</p><p>تحديث الموقع الإلكتروني الرسمي.</p>'
          : '<p>Launched new social media campaign.</p><p>Official website update completed.</p>'
      },
    ];

    const html = this.renderUpdatesHtml({
      subject,
      language,
      sections: sampleSections,
      settings,
      periodLabel,
      usedFallback: false,
    });

    return { subject, html };
  }

  generateInvitationPreview(settings: AppSettings): { subject: string; html: string } {
    const language = (settings.emailLanguage || 'en') as 'en' | 'ar';
    
    // Sample event data for preview
    const sampleEvent = {
      name: language === 'ar' ? 'القمة التكنولوجية السنوية 2025' : 'Annual Technology Summit 2025',
      description: language === 'ar' 
        ? 'انضم إلينا في المؤتمر التقني الرائد الذي يضم قادة الصناعة وورش عمل مبتكرة وفرص للتواصل.'
        : 'Join us for the premier technology conference featuring industry leaders, innovative workshops, and networking opportunities.',
      startDate: new Date('2025-03-15'),
      endDate: new Date('2025-03-17'),
      location: language === 'ar' ? 'مركز دبي التجاري العالمي' : 'Dubai World Trade Centre',
      organizers: language === 'ar' ? 'مركز الابتكار التقني' : 'Tech Innovation Hub',
    };

    const sampleInvitee = {
      name: language === 'ar' ? 'الدكتور أحمد محمد' : 'Dr. Ahmed Mohammed',
      title: language === 'ar' ? 'مدير الأبحاث' : 'Research Director',
      organization: language === 'ar' ? 'مركز الدراسات الاستراتيجية' : 'Strategic Studies Center',
    };

    // Get template settings based on language
    const greeting = language === 'ar' 
      ? (settings.invitationGreetingAr || settings.invitationGreeting || '')
      : (settings.invitationGreeting || '');
      
    const subjectTemplate = language === 'ar'
      ? (settings.invitationSubjectAr || settings.invitationSubject || 'أنت مدعو: {{eventName}}')
      : (settings.invitationSubject || 'You are invited: {{eventName}}');
      
    const bodyTemplate = language === 'ar'
      ? (settings.invitationBodyAr || settings.invitationBody || '<h1>{{eventName}}</h1><p>{{description}}</p>')
      : (settings.invitationBody || '<h1>{{eventName}}</h1><p>{{description}}</p>');
      
    const footerTemplate = language === 'ar'
      ? (settings.invitationFooterAr || settings.invitationFooter || '<p>مع أطيب التحيات،<br/>فريق فعاليات المركز</p>')
      : (settings.invitationFooter || '<p>Best regards,<br/>ECSSR Events Team</p>');

    // Build subject
    const subject = String(subjectTemplate || '')
      .replace(/{{eventName}}/g, sampleEvent.name)
      .replace(/{{inviteeName}}/g, sampleInvitee.name)
      .replace(/{{inviteeTitle}}/g, sampleInvitee.title)
      .replace(/{{inviteeOrganization}}/g, sampleInvitee.organization);

    // Build body with variables replaced
    const processedBody = String(bodyTemplate || '')
      .replace(/{{eventName}}/g, sampleEvent.name)
      .replace(/{{description}}/g, sampleEvent.description)
      .replace(/{{startDate}}/g, sampleEvent.startDate.toLocaleDateString(language === 'ar' ? 'ar-AE' : 'en-US'))
      .replace(/{{endDate}}/g, sampleEvent.endDate.toLocaleDateString(language === 'ar' ? 'ar-AE' : 'en-US'))
      .replace(/{{location}}/g, sampleEvent.location)
      .replace(/{{organizers}}/g, sampleEvent.organizers)
      .replace(/{{inviteeName}}/g, sampleInvitee.name)
      .replace(/{{inviteeTitle}}/g, sampleInvitee.title)
      .replace(/{{inviteeOrganization}}/g, sampleInvitee.organization);

    // Build footer
    const processedFooter = String(footerTemplate || '')
      .replace(/{{eventName}}/g, sampleEvent.name)
      .replace(/{{inviteeName}}/g, sampleInvitee.name);

    // Build HTML email
    const brandColor = settings.invitationBrandColor || '#BC9F6D';
    const textColor = settings.invitationTextColor || '#333333';
    const bgColor = settings.invitationBgColor || '#FFFFFF';
    const fontFamily = settings.invitationFontFamily || 'Arial, sans-serif';
    const fontSize = settings.invitationFontSize || '16px';
    
    const footerBrandColor = settings.invitationFooterBrandColor || '#BC9F6D';
    const footerTextColor = settings.invitationFooterTextColor || '#666666';
    const footerBgColor = settings.invitationFooterBgColor || '#FFFFFF';
    const footerFontFamily = settings.invitationFooterFontFamily || 'Arial, sans-serif';
    const footerFontSize = settings.invitationFooterFontSize || '14px';

    const html = `
      <!DOCTYPE html>
      <html dir="${language === 'ar' ? 'rtl' : 'ltr'}" lang="${language}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: ${fontFamily};">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 20px 0;">
              <table role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: ${bgColor}; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                ${greeting ? `
                  <tr>
                    <td style="padding: 24px 24px 0; font-family: ${fontFamily}; font-size: ${fontSize}; color: ${textColor};">
                      ${greeting}
                    </td>
                  </tr>
                ` : ''}
                <tr>
                  <td style="padding: ${greeting ? '16px' : '24px'} 24px; font-family: ${fontFamily}; font-size: ${fontSize}; color: ${textColor};">
                    ${processedBody}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 24px 24px; font-family: ${footerFontFamily}; font-size: ${footerFontSize}; color: ${footerTextColor}; background-color: ${footerBgColor}; border-top: 2px solid ${footerBrandColor}; border-radius: 0 0 8px 8px;">
                    ${processedFooter}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return { subject, html };
  }
}

export const emailService = new EmailService();
