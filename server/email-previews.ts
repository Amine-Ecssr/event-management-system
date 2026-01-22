import type { Event, Stakeholder, StakeholderRequirement } from '@shared/schema';
import type { AppSettings } from './services/configService';
import { format } from 'date-fns';
import { replaceTemplateVariables, formatRequirementItem } from './email-helpers';

/**
 * Create sample event data for previews
 */
function createSampleEvent(): Event {
  return {
    id: 'preview-1',
    name: 'Annual Technology Summit 2025',
    nameAr: 'قمة التكنولوجيا السنوية 2025',
    description: 'Join us for the premier technology conference featuring industry leaders, innovative workshops, and networking opportunities.',
    descriptionAr: 'انضم إلينا في مؤتمر التكنولوجيا الرائد الذي يضم قادة الصناعة وورش عمل مبتكرة وفرص التواصل.',
    startDate: '2025-03-15',
    endDate: '2025-03-17',
    startTime: '09:00',
    endTime: '17:00',
    location: 'Dubai World Trade Centre',
    locationAr: 'مركز دبي التجاري العالمي',
    organizers: 'Tech Innovation Hub',
    organizersAr: 'مركز الابتكار التقني',
    url: 'https://example.com/tech-summit',
    category: 'Technology',
    categoryAr: 'تكنولوجيا',
    categoryId: 1,
    eventType: 'international',
    eventScope: 'external',
    expectedAttendance: 500,
    agendaEnFileName: null,
    agendaEnStoredFileName: null,
    agendaArFileName: null,
    agendaArStoredFileName: null,
    isScraped: false,
    source: 'manual',
    externalId: null,
    adminModified: false,
    reminder1Week: true,
    reminder1Day: true,
    reminderWeekly: false,
    reminderDaily: false,
    reminderMorningOf: false,
    isArchived: false,
    archivedAt: null,
  };
}

/**
 * Generate preview HTML for stakeholder email (without sending)
 */
