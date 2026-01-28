import type { Task, StakeholderRequirement } from '@shared/schema.mssql';
import type { AppSettings } from './services/configService';
import { format } from 'date-fns';
import { formatRequirementItem } from './email-helpers';

/**
 * Render task list as HTML
 */
export function renderTaskList(
  tasks: Task[],
  settings: AppSettings,
  emailType: 'stakeholder' | 'reminder' | 'management'
): string {
  if (tasks.length === 0) {
    return '';
  }

  // Get styling based on email type
  const brandColor = emailType === 'stakeholder' 
    ? (settings.stakeholderRequirementsBrandColor || '#BC9F6D')
    : emailType === 'reminder'
    ? (settings.reminderRequirementsBrandColor || '#BC9F6D')
    : (settings.managementSummaryRequirementsBrandColor || '#BC9F6D');
  
  const textColor = emailType === 'stakeholder'
    ? (settings.stakeholderRequirementsTextColor || '#333333')
    : emailType === 'reminder'
    ? (settings.reminderRequirementsTextColor || '#333333')
    : (settings.managementSummaryRequirementsTextColor || '#333333');
  
  const bgColor = emailType === 'stakeholder'
    ? (settings.stakeholderRequirementsBgColor || '#F5F5F5')
    : emailType === 'reminder'
    ? (settings.reminderRequirementsBgColor || '#F5F5F5')
    : (settings.managementSummaryRequirementsBgColor || '#F5F5F5');
  
  const fontFamily = emailType === 'stakeholder'
    ? (settings.stakeholderRequirementsFontFamily || 'Arial, sans-serif')
    : emailType === 'reminder'
    ? (settings.reminderRequirementsFontFamily || 'Arial, sans-serif')
    : (settings.managementSummaryRequirementsFontFamily || 'Arial, sans-serif');
  
  const fontSize = emailType === 'stakeholder'
    ? (settings.stakeholderRequirementsFontSize || '16px')
    : emailType === 'reminder'
    ? (settings.reminderRequirementsFontSize || '16px')
    : (settings.managementSummaryRequirementsFontSize || '16px');

  // Helper function to get status color and label
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
        return { color: '#22C55E', label: 'Completed' };
      case 'in_progress':
        return { color: '#F59E0B', label: 'In Progress' };
      case 'overdue':
        return { color: '#EF4444', label: 'Overdue' };
      default:
        return { color: '#6B7280', label: 'Pending' };
    }
  };

  let html = `
    <div style="background-color: ${bgColor}; color: ${textColor}; font-family: ${fontFamily}; font-size: ${fontSize}; margin-top: 24px; padding: 16px; border-radius: 4px;">
      <h3 style="color: ${brandColor}; font-size: 18px; margin-bottom: 12px; margin-top: 0;">Pending Tasks</h3>
      <ul style="margin: 12px 0; padding-left: 20px;">
  `;

  tasks.forEach(task => {
    const statusInfo = getStatusInfo(task.status || 'pending');
    const dueDate = task.dueDate ? format(new Date(task.dueDate), 'MMM dd, yyyy') : null;
    
    html += `
      <li style="margin-bottom: 12px;">
        <strong>${task.title}</strong>
        <span style="color: ${statusInfo.color}; margin-left: 8px;">[${statusInfo.label}]</span>
        ${dueDate ? `<span style="opacity: 0.8; margin-left: 8px;">Due: ${dueDate}</span>` : ''}
        ${task.description ? `<br><span style="opacity: 0.8; font-size: 14px;">${task.description}</span>` : ''}
      </li>
    `;
  });

  html += `
      </ul>
    </div>
  `;

  return html;
}

/**
 * Render requirements section as HTML
 */
export function renderRequirementsSection(
  requirements: StakeholderRequirement[],
  customRequirements: string,
  settings: AppSettings,
  emailType: 'stakeholder' | 'management',
  isArabic: boolean = false
): string {
  if (requirements.length === 0 && !customRequirements) {
    return '';
  }

  const reqBrandColor = emailType === 'stakeholder'
    ? (settings.stakeholderRequirementsBrandColor || '#BC9F6D')
    : (settings.managementSummaryRequirementsBrandColor || '#BC9F6D');
  
  const reqTextColor = emailType === 'stakeholder'
    ? (settings.stakeholderRequirementsTextColor || '#333333')
    : (settings.managementSummaryRequirementsTextColor || '#333333');
  
  const reqBgColor = emailType === 'stakeholder'
    ? (settings.stakeholderRequirementsBgColor || '#F5F5F5')
    : (settings.managementSummaryRequirementsBgColor || '#F5F5F5');
  
  const reqFontFamily = emailType === 'stakeholder'
    ? (settings.stakeholderRequirementsFontFamily || 'Arial, sans-serif')
    : (settings.managementSummaryRequirementsFontFamily || 'Arial, sans-serif');
  
  const reqFontSize = emailType === 'stakeholder'
    ? (settings.stakeholderRequirementsFontSize || '16px')
    : (settings.managementSummaryRequirementsFontSize || '16px');

  const requirementsTitle = emailType === 'stakeholder'
    ? (isArabic
      ? (settings.stakeholderRequirementsTitleAr || 'متطلباتك لهذه الفعالية')
      : (settings.stakeholderRequirementsTitle || 'Your Requirements for this Event'))
    : (isArabic
      ? 'المتطلبات'
      : 'Requirements');

  const itemTemplate = emailType === 'stakeholder'
    ? String(settings.stakeholderRequirementItemTemplate || '')
    : String(settings.managementSummaryRequirementItemTemplate || '');

  let html = `
    <div style="background-color: ${reqBgColor}; color: ${reqTextColor}; font-family: ${reqFontFamily}; font-size: ${reqFontSize}; margin-top: 24px; padding: 16px; border-radius: 4px;">
      <h2 style="color: ${reqBrandColor}; font-size: 18px; margin-bottom: 12px; margin-top: 0;">${requirementsTitle}</h2>
  `;
  
  if (requirements.length > 0) {
    html += '<ul style="margin: 12px 0; padding-left: 20px;">';
    requirements.forEach((req, index) => {
      html += formatRequirementItem(req, index, itemTemplate, isArabic);
    });
    html += '</ul>';
  }
  
  if (customRequirements) {
    const customTitle = isArabic ? 'متطلبات إضافية' : 'Additional Requirements';
    html += `
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(0,0,0,0.1);">
        <h3 style="color: ${reqBrandColor}; font-size: 16px; margin-bottom: 8px; margin-top: 0;">${customTitle}</h3>
        <p style="margin: 8px 0;">${customRequirements}</p>
      </div>
    `;
  }
  
  html += '</div>';
  return html;
}