export function generateStakeholderPreview(settings: AppSettings, formatEventEmailFn: Function): { subject: string; html: string } {
  const sampleEvent = createSampleEvent();

  const sampleStakeholder: Stakeholder = {
    id: 1,
    name: 'Public Relations Department',
    nameAr: 'قسم العلاقات العامة',
    keycloakGroupId: null,
    active: true,
    ccList: null,
    createdAt: new Date(),
  };

  const sampleRequirements: StakeholderRequirement[] = [
    {
      id: 1,
      departmentId: 1,
      title: 'Submit Event Documentation',
      titleAr: 'تقديم وثائق الفعالية',
      description: 'Provide a comprehensive report covering key highlights, attendance figures, and outcomes within 5 business days.',
      descriptionAr: 'تقديم تقرير شامل يغطي أبرز النقاط وأرقام الحضور والنتائج خلال 5 أيام عمل.',
      isDefault: false,
      notificationEmails: [],
      dueDateBasis: 'event_end',
      createdAt: new Date(),
    },
    {
      id: 2,
      departmentId: 1,
      title: 'Coordinate Logistics',
      titleAr: 'تنسيق اللوجستيات',
      description: 'Ensure all venue, catering, and technical requirements are confirmed at least 2 weeks before the event date.',
      descriptionAr: 'التأكد من تأكيد جميع متطلبات المكان والتموين والمتطلبات الفنية قبل أسبوعين على الأقل من تاريخ الفعالية.',
      isDefault: false,
      notificationEmails: [],
      dueDateBasis: 'event_end',
      createdAt: new Date(),
    },
    {
      id: 3,
      departmentId: 1,
      title: 'Prepare Marketing Materials',
      titleAr: 'إعداد المواد التسويقية',
      description: 'Design and distribute promotional content including social media posts, email campaigns, and press releases.',
      descriptionAr: 'تصميم وتوزيع المحتوى الترويجي بما في ذلك منشورات وسائل التواصل الاجتماعي وحملات البريد الإلكتروني والبيانات الصحفية.',
      isDefault: false,
      notificationEmails: [],
      dueDateBasis: 'event_end',
      createdAt: new Date(),
    },
  ];

  // Determine language from global settings
  const language = settings.emailLanguage || 'en';
  const isArabic = language === 'ar';
  
  // Get templates from settings based on language
  const subjectTemplate = isArabic 
    ? String(settings.stakeholderSubjectAr || 'فعالية جديدة: {{eventName}}')
    : String(settings.stakeholderSubject || 'New Event: {{eventName}}');
  const bodyTemplate = isArabic
    ? String(settings.stakeholderBodyAr || '<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>التاريخ:</strong> {{startDate}} - {{endDate}}</p><p><strong>الموقع:</strong> {{location}}</p>')
    : String(settings.stakeholderBody || '<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>Date:</strong> {{startDate}} - {{endDate}}</p><p><strong>Location:</strong> {{location}}</p>');
  const greetingTemplate = isArabic
    ? String(settings.stakeholderGreetingAr || settings.stakeholderGreeting || 'عزيزي {{name}}')
    : String(settings.stakeholderGreeting || 'Dear {{name}},');
  
  // Get styling from settings or use defaults
  const brandColor = String(settings.stakeholderBrandColor || '#BC9F6D');
  const textColor = String(settings.stakeholderTextColor || '#333333');
  const bgColor = String(settings.stakeholderBgColor || '#FFFFFF');
  const fontFamily = String(settings.stakeholderFontFamily || 'Arial, sans-serif');
  const fontSize = String(settings.stakeholderFontSize || '16px');
  
  const reqBrandColor = String(settings.stakeholderRequirementsBrandColor || '#BC9F6D');
  const reqTextColor = String(settings.stakeholderRequirementsTextColor || '#333333');
  const reqBgColor = String(settings.stakeholderRequirementsBgColor || '#F5F5F5');
  const reqFontFamily = String(settings.stakeholderRequirementsFontFamily || 'Arial, sans-serif');
  const reqFontSize = String(settings.stakeholderRequirementsFontSize || '16px');
  
  const footerBrandColor = String(settings.stakeholderFooterBrandColor || '#BC9F6D');
  const footerTextColor = String(settings.stakeholderFooterTextColor || '#666666');
  const footerBgColor = String(settings.stakeholderFooterBgColor || '#FFFFFF');
  const footerFontFamily = String(settings.stakeholderFooterFontFamily || 'Arial, sans-serif');
  const footerFontSize = String(settings.stakeholderFooterFontSize || '14px');
  
  const footerTemplate = isArabic
    ? String(settings.stakeholderFooterAr || '<p>مع أطيب التحيات،<br/>فريق فعاليات المركز</p>')
    : String(settings.stakeholderFooter || '<p>Best regards,<br/>ECSSR Events Team</p>');
  
  // RTL support - automatically enable for Arabic
  const isRtl = isArabic || settings.stakeholderEmailRtl || false;
  const dir = isRtl ? 'rtl' : 'ltr';
  const textAlign = isRtl ? 'right' : 'left';
  
  // Replace template variables in subject (with stakeholder name)
  const subject = replaceTemplateVariables(subjectTemplate, sampleEvent, sampleStakeholder, undefined, isArabic);
  
  // Build greeting with stakeholder name
  const greetingHtml = greetingTemplate 
    ? `<p>${replaceTemplateVariables(greetingTemplate, sampleEvent, sampleStakeholder, undefined, isArabic)}</p>`
    : '';
  
  // Replace template variables in custom message (with stakeholder name)
  let customMessageHtml = replaceTemplateVariables(bodyTemplate, sampleEvent, sampleStakeholder, undefined, isArabic);
  
  // Build requirements section HTML
  let requirementsHtml = '';
  const requirementsTitle = isArabic
    ? String(settings.stakeholderRequirementsTitleAr || 'متطلباتك لهذه الفعالية')
    : String(settings.stakeholderRequirementsTitle || 'Your Requirements for this Event');
  requirementsHtml = `
    <div style="background-color: ${reqBgColor}; color: ${reqTextColor}; font-family: ${reqFontFamily}; font-size: ${reqFontSize}; margin-top: 24px; padding: 16px; border-radius: 4px;">
      <h2 style="color: ${reqBrandColor}; font-size: 18px; margin-bottom: 12px; margin-top: 0;">${requirementsTitle}</h2>
      <ul style="margin: 12px 0; padding-left: 20px;">
        ${sampleRequirements.map((req, index) => formatRequirementItem(req, index, settings.stakeholderRequirementItemTemplate as string | undefined, isArabic)).join('')}
      </ul>
    </div>
  `;
  
  // Handle {{requirements}} template variable
  const hasRequirementsPlaceholder = customMessageHtml.includes('{{requirements}}');
  if (hasRequirementsPlaceholder) {
    customMessageHtml = customMessageHtml.replace(/\{\{requirements\}\}/g, requirementsHtml);
    requirementsHtml = '';
  }
  
  // Replace template variables in footer
  const footerHtml = replaceTemplateVariables(footerTemplate, sampleEvent, sampleStakeholder, undefined, isArabic);
  
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
  
  <!-- REQUIREMENTS SECTION (only if not embedded via {{requirements}}) -->
  ${requirementsHtml}
  
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
 * Generate preview HTML for reminder email (without sending)
 */
export function generateReminderPreview(settings: AppSettings, formatEventEmailFn: Function): { subject: string; html: string } {
  const sampleEvent = createSampleEvent();
  return formatEventEmailFn(sampleEvent, settings);
}

/**
 * Generate preview HTML for management summary email (without sending)
 */
export function generateManagementPreview(settings: AppSettings): { subject: string; html: string } {
  const language = settings.emailLanguage || 'en';
  const isArabic = language === 'ar';
  
  const sampleEvent = createSampleEvent();

  const sampleStakeholders = [
    {
      stakeholder: {
        id: 1,
        name: 'Public Relations Department',
        nameAr: 'قسم العلاقات العامة',
        active: true,
        ccList: null,
        createdAt: new Date(),
      },
      selectedRequirements: [
        {
          id: 1,
          departmentId: 1,
          title: 'Submit Event Documentation',
          titleAr: 'تقديم وثائق الفعالية',
          description: 'Provide a comprehensive report covering key highlights, attendance figures, and outcomes within 5 business days.',
          descriptionAr: 'تقديم تقرير شامل يغطي أبرز النقاط وأرقام الحضور والنتائج خلال 5 أيام عمل.',
          isDefault: false,
          notificationEmails: [],
          dueDateBasis: 'event_end',
          createdAt: new Date(),
        },
        {
          id: 2,
          departmentId: 1,
          title: 'Manage Media Relations',
          titleAr: 'إدارة العلاقات الإعلامية',
          description: 'Coordinate with press and media outlets for event coverage, interviews, and post-event publicity.',
          descriptionAr: 'التنسيق مع الصحافة ووسائل الإعلام لتغطية الفعالية والمقابلات والدعاية بعد الفعالية.',
          isDefault: false,
          notificationEmails: [],
          dueDateBasis: 'event_end',
          createdAt: new Date(),
        },
      ],
      customRequirements: 'Ensure all press releases and media materials are bilingual (English and Arabic).',
      emails: ['pr@ecssr.ae'],
    },
    {
      stakeholder: {
        id: 2,
        name: 'Events & Facilities Department',
        nameAr: 'قسم الفعاليات والمرافق',
        active: true,
        ccList: null,
        createdAt: new Date(),
      },
      selectedRequirements: [
        {
          id: 3,
          departmentId: 2,
          title: 'Coordinate Logistics',
          titleAr: 'تنسيق اللوجستيات',
          description: 'Ensure all venue, catering, and technical requirements are confirmed at least 2 weeks before the event.',
          descriptionAr: 'التأكد من تأكيد جميع متطلبات المكان والتموين والمتطلبات الفنية قبل أسبوعين على الأقل من الفعالية.',
          isDefault: false,
          notificationEmails: [],
          dueDateBasis: 'event_end',
          createdAt: new Date(),
        },
        {
          id: 4,
          departmentId: 2,
          title: 'Oversee Registration Process',
          titleAr: 'الإشراف على عملية التسجيل',
          description: 'Manage attendee registration, ticketing systems, and check-in procedures on event day.',
          descriptionAr: 'إدارة تسجيل الحضور وأنظمة التذاكر وإجراءات تسجيل الدخول يوم الفعالية.',
          isDefault: false,
          notificationEmails: [],
          dueDateBasis: 'event_end',
          createdAt: new Date(),
        },
      ],
      customRequirements: 'Coordinate with IT Department for online registration platform setup and testing.',
      emails: ['events@ecssr.ae'],
    },
    {
      stakeholder: {
        id: 3,
        name: 'Research & Programs Department',
        nameAr: 'قسم البحوث والبرامج',
        active: true,
        ccList: null,
        createdAt: new Date(),
      },
      selectedRequirements: [
        {
          id: 5,
          departmentId: 3,
          title: 'Arrange Speaker Sessions',
          titleAr: 'ترتيب جلسات المتحدثين',
          description: 'Schedule and coordinate with keynote speakers, panelists, and ensure all presentation materials are prepared.',
          descriptionAr: 'جدولة والتنسيق مع المتحدثين الرئيسيين وأعضاء اللجنة والتأكد من إعداد جميع مواد العرض.',
          isDefault: false,
          notificationEmails: [],
          dueDateBasis: 'event_end',
          createdAt: new Date(),
        },
        {
          id: 6,
          departmentId: 3,
          title: 'Prepare Post-Event Survey',
          titleAr: 'إعداد استطلاع ما بعد الفعالية',
          description: 'Design and distribute feedback forms to collect attendee insights and measure event success.',
          descriptionAr: 'تصميم وتوزيع نماذج التغذية الراجعة لجمع آراء الحضور وقياس نجاح الفعالية.',
          isDefault: false,
          notificationEmails: [],
          dueDateBasis: 'event_end',
          createdAt: new Date(),
        },
      ],
      customRequirements: isArabic 
        ? 'توفير مواد الإحاطة البحثية للمتحدثين وضمان الدقة الأكاديمية في جميع العروض التقديمية.'
        : 'Provide research briefing materials for speakers and ensure academic rigor in all presentations.',
      emails: ['research@ecssr.ae'],
    },
  ];

  // Get templates
  const subjectTemplate = isArabic
    ? String(settings.managementSummarySubjectAr || settings.managementSummarySubjectTemplate || 'ملخص إداري: {{eventName}}')
    : String(settings.managementSummarySubjectTemplate || 'Event Summary: {{eventName}}');
  const bodyTemplate = isArabic
    ? String(settings.managementSummaryBodyAr || settings.managementSummaryBody || '<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>التاريخ:</strong> {{startDate}} - {{endDate}}</p><p><strong>العدد المتوقع للحضور:</strong> {{expectedAttendance}}</p>')
    : String(settings.managementSummaryBody || '<h1>{{eventName}}</h1><p>{{description}}</p><p><strong>Date:</strong> {{startDate}} - {{endDate}}</p><p><strong>Expected Attendance:</strong> {{expectedAttendance}}</p>');
  
  // Get styling
  const brandColor = String(settings.managementSummaryBrandColor || '#BC9F6D');
  const textColor = String(settings.managementSummaryTextColor || '#333333');
  const bgColor = String(settings.managementSummaryBgColor || '#FFFFFF');
  const fontFamily = String(settings.managementSummaryFontFamily || 'Arial, sans-serif');
  const fontSize = String(settings.managementSummaryFontSize || '16px');
  
  const reqBrandColor = String(settings.managementSummaryRequirementsBrandColor || '#BC9F6D');
  const reqTextColor = String(settings.managementSummaryRequirementsTextColor || '#333333');
  const reqBgColor = String(settings.managementSummaryRequirementsBgColor || '#F5F5F5');
  const reqFontFamily = String(settings.managementSummaryRequirementsFontFamily || 'Arial, sans-serif');
  const reqFontSize = String(settings.managementSummaryRequirementsFontSize || '16px');
  
  const footerBrandColor = String(settings.managementSummaryFooterBrandColor || '#BC9F6D');
  const footerTextColor = String(settings.managementSummaryFooterTextColor || '#666666');
  const footerBgColor = String(settings.managementSummaryFooterBgColor || '#FFFFFF');
  const footerFontFamily = String(settings.managementSummaryFooterFontFamily || 'Arial, sans-serif');
  const footerFontSize = String(settings.managementSummaryFooterFontSize || '14px');
  
  const footerTemplate = isArabic
    ? String(settings.managementSummaryFooterAr || '<p>مع أطيب التحيات،<br/>إدارة المركز</p>')
    : String(settings.managementSummaryFooter || '<p>Best regards,<br/>ECSSR Management</p>');
  
  const isRtl = isArabic || settings.managementSummaryEmailRtl || false;
  const dir = isRtl ? 'rtl' : 'ltr';
  const textAlign = isRtl ? 'right' : 'left';
  
  const stakeholderCount = sampleStakeholders.length.toString();
  const stakeholderNames = sampleStakeholders.map(a => a.stakeholder.name).join(', ');
  const additionalVars = { stakeholderCount, stakeholderNames };
  
  const subject = replaceTemplateVariables(subjectTemplate, sampleEvent, undefined, additionalVars, isArabic);
  
  let greetingHtml = '';
  const greetingTemplate = isArabic
    ? (settings.managementSummaryGreetingAr || settings.managementSummaryGreeting) as string | undefined
    : settings.managementSummaryGreeting as string | undefined;
  if (greetingTemplate) {
    greetingHtml = `<p>${replaceTemplateVariables(greetingTemplate, sampleEvent, undefined, additionalVars, isArabic)}</p>`;
  }
  
  let customMessageHtml = replaceTemplateVariables(bodyTemplate, sampleEvent, undefined, additionalVars, isArabic);
  
  let stakeholdersHtml = '';
  const includeRequirements = settings.managementSummaryIncludeRequirements !== false;
  if (sampleStakeholders.length > 0 && includeRequirements) {
    const stakeholderTitle = isArabic ? 'تكليفات الإدارات' : 'Department Assignments';
    stakeholdersHtml = `
      <div style="background-color: ${reqBgColor}; color: ${reqTextColor}; font-family: ${reqFontFamily}; font-size: ${reqFontSize}; margin-top: 24px; padding: 16px; border-radius: 4px;">
        <h2 style="color: ${reqBrandColor}; font-size: 18px; margin-bottom: 12px; margin-top: 0;">${stakeholderTitle}</h2>
    `;
    
    sampleStakeholders.forEach((assignment, idx) => {
      const deptName = isArabic 
        ? (assignment.stakeholder.nameAr || assignment.stakeholder.name)
        : assignment.stakeholder.name;
      
      stakeholdersHtml += `
        <div style="margin-bottom: 16px; ${idx > 0 ? 'padding-top: 16px; border-top: 1px solid rgba(0,0,0,0.1);' : ''}">
          <h3 style="color: ${reqBrandColor}; font-size: 16px; margin-bottom: 8px; margin-top: 0;">${deptName}</h3>
          <ul style="margin: 8px 0; padding-left: 20px;">
            ${assignment.selectedRequirements.map((req, index) => formatRequirementItem(req, index, settings.managementSummaryRequirementItemTemplate as string | undefined, isArabic)).join('')}
          </ul>
          ${assignment.customRequirements ? `
            <div style="margin-top: 8px; padding: 8px; background-color: rgba(0,0,0,0.05); border-radius: 4px;">
              <strong>${isArabic ? 'متطلبات إضافية:' : 'Additional Requirements:'}</strong> ${assignment.customRequirements}
            </div>
          ` : ''}
        </div>
      `;
    });
    
    stakeholdersHtml += '</div>';
  }
  
  const hasRequirementsPlaceholder = customMessageHtml.includes('{{requirements}}');
  if (hasRequirementsPlaceholder) {
    customMessageHtml = customMessageHtml.replace(/\{\{requirements\}\}/g, stakeholdersHtml);
    stakeholdersHtml = '';
  }
  
  const footerHtml = replaceTemplateVariables(footerTemplate, sampleEvent, undefined, undefined, isArabic);
  
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
  
  return { subject, html };
}

/**
 * Generate preview HTML for task completion email (without sending)
 */
export function generateTaskCompletionPreview(settings: AppSettings): { subject: string; html: string } {
  const language = settings.emailLanguage || 'en';
  const isArabic = language === 'ar';
  
  const taskTitle = isArabic ? 'تقديم وثائق الفعالية' : 'Submit Event Documentation';
  const taskDescription = isArabic 
    ? 'تقديم تقرير شامل يغطي أبرز النقاط وأرقام الحضور والنتائج خلال 5 أيام عمل.'
    : 'Provide a comprehensive report covering key highlights, attendance figures, and outcomes within 5 business days.';
  const eventName = isArabic ? 'قمة التكنولوجيا السنوية 2025' : 'Annual Technology Summit 2025';
  const eventStartDate = '2025-03-15';
  const eventEndDate = '2025-03-17';
  const completedByStakeholder = isArabic ? 'قسم العلاقات العامة' : 'Public Relations Department';
  
  const subjectTemplate = isArabic 
    ? String(settings.taskCompletionSubjectAr || settings.taskCompletionSubject || 'Task Completed: {{taskTitle}} - {{eventName}}')
    : String(settings.taskCompletionSubject || 'Task Completed: {{taskTitle}} - {{eventName}}');
  
  const bodyTemplate = isArabic
    ? String(settings.taskCompletionBodyAr || settings.taskCompletionBody || '<p>Dear Team,</p><p>Kindly note that the following task has been marked as completed:</p>')
    : String(settings.taskCompletionBody || '<p>Dear Team,</p><p>Kindly note that the following task has been marked as completed:</p>');
  
  const footerTemplate = isArabic
    ? (settings.taskCompletionFooterAr || settings.taskCompletionFooter || '<p>Best regards,<br/>ECSSR Events Team</p>')
    : (settings.taskCompletionFooter || '<p>Best regards,<br/>ECSSR Events Team</p>');
  
  const startDate = format(new Date(eventStartDate), 'MMM dd, yyyy');
  const endDate = format(new Date(eventEndDate), 'MMM dd, yyyy');
  
  const subject = subjectTemplate
    .replace(/\{\{taskTitle\}\}/g, taskTitle)
    .replace(/\{\{eventName\}\}/g, eventName);
  
  const bodyIntro = bodyTemplate
    .replace(/\{\{taskTitle\}\}/g, taskTitle)
    .replace(/\{\{eventName\}\}/g, eventName);
  
  const brandColor = String(settings.taskCompletionBrandColor || settings.stakeholderBrandColor || '#BC9F6D');
  const textColor = String(settings.taskCompletionTextColor || settings.stakeholderTextColor || '#333333');
  const bgColor = String(settings.taskCompletionBgColor || settings.stakeholderBgColor || '#FFFFFF');
  const fontFamily = String(settings.taskCompletionFontFamily || settings.stakeholderFontFamily || 'Arial, sans-serif');
  const fontSize = String(settings.taskCompletionFontSize || settings.stakeholderFontSize || '16px');
  
  const footerBrandColor = String(settings.taskCompletionFooterBrandColor || settings.stakeholderFooterBrandColor || '#BC9F6D');
  const footerTextColor = String(settings.taskCompletionFooterTextColor || settings.stakeholderFooterTextColor || '#666666');
  const footerBgColor = String(settings.taskCompletionFooterBgColor || settings.stakeholderFooterBgColor || '#FFFFFF');
  const footerFontFamily = String(settings.taskCompletionFooterFontFamily || settings.stakeholderFooterFontFamily || 'Arial, sans-serif');
  const footerFontSize = String(settings.taskCompletionFooterFontSize || settings.stakeholderFooterFontSize || '14px');
  
  const isRtl = settings.taskCompletionEmailRtl || false;
  const dir = isRtl ? 'rtl' : 'ltr';
  const textAlign = isRtl ? 'right' : 'left';
  
  const taskLabel = isArabic ? 'المهمة' : 'Task';
  const descriptionLabel = isArabic ? 'الوصف' : 'Description';
  const statusLabel = isArabic ? 'الحالة' : 'Status';
  const completedLabel = isArabic ? '✓ مكتملة' : '✓ Completed';
  const completedByLabel = isArabic ? 'أكملها' : 'Completed By';
  const eventDetailsLabel = isArabic ? 'تفاصيل الفعالية' : 'Event Details';
  const eventNameLabel = isArabic ? 'اسم الفعالية' : 'Event Name';
  const eventDatesLabel = isArabic ? 'تواريخ الفعالية' : 'Event Dates';
  const taskDetailsLabel = isArabic ? 'تفاصيل المهمة' : 'Task Details';
  
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
    <p style="margin: 8px 0;"><strong>${descriptionLabel}:</strong> ${taskDescription}</p>
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
  
  return { subject, html };
}
