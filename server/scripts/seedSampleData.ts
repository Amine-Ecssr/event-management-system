import 'dotenv/config';
import { db, pool } from "../db";
import {
  categories,
  contacts,
  countries,
  departments,
  departmentAccounts,
  departmentEmails,
  departmentRequirements,
  eventSpeakers,
  eventAttendees,
  eventInvitees,
  events,
  eventDepartments,
  archivedEvents,
  archivedEventSpeakers,
  archiveMedia,
  organizations,
  positions,
  reminderQueue,
  tasks,
  users,
  taskTemplatePrerequisites,
  eventWorkflows,
  workflowTasks,
  // Partnership tables
  partnershipTypes,
  agreementTypes,
  partnershipAgreements,
  partnershipActivities,
  partnershipContacts,
  // Lead tables
  leads,
  leadInteractions,
  // Partnership interactions table
  partnershipInteractions,
  type Contact,
  type InsertEvent,
  type InsertArchivedEvent,
  type InsertArchivedEventSpeaker,
  type InsertArchiveMedia,
  type InsertContact,
  type InsertTask,
  type InsertEventAttendee,
  type InsertEventInvitee,
  type InsertTaskTemplatePrerequisite,
  type InsertEventWorkflow,
  type InsertWorkflowTask,
  type InsertPartnershipType,
  type InsertAgreementType,
  type InsertPartnershipAgreement,
  type InsertPartnershipActivity,
  type InsertPartnershipContact,
  type InsertLead,
  type InsertLeadInteraction,
  type InsertPartnershipInteraction,
} from "@shared/schema.mssql";
import { and, eq, inArray, isNull, like, ne, or } from "drizzle-orm";
import { getAdminToken } from "./keycloakScriptUtils";
import { imageGenerator } from "../services/imageGenerator";
import { minioService } from "../services/minio";

const SAMPLE_SOURCE = "demo-script";
const SAMPLE_ARCHIVE_URL_PREFIX = "https://demo.eventcal.app/harvest/";
const ROOT_GROUP = "eventcal-demo";
const DEFAULT_PASSWORD = process.env.SAMPLE_USER_PASSWORD || "Eventcal!2025";
const KEYCLOAK_BASE_URL = `${process.env.KEYCLOAK_URL || "http://localhost:8080"}/admin/realms/${process.env.KEYCLOAK_REALM || "ecssr-events"}`;

type DepartmentSeed = {
  key: string;
  name: string;
  nameAr: string;
  ccList: string;
  keycloakPathSegments: string[];
  emails: Array<{ email: string; label: string; isPrimary?: boolean }>;
  requirements: Array<{
    title: string;
    titleAr: string;
    description: string;
    descriptionAr: string;
    notificationEmails: string[];
    isDefault?: boolean;
  }>;
  keycloakUsers: Array<{
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
  }>;
  taskTemplates: Array<{
    title: string;
    titleAr: string;
    description: string;
    descriptionAr: string;
    dueOffsetDays: number;
    priority?: 'high' | 'medium' | 'low';
    prerequisiteTitle?: string; // Title of the prerequisite task template (same or different department)
    prerequisiteDepartmentKey?: string; // If prerequisite is from a different department
  }>;
};

// Cross-department task template prerequisites for workflow demonstration
// Format: { taskTitle: string, taskDepartmentKey: string, prerequisiteTitle: string, prerequisiteDepartmentKey: string }
type CrossDepartmentPrerequisiteSeed = {
  taskTitle: string;
  taskDepartmentKey: string;
  prerequisiteTitle: string;
  prerequisiteDepartmentKey: string;
};

type EventAssignmentSeed = {
  departmentKey: string;
  selectedRequirementTitles: string[];
  dailyReminderTime: string;
};

type EventSpeakerSeed = {
  contactKey: string;
  role: string;
  roleAr?: string;
  displayOrder?: number;
};

type EventSeed = InsertEvent & {
  assignments: EventAssignmentSeed[];
  speakers?: EventSpeakerSeed[];
};

type ArchivedEventSpeakerSeed = {
  contactKey?: string;
  role: string;
  roleAr?: string;
  displayOrder?: number;
  speakerNameEn?: string;
  speakerNameAr?: string;
  speakerTitle?: string;
  speakerTitleAr?: string;
  speakerOrganization?: string;
  speakerOrganizationAr?: string;
  speakerPosition?: string;
  speakerPositionAr?: string;
};

type ArchivedEventSeed = Omit<InsertArchivedEvent, 'categoryId' | 'originalEventId'> & {
  category: string;
  originalEventName?: string;
  speakers: ArchivedEventSpeakerSeed[];
};

type PositionSeed = { key: string; nameEn: string; nameAr?: string };
type OrganizationSeed = { key: string; nameEn: string; nameAr?: string; countryCode?: string };
type ContactSeed = InsertContact & { key: string; organizationKey?: string; positionKey?: string };
type SeededContactInfo = {
  record: Contact;
  seed: ContactSeed;
  organizationName?: string;
  organizationNameAr?: string;
  positionName?: string;
  positionNameAr?: string;
};
const departmentSeeds: DepartmentSeed[] = [
  {
    key: "strategic-communications",
    name: "Strategic Communications Division",
    nameAr: "إدارة الاتصال الاستراتيجي",
    ccList: "leadership@eventcal.app",
    keycloakPathSegments: ["Demo Strategic Communications"],
    emails: [
      { email: "media.director@eventcal.app", label: "Director", isPrimary: true },
      { email: "press.desk@eventcal.app", label: "Press Desk" },
      { email: "visuals@eventcal.app", label: "Creative Lead" },
    ],
    requirements: [
      {
        title: "Arabic press release",
        titleAr: "بيان صحفي بالعربية",
        description: "Provide a full-length Arabic press release with quotes and key messages.",
        descriptionAr: "إعداد بيان صحفي متكامل باللغة العربية يتضمن اقتباسات ورسائل رئيسية.",
        notificationEmails: ["media.director@eventcal.app", "press.desk@eventcal.app"],
        isDefault: true,
      },
      {
        title: "Media briefing kit",
        titleAr: "حقيبة إعلامية",
        description: "Compile bios, talking points, and high-res images for spokespeople.",
        descriptionAr: "إعداد نبذات تعريفية ونقاط حديث وصور عالية الدقة للمتحدثين.",
        notificationEmails: ["press.desk@eventcal.app"],
      },
      {
        title: "Post-event coverage",
        titleAr: "متابعة التغطية الإعلامية",
        description: "Monitor coverage and deliver a bilingual report within 48 hours.",
        descriptionAr: "رصد التغطيات الإعلامية وتقديم تقرير ثنائي اللغة خلال ٤٨ ساعة.",
        notificationEmails: ["media.director@eventcal.app"],
      },
    ],
    keycloakUsers: [
      {
        username: "laila.hassan",
        email: "laila.hassan@eventcal.app",
        firstName: "Laila",
        lastName: "Hassan",
        jobTitle: "Director of Media Outreach",
      },
      {
        username: "khaled.saeed",
        email: "khaled.saeed@eventcal.app",
        firstName: "Khaled",
        lastName: "Saeed",
        jobTitle: "Senior Content Editor",
      },
    ],
    taskTemplates: [
      {
        title: "Draft bilingual press release",
        titleAr: "صياغة بيان صحفي ثنائي اللغة",
        description: "Prepare English and Arabic drafts tailored to {{eventName}}.",
        descriptionAr: "إعداد مسودة باللغتين الإنجليزية والعربية مخصصة لـ {{eventName}}.",
        dueOffsetDays: -14,
        // Depends on Translation: "Translate concept note" - 4-task cross-dept chain
        prerequisiteTitle: "Translate concept note",
        prerequisiteDepartmentKey: "research-translation",
      },
      {
        title: "Secure spokesperson quotes",
        titleAr: "تنسيق اقتباسات المتحدثين",
        description: "Collect approved quotes from keynote speakers.",
        descriptionAr: "جمع الاقتباسات المعتمدة من المتحدثين الرئيسيين.",
        dueOffsetDays: -12,
        prerequisiteTitle: "Draft bilingual press release",
      },
      {
        title: "Design media invitation",
        titleAr: "تصميم دعوة إعلامية",
        description: "Coordinate with creative team on branded invite for journalists.",
        descriptionAr: "التنسيق مع فريق التصميم لإعداد دعوة إعلامية تحمل هوية الحدث.",
        dueOffsetDays: -10,
        prerequisiteTitle: "Secure spokesperson quotes",
      },
      {
        title: "Brief spokespersons",
        titleAr: "إحاطة المتحدثين",
        description: "Share finalized talking points and rehearse transitions.",
        descriptionAr: "تزويد المتحدثين بنقاط الحديث النهائية وإجراء مراجعة سريعة.",
        dueOffsetDays: -7,
        // Depends on Translation: "Compile terminology list" - 2-task cross-dept chain
        prerequisiteTitle: "Compile terminology list",
        prerequisiteDepartmentKey: "research-translation",
      },
      {
        title: "Deploy live coverage plan",
        titleAr: "تنفيذ خطة التغطية المباشرة",
        description: "Coordinate live posts, stories, and photography cues.",
        descriptionAr: "تنسيق النشر المباشر والقصص والتوجيهات الفوتوغرافية.",
        dueOffsetDays: -1,
        // Depends on Digital Media: "Test live stream encoders" - 2-task cross-dept chain
        prerequisiteTitle: "Test live stream encoders",
        prerequisiteDepartmentKey: "digital-media",
      },
    ],
  },
  {
    key: "protocol-relations",
    name: "Protocol & Guest Relations",
    nameAr: "إدارة المراسم والضيوف",
    ccList: "protocol@eventcal.app",
    keycloakPathSegments: ["Demo Protocol and Guest Relations"],
    emails: [
      { email: "protocol.lead@eventcal.app", label: "Chief of Protocol", isPrimary: true },
      { email: "guestservices@eventcal.app", label: "Guest Services" },
    ],
    requirements: [
      {
        title: "VIP guest matrix",
        titleAr: "قائمة كبار الشخصيات",
        description: "Maintain confirmed VIP list with seating and convoy notes.",
        descriptionAr: "إعداد قائمة محدثة بكبار الشخصيات تتضمن تفاصيل المقاعد ومسارات المواكب.",
        notificationEmails: ["protocol.lead@eventcal.app"],
        isDefault: true,
      },
      {
        title: "Arrival coordination",
        titleAr: "تنسيق الاستقبال",
        description: "Share welcome scripts and signage requirements.",
        descriptionAr: "تحديد نصوص الترحيب واحتياجات اللافتات في نقاط الاستقبال.",
        notificationEmails: ["guestservices@eventcal.app"],
      },
      {
        title: "Gift protocol",
        titleAr: "هدايا المراسم",
        description: "Finalize commemorative gifts and delivery plan.",
        descriptionAr: "اعتماد الهدايا التذكارية وخطة توزيعها.",
        notificationEmails: ["protocol.lead@eventcal.app"],
      },
    ],
    keycloakUsers: [
      {
        username: "salem.ali",
        email: "salem.ali@eventcal.app",
        firstName: "Salem",
        lastName: "Ali",
        jobTitle: "Head of Protocol",
      },
      {
        username: "noor.mansour",
        email: "noor.mansour@eventcal.app",
        firstName: "Noor",
        lastName: "Mansour",
        jobTitle: "Guest Journey Specialist",
      },
    ],
    taskTemplates: [
      {
        title: "Confirm VIP seating map",
        titleAr: "اعتماد مخطط مقاعد كبار الشخصيات",
        description: "Update seating diagram with latest confirmations.",
        descriptionAr: "تحديث مخطط المقاعد بأحدث التأكيدات.",
        dueOffsetDays: -15,
        // Depends on Venue Ops: "Confirm venue floor plan" - 2-task cross-dept chain
        prerequisiteTitle: "Confirm venue floor plan",
        prerequisiteDepartmentKey: "venue-operations",
      },
      {
        title: "Issue arrival briefing",
        titleAr: "إصدار دليل الوصول",
        description: "Share arrivals manual with ushers and security.",
        descriptionAr: "مشاركة دليل الوصول مع المستقبلين والأمن.",
        dueOffsetDays: -11,
        prerequisiteTitle: "Confirm VIP seating map",
      },
      {
        title: "Coordinate convoy timings",
        titleAr: "تنسيق جداول المواكب",
        description: "Align vehicle schedules with Abu Dhabi Police escort team.",
        descriptionAr: "مواءمة جداول المركبات مع شرطة أبوظبي.",
        dueOffsetDays: -9,
        prerequisiteTitle: "Issue arrival briefing",
      },
      {
        title: "Prepare diplomatic gifts",
        titleAr: "تجهيز الهدايا الدبلوماسية",
        description: "Wrap gifts with bilingual cards and inventory tags.",
        descriptionAr: "تغليف الهدايا مع بطاقات ثنائية اللغة وعلامات الجرد.",
        dueOffsetDays: -6,
        prerequisiteTitle: "Confirm VIP seating map",
      },
      {
        title: "Run guest services rehearsal",
        titleAr: "إجراء بروفة لخدمات الضيوف",
        description: "Simulate arrival experience with ushers and volunteers.",
        descriptionAr: "محاكاة تجربة الوصول مع المستقبلين والمتطوعين.",
        dueOffsetDays: -3,
        // Depends on Venue Ops: "Conduct HSE walk-through" - 2-task cross-dept chain
        prerequisiteTitle: "Conduct HSE walk-through",
        prerequisiteDepartmentKey: "venue-operations",
      },
    ],
  },
  {
    key: "digital-media",
    name: "Digital Media Lab",
    nameAr: "مختبر الإعلام الرقمي",
    ccList: "digitallab@eventcal.app",
    keycloakPathSegments: ["Demo Digital Media Lab"],
    emails: [
      { email: "social.lead@eventcal.app", label: "Social Lead", isPrimary: true },
      { email: "studio@eventcal.app", label: "Studio Producer" },
      { email: "analytics@eventcal.app", label: "Analytics" },
    ],
    requirements: [
      {
        title: "Content calendar",
        titleAr: "تقويم المحتوى",
        description: "Publish Arabic/English posts schedule for all platforms.",
        descriptionAr: "إصدار جدول منشورات باللغتين لجميع المنصات.",
        notificationEmails: ["social.lead@eventcal.app"],
        isDefault: true,
      },
      {
        title: "Live streaming setup",
        titleAr: "إعداد البث المباشر",
        description: "Confirm multi-camera streaming workflow and backup.",
        descriptionAr: "تأكيد إعداد البث المتعدد الكاميرات وخطة النسخ الاحتياطي.",
        notificationEmails: ["studio@eventcal.app"],
      },
      {
        title: "Performance dashboard",
        titleAr: "لوحة مؤشرات الأداء",
        description: "Deliver next-day analytics snapshot in both languages.",
        descriptionAr: "تقديم تقرير تحليلي في اليوم التالي باللغتين.",
        notificationEmails: ["analytics@eventcal.app"],
      },
    ],
    keycloakUsers: [
      {
        username: "mariam.rahma",
        email: "mariam.rahma@eventcal.app",
        firstName: "Mariam",
        lastName: "Rahma",
        jobTitle: "Digital Strategy Lead",
      },
      {
        username: "yousef.aziz",
        email: "yousef.aziz@eventcal.app",
        firstName: "Yousef",
        lastName: "Aziz",
        jobTitle: "Senior Producer",
      },
    ],
    taskTemplates: [
      {
        title: "Build bilingual content calendar",
        titleAr: "إعداد تقويم محتوى ثنائي اللغة",
        description: "Map hero posts, carousels, and stories for {{eventName}}.",
        descriptionAr: "تخطيط المنشورات الأساسية والقصص الخاصة بـ {{eventName}}.",
        dueOffsetDays: -16,
        // Depends on Translation: "Translate concept note" - 2-task cross-dept chain
        prerequisiteTitle: "Translate concept note",
        prerequisiteDepartmentKey: "research-translation",
      },
      {
        title: "Produce teaser video",
        titleAr: "إنتاج فيديو ترويجي",
        description: "Edit 30-second clip highlighting speakers and agenda.",
        descriptionAr: "إنتاج مقطع ٣٠ ثانية يبرز المتحدثين والبرنامج.",
        dueOffsetDays: -13,
        prerequisiteTitle: "Build bilingual content calendar",
      },
      {
        title: "Schedule paid promotion",
        titleAr: "جدولة الإعلانات الممولة",
        description: "Book GCC geo-targeted ads with Arabic copy.",
        descriptionAr: "حجز حملات ممولة موجهة للخليج بنسخ عربية.",
        dueOffsetDays: -9,
        prerequisiteTitle: "Produce teaser video",
      },
      {
        title: "Test live stream encoders",
        titleAr: "اختبار أجهزة البث المباشر",
        description: "Run rehearsal with backup LTE bonding.",
        descriptionAr: "تنفيذ تجربة بث مع حلول النسخ الاحتياطي.",
        dueOffsetDays: -5,
        // Depends on Venue Ops: "Issue technical rider" - 2-task cross-dept chain
        prerequisiteTitle: "Issue technical rider",
        prerequisiteDepartmentKey: "venue-operations",
      },
      {
        title: "Draft analytics template",
        titleAr: "إعداد نموذج التحليلات",
        description: "Pre-build dashboard for next-day summary.",
        descriptionAr: "إعداد لوحة مؤشرات مسبقة لتقرير اليوم التالي.",
        dueOffsetDays: -2,
        prerequisiteTitle: "Test live stream encoders",
      },
    ],
  },
  {
    key: "research-translation",
    name: "Research Translation Office",
    nameAr: "مكتب الترجمة البحثية",
    ccList: "translation@eventcal.app",
    keycloakPathSegments: ["Demo Research Translation"],
    emails: [
      { email: "arabic.reviewer@eventcal.app", label: "Arabic Reviewer", isPrimary: true },
      { email: "simultaneous@eventcal.app", label: "Simultaneous Interpretation" },
    ],
    requirements: [
      {
        title: "Executive summary",
        titleAr: "ملخص تنفيذي",
        description: "Deliver Arabic summary of background papers.",
        descriptionAr: "إعداد ملخص تنفيذي بالعربية للأوراق المرجعية.",
        notificationEmails: ["arabic.reviewer@eventcal.app"],
        isDefault: true,
      },
      {
        title: "Terminology sheet",
        titleAr: "قائمة المصطلحات",
        description: "Validate bilingual glossary for interpreters.",
        descriptionAr: "اعتماد قائمة مصطلحات ثنائية اللغة للمترجمين.",
        notificationEmails: ["simultaneous@eventcal.app"],
      },
      {
        title: "Speaker bios translation",
        titleAr: "ترجمة سير المتحدثين",
        description: "Translate and proof bios within 48 hours of receipt.",
        descriptionAr: "ترجمة ومراجعة السير الذاتية خلال ٤٨ ساعة من الاستلام.",
        notificationEmails: ["arabic.reviewer@eventcal.app"],
      },
    ],
    keycloakUsers: [
      {
        username: "fatima.jaber",
        email: "fatima.jaber@eventcal.app",
        firstName: "Fatima",
        lastName: "Jaber",
        jobTitle: "Head of Arabic Editing",
      },
      {
        username: "ahmed.naji",
        email: "ahmed.naji@eventcal.app",
        firstName: "Ahmed",
        lastName: "Naji",
        jobTitle: "Terminology Specialist",
      },
    ],
    taskTemplates: [
      {
        title: "Translate concept note",
        titleAr: "ترجمة ورقة المفهوم",
        description: "Deliver final Arabic version for {{eventName}}.",
        descriptionAr: "تقديم النسخة العربية المعتمدة لـ {{eventName}}.",
        dueOffsetDays: -18,
        // No prerequisite - this is the START of many workflow chains
      },
      {
        title: "Compile terminology list",
        titleAr: "إعداد قائمة المصطلحات",
        description: "Validate bilingual glossary with research team.",
        descriptionAr: "اعتماد المصطلحات مع فريق البحث.",
        dueOffsetDays: -14,
        prerequisiteTitle: "Translate concept note",
      },
      {
        title: "Assign interpreters",
        titleAr: "تعيين المترجمين",
        description: "Confirm booth schedule and equipment needs.",
        descriptionAr: "تأكيد جدول المترجمين واحتياجات المعدات.",
        dueOffsetDays: -10,
        // Depends on Venue Ops: "Issue technical rider" for booth specs - 2-task cross-dept
        prerequisiteTitle: "Issue technical rider",
        prerequisiteDepartmentKey: "venue-operations",
      },
      {
        title: "Review presentation decks",
        titleAr: "مراجعة العروض التقديمية",
        description: "Proofread slides for bilingual accuracy.",
        descriptionAr: "مراجعة الشرائح لضمان الدقة الثنائية اللغة.",
        dueOffsetDays: -6,
        prerequisiteTitle: "Compile terminology list",
      },
      {
        title: "Deliver executive summary",
        titleAr: "تسليم الملخص التنفيذي",
        description: "Share Arabic summary with communications.",
        descriptionAr: "مشاركة الملخص مع فريق الاتصال.",
        dueOffsetDays: -4,
        prerequisiteTitle: "Review presentation decks",
      },
    ],
  },
  {
    key: "venue-operations",
    name: "Venue Operations & Logistics",
    nameAr: "إدارة العمليات اللوجستية",
    ccList: "operations@eventcal.app",
    keycloakPathSegments: ["Demo Venue Operations"],
    emails: [
      { email: "operations.lead@eventcal.app", label: "Operations Lead", isPrimary: true },
      { email: "stage.manager@eventcal.app", label: "Stage Manager" },
      { email: "catering@eventcal.app", label: "Catering" },
    ],
    requirements: [
      {
        title: "Floor plan & zoning",
        titleAr: "مخطط القاعة والمسارات",
        description: "Provide final CAD layout with Arabic signage notes.",
        descriptionAr: "إصدار المخطط النهائي مع تعليمات اللافتات العربية.",
        notificationEmails: ["operations.lead@eventcal.app"],
        isDefault: true,
      },
      {
        title: "Stage management rundown",
        titleAr: "جدول إدارة المسرح",
        description: "Share cue-to-cue rundown with stage team.",
        descriptionAr: "مشاركة جدول التنفيذ التفصيلي مع فريق المسرح.",
        notificationEmails: ["stage.manager@eventcal.app"],
      },
      {
        title: "Hospitality plan",
        titleAr: "خطة الضيافة",
        description: "Confirm menu, service style, and dietary labels.",
        descriptionAr: "اعتماد قائمة الضيافة ونمط الخدمة وملصقات الحمية.",
        notificationEmails: ["catering@eventcal.app"],
      },
    ],
    keycloakUsers: [
      {
        username: "omar.helal",
        email: "omar.helal@eventcal.app",
        firstName: "Omar",
        lastName: "Helal",
        jobTitle: "Head of Operations",
      },
      {
        username: "reem.salem",
        email: "reem.salem@eventcal.app",
        firstName: "Reem",
        lastName: "Salem",
        jobTitle: "Stage Director",
      },
    ],
    taskTemplates: [
      {
        title: "Issue technical rider",
        titleAr: "إصدار متطلبات التقنية",
        description: "Share staging, audio, and translation booth specs.",
        descriptionAr: "مشاركة متطلبات المسرح والصوت والترجمة.",
        dueOffsetDays: -20,
        // No prerequisite - this is the START of venue workflow chain
      },
      {
        title: "Confirm venue floor plan",
        titleAr: "اعتماد مخطط القاعة",
        description: "Align seating, exhibition pods, and media zone.",
        descriptionAr: "مواءمة المقاعد والمنصات ومنطقة الإعلام.",
        dueOffsetDays: -15,
        prerequisiteTitle: "Issue technical rider",
      },
      {
        title: "Lock catering brief",
        titleAr: "اعتماد خطة الضيافة",
        description: "Finalize menu with Arabic signage for dietary needs.",
        descriptionAr: "اعتماد القائمة مع لافتات الحمية بالعربية.",
        dueOffsetDays: -12,
        // Depends on Protocol: "Confirm VIP seating map" for guest counts - 3-task chain
        prerequisiteTitle: "Confirm VIP seating map",
        prerequisiteDepartmentKey: "protocol-relations",
      },
      {
        title: "Conduct HSE walk-through",
        titleAr: "جولة الصحة والسلامة",
        description: "Inspect emergency exits, ramps, and backstage routes.",
        descriptionAr: "تفقد مخارج الطوارئ والممرات الخلفية.",
        dueOffsetDays: -5,
        prerequisiteTitle: "Lock catering brief",
      },
      {
        title: "Run full technical rehearsal",
        titleAr: "تنفيذ بروفة تقنية كاملة",
        description: "Execute cue-to-cue with lighting and interpreters.",
        descriptionAr: "إجراء بروفة شاملة للإضاءة والمترجمين.",
        dueOffsetDays: -2,
        // Depends on Translation: "Assign interpreters" - part of 4-task cross-dept chain
        prerequisiteTitle: "Assign interpreters",
        prerequisiteDepartmentKey: "research-translation",
      },
    ],
  },
];
const organizationSeeds: OrganizationSeed[] = [
  { key: "ecssr-policy-center", nameEn: "ECSSR Policy Center", nameAr: "مركز سياسات المركز", countryCode: "AE" },
  { key: "uae-space-agency", nameEn: "UAE Space Agency", nameAr: "وكالة الإمارات للفضاء", countryCode: "AE" },
  { key: "gulf-resilience-council", nameEn: "Gulf Resilience Council", nameAr: "مجلس المرونة الخليجي", countryCode: "SA" },
  { key: "horizon-climate-network", nameEn: "Horizon Climate Network", nameAr: "شبكة أفق للمناخ", countryCode: "QA" },
  { key: "arab-youth-lab", nameEn: "Arab Youth Innovation Lab", nameAr: "مختبر الابتكار للشباب العربي", countryCode: "JO" },
  { key: "future-forums", nameEn: "Future Forums", nameAr: "حوارات المستقبل", countryCode: "GB" },
  { key: "maritime-safety-alliance", nameEn: "Maritime Safety Alliance", nameAr: "تحالف السلامة البحرية", countryCode: "OM" },
  { key: "uae-ministry-foreign", nameEn: "UAE Ministry of Foreign Affairs", nameAr: "وزارة الخارجية الإماراتية", countryCode: "AE" },
  { key: "dubai-future-foundation", nameEn: "Dubai Future Foundation", nameAr: "مؤسسة دبي للمستقبل", countryCode: "AE" },
  { key: "abudhabi-university", nameEn: "Abu Dhabi University", nameAr: "جامعة أبوظبي", countryCode: "AE" },
  { key: "sharjah-research-academy", nameEn: "Sharjah Research Academy", nameAr: "أكاديمية الشارقة للبحوث", countryCode: "AE" },
  { key: "gcc-business-council", nameEn: "GCC Business Council", nameAr: "مجلس أعمال الخليج", countryCode: "KW" },
  { key: "adnoc-sustainability", nameEn: "ADNOC Sustainability Division", nameAr: "قسم الاستدامة أدنوك", countryCode: "AE" },
  { key: "emirates-diplomatic-academy", nameEn: "Emirates Diplomatic Academy", nameAr: "أكاديمية الإمارات الدبلوماسية", countryCode: "AE" },
];

const positionSeeds: PositionSeed[] = [
  { key: "director-research", nameEn: "Director of Research", nameAr: "مدير الأبحاث" },
  { key: "chief-strategist", nameEn: "Chief Strategist", nameAr: "كبير الاستراتيجيين" },
  { key: "senior-fellow", nameEn: "Senior Fellow", nameAr: "زميل أول" },
  { key: "program-manager", nameEn: "Program Manager", nameAr: "مدير برنامج" },
  { key: "chief-innovation", nameEn: "Chief Innovation Officer", nameAr: "رئيس الابتكار" },
  { key: "policy-analyst", nameEn: "Policy Analyst", nameAr: "محلل سياسات" },
  { key: "executive-director", nameEn: "Executive Director", nameAr: "المدير التنفيذي" },
  { key: "head-protocol", nameEn: "Head of Protocol", nameAr: "رئيس المراسم" },
  { key: "lead-moderator", nameEn: "Lead Moderator", nameAr: "المحاور الرئيسي" },
  { key: "maritime-advisor", nameEn: "Maritime Security Advisor", nameAr: "مستشار أمن بحري" },
  { key: "research-associate", nameEn: "Research Associate", nameAr: "باحث مشارك" },
  { key: "communications-manager", nameEn: "Communications Manager", nameAr: "مدير الاتصالات" },
  { key: "deputy-director", nameEn: "Deputy Director", nameAr: "نائب المدير" },
  { key: "senior-advisor", nameEn: "Senior Advisor", nameAr: "مستشار أول" },
  { key: "project-coordinator", nameEn: "Project Coordinator", nameAr: "منسق مشروع" },
  { key: "assistant-professor", nameEn: "Assistant Professor", nameAr: "أستاذ مساعد" },
  { key: "sustainability-officer", nameEn: "Sustainability Officer", nameAr: "مسؤول الاستدامة" },
  { key: "public-relations", nameEn: "Public Relations Specialist", nameAr: "أخصائي علاقات عامة" },
];

const contactSeeds: ContactSeed[] = [
  {
    key: "samir-haddad",
    nameEn: "Dr. Samir Haddad",
    nameAr: "د. سمير حداد",
    title: "Dr.",
    organizationKey: "ecssr-policy-center",
    positionKey: "director-research",
    email: "samir.haddad@eventcal.app",
    phone: "+971-50-111-2233",
    isEligibleSpeaker: true,
  },
  {
    key: "noura-alsuwaidi",
    nameEn: "Noura Al Suwaidi",
    nameAr: "نورة السويدي",
    title: "HE",
    organizationKey: "gulf-resilience-council",
    positionKey: "chief-strategist",
    email: "noura.suwaidi@eventcal.app",
    phone: "+971-50-222-3344",
    isEligibleSpeaker: true,
  },
  {
    key: "rashid-alkaabi",
    nameEn: "Rashid Al Kaabi",
    nameAr: "راشد الكعبي",
    organizationKey: "uae-space-agency",
    positionKey: "program-manager",
    email: "rashid.kaabi@eventcal.app",
    phone: "+971-50-333-4455",
    isEligibleSpeaker: true,
  },
  {
    key: "lina-samir",
    nameEn: "Lina Samir",
    nameAr: "لينا سمير",
    title: "Prof.",
    organizationKey: "horizon-climate-network",
    positionKey: "senior-fellow",
    email: "lina.samir@eventcal.app",
    phone: "+971-50-444-5566",
    isEligibleSpeaker: true,
  },
  {
    key: "waleed-hosani",
    nameEn: "Waleed Al Hosani",
    nameAr: "وليد الحسني",
    organizationKey: "future-forums",
    positionKey: "lead-moderator",
    email: "waleed.hosani@eventcal.app",
    phone: "+971-50-555-6677",
    isEligibleSpeaker: true,
  },
  {
    key: "amira-nassar",
    nameEn: "Amira Nassar",
    nameAr: "أميرة نصار",
    title: "Eng.",
    organizationKey: "arab-youth-lab",
    positionKey: "chief-innovation",
    email: "amira.nassar@eventcal.app",
    phone: "+971-50-666-7788",
    isEligibleSpeaker: true,
  },
  {
    key: "faris-rahman",
    nameEn: "Faris Rahman",
    nameAr: "فارس رحمن",
    organizationKey: "horizon-climate-network",
    positionKey: "policy-analyst",
    email: "faris.rahman@eventcal.app",
    phone: "+971-50-777-8899",
    isEligibleSpeaker: true,
  },
  {
    key: "mariam-habib",
    nameEn: "Mariam Habib",
    nameAr: "مريم حبيب",
    title: "Dr.",
    organizationKey: "ecssr-policy-center",
    positionKey: "senior-fellow",
    email: "mariam.habib@eventcal.app",
    phone: "+971-50-888-9900",
    isEligibleSpeaker: true,
  },
  {
    key: "yousef-rahmani",
    nameEn: "Yousef Rahmani",
    nameAr: "يوسف رحماني",
    organizationKey: "maritime-safety-alliance",
    positionKey: "maritime-advisor",
    email: "yousef.rahmani@eventcal.app",
    phone: "+971-50-101-1122",
    isEligibleSpeaker: true,
  },
  {
    key: "fatima-haji",
    nameEn: "Fatima Al Haji",
    nameAr: "فاطمة الحاجي",
    organizationKey: "gulf-resilience-council",
    positionKey: "executive-director",
    email: "fatima.haji@eventcal.app",
    phone: "+971-50-131-4151",
    isEligibleSpeaker: true,
  },
  {
    key: "tariq-salem",
    nameEn: "Tariq Salem",
    nameAr: "طارق سالم",
    organizationKey: "future-forums",
    positionKey: "head-protocol",
    email: "tariq.salem@eventcal.app",
    phone: "+971-50-161-7181",
    isEligibleSpeaker: true,
  },
  {
    key: "hana-alharthy",
    nameEn: "Hana Al Harthy",
    nameAr: "هناء الحارثي",
    organizationKey: "arab-youth-lab",
    positionKey: "program-manager",
    email: "hana.harthy@eventcal.app",
    phone: "+971-50-191-9202",
    isEligibleSpeaker: true,
  },
  {
    key: "karim-mansour",
    nameEn: "Karim Mansour",
    nameAr: "كريم منصور",
    organizationKey: "maritime-safety-alliance",
    positionKey: "maritime-advisor",
    email: "karim.mansour@eventcal.app",
    phone: "+971-50-202-4040",
    isEligibleSpeaker: true,
  },
  {
    key: "salma-bakheet",
    nameEn: "Salma Bakheet",
    nameAr: "سلمى بخيت",
    organizationKey: "horizon-climate-network",
    positionKey: "program-manager",
    email: "salma.bakheet@eventcal.app",
    phone: "+971-50-232-4545",
    isEligibleSpeaker: true,
  },
  {
    key: "gamal-samir",
    nameEn: "Gamal Samir",
    nameAr: "جمال سمير",
    organizationKey: "future-forums",
    positionKey: "lead-moderator",
    email: "gamal.samir@eventcal.app",
    phone: "+971-50-262-5858",
    isEligibleSpeaker: true,
  },
];

// Generate additional 285 non-speaker contacts programmatically
const firstNames = [
  "Ahmed", "Mohammed", "Fatima", "Aisha", "Ali", "Hassan", "Zainab", "Omar", "Layla", "Khaled",
  "Maryam", "Abdullah", "Sara", "Ibrahim", "Noor", "Youssef", "Hana", "Hamza", "Rania", "Tariq",
  "Amina", "Rashid", "Leila", "Karim", "Yasmin", "Bilal", "Dina", "Mansour", "Safia", "Walid",
  "Nadia", "Majid", "Huda", "Faisal", "Lubna", "Samir", "Nawal", "Jamal", "Rana", "Tarek",
  "Samira", "Adel", "Hala", "Nasser", "Salma", "Zaid", "Jamila", "Murad", "Nour", "Fahad",
  "Latifa", "Basel", "Mona", "Saad", "Reem", "Talal", "Aziza", "Fares", "Hessa", "Mazen",
];

const lastNames = [
  "Al Mazrouei", "Al Falasi", "Al Mansouri", "Al Shamsi", "Al Nuaimi", "Al Dhaheri", "Al Muhairi",
  "Al Kaabi", "Al Marri", "Al Zaabi", "Al Hosani", "Al Suwaidi", "Al Blooshi", "Al Ketbi",
  "Al Ahbabi", "Al Mansoori", "Al Shehhi", "Al Mehairi", "Al Harthy", "Al Naqbi", "Al Junaibi",
  "Al Shamsi", "Al Hashimi", "Al Qubaisi", "Al Shamlan", "Al Rumaithi", "Al Marzouqi", "Al Raisi",
];

const generatedContacts: ContactSeed[] = [];
let emailCounter = 300; // Start from 300 to avoid conflicts

for (let i = 0; i < 285; i++) {
  const firstName = firstNames[i % firstNames.length];
  const lastName = lastNames[Math.floor(i / firstNames.length) % lastNames.length];
  const orgKeys = Object.keys(organizationSeeds);
  const posKeys = Object.keys(positionSeeds);
  
  emailCounter++;
  generatedContacts.push({
    key: `contact-${emailCounter}`,
    nameEn: `${firstName} ${lastName}`,
    nameAr: undefined, // Optional for non-speakers
    organizationKey: organizationSeeds[i % organizationSeeds.length].key,
    positionKey: positionSeeds[i % positionSeeds.length].key,
    email: `contact.${emailCounter}@eventcal.app`,
    phone: `+971-50-${String(emailCounter).padStart(3, '0')}-${String((i * 7) % 10000).padStart(4, '0')}`,
    isEligibleSpeaker: false, // These are attendees/invitees, not speakers
  });
}

// Combine speaker and non-speaker contacts
const allContactSeeds = [...contactSeeds, ...generatedContacts];

// Partnership Types seed data
type PartnershipTypeSeed = { key: string; nameEn: string; nameAr?: string };
const partnershipTypeSeeds: PartnershipTypeSeed[] = [
  { key: "strategic", nameEn: "Strategic Partnership", nameAr: "شراكة استراتيجية" },
  { key: "knowledge", nameEn: "Knowledge Partnership", nameAr: "شراكة معرفية" },
  { key: "media", nameEn: "Media Partnership", nameAr: "شراكة إعلامية" },
  { key: "event", nameEn: "Event Partnership", nameAr: "شراكة فعاليات" },
  { key: "research", nameEn: "Research Collaboration", nameAr: "تعاون بحثي" },
  { key: "academic", nameEn: "Academic Partnership", nameAr: "شراكة أكاديمية" },
  { key: "sponsorship", nameEn: "Sponsorship", nameAr: "رعاية" },
  { key: "government", nameEn: "Government Partnership", nameAr: "شراكة حكومية" },
];

type AgreementTypeSeed = { key: string; nameEn: string; nameAr?: string };
const agreementTypeSeeds: AgreementTypeSeed[] = [
  { key: "mou", nameEn: "MoU", nameAr: "مذكرة تفاهم" },
  { key: "nda", nameEn: "NDA", nameAr: "اتفاقية عدم إفشاء" },
  { key: "contract", nameEn: "Contract", nameAr: "عقد" },
  { key: "letter_of_intent", nameEn: "Letter of Intent", nameAr: "خطاب نوايا" },
  { key: "service_agreement", nameEn: "Service Agreement", nameAr: "اتفاقية خدمة" },
  { key: "collaboration_agreement", nameEn: "Collaboration Agreement", nameAr: "اتفاقية تعاون" },
  { key: "sponsorship_agreement", nameEn: "Sponsorship Agreement", nameAr: "اتفاقية رعاية" },
  { key: "other", nameEn: "Other", nameAr: "أخرى" },
];

// Organizations that are partners (for seeding partnership data on specific organizations)
type PartnerOrganizationSeed = {
  organizationKey: string;
  partnershipTypeKey: string;
  status: 'active' | 'pending' | 'suspended' | 'terminated';
  startDate: string;
  endDate?: string;
  agreementSignedBy: string;
  agreementSignedByUs: string;
  notes?: string;
  website?: string;
};
const partnerOrganizationSeeds: PartnerOrganizationSeed[] = [
  {
    organizationKey: "uae-space-agency",
    partnershipTypeKey: "strategic",
    status: "active",
    startDate: "2023-01-15",
    agreementSignedBy: "Dr. Salem Al Marri",
    agreementSignedByUs: "Dr. Jamal Al Suwaidi",
    notes: "Strategic partnership for space policy research and joint events.",
    website: "https://space.gov.ae",
  },
  {
    organizationKey: "dubai-future-foundation",
    partnershipTypeKey: "knowledge",
    status: "active",
    startDate: "2022-06-01",
    agreementSignedBy: "Khalfan Belhoul",
    agreementSignedByUs: "Dr. Jamal Al Suwaidi",
    notes: "Knowledge exchange and foresight studies collaboration.",
    website: "https://www.dubaifuture.gov.ae",
  },
  {
    organizationKey: "emirates-diplomatic-academy",
    partnershipTypeKey: "academic",
    status: "active",
    startDate: "2021-09-01",
    agreementSignedBy: "Bernardino Leon",
    agreementSignedByUs: "Dr. Jamal Al Suwaidi",
    notes: "Joint training programs and diplomatic research.",
    website: "https://eda.ac.ae",
  },
  {
    organizationKey: "gcc-business-council",
    partnershipTypeKey: "event",
    status: "active",
    startDate: "2024-03-01",
    agreementSignedBy: "Ahmed Al Rumaithi",
    agreementSignedByUs: "Dr. Jamal Al Suwaidi",
    notes: "Co-hosting business forums and economic conferences.",
    website: "https://gccbc.org",
  },
  {
    organizationKey: "sharjah-research-academy",
    partnershipTypeKey: "research",
    status: "pending",
    startDate: "2025-01-01",
    agreementSignedBy: "Dr. Nadia Al Hajj",
    agreementSignedByUs: "Dr. Jamal Al Suwaidi",
    notes: "Pending MoU for joint research initiatives.",
    website: "https://sra.ac.ae",
  },
  {
    organizationKey: "adnoc-sustainability",
    partnershipTypeKey: "sponsorship",
    status: "active",
    startDate: "2024-01-01",
    endDate: "2025-12-31",
    agreementSignedBy: "Musabbeh Al Kaabi",
    agreementSignedByUs: "Dr. Jamal Al Suwaidi",
    notes: "Platinum sponsor for climate and energy events.",
    website: "https://www.adnoc.ae/sustainability",
  },
];

// Partnership Agreement seeds
type PartnershipAgreementSeed = {
  organizationKey: string;
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  agreementTypeKey: string; // Key to look up in agreement types map
  signedDate?: string;
  effectiveDate?: string;
  expiryDate?: string;
  partnerSignatory?: string;
  partnerSignatoryTitle?: string;
  ourSignatory?: string;
  ourSignatoryTitle?: string;
  status: 'draft' | 'pending_approval' | 'active' | 'expired' | 'terminated';
};
const partnershipAgreementSeeds: PartnershipAgreementSeed[] = [
  {
    organizationKey: "uae-space-agency",
    title: "Strategic Partnership MoU - Space Policy Research",
    titleAr: "مذكرة تفاهم للشراكة الاستراتيجية - أبحاث سياسات الفضاء",
    description: "Memorandum of Understanding for joint space policy research, knowledge exchange, and event collaboration.",
    descriptionAr: "مذكرة تفاهم للبحث المشترك في سياسات الفضاء وتبادل المعرفة والتعاون في الفعاليات.",
    agreementTypeKey: "mou",
    signedDate: "2023-01-15",
    effectiveDate: "2023-02-01",
    partnerSignatory: "Dr. Salem Al Marri",
    partnerSignatoryTitle: "Director General",
    ourSignatory: "Dr. Jamal Al Suwaidi",
    ourSignatoryTitle: "Director General",
    status: "active",
  },
  {
    organizationKey: "uae-space-agency",
    title: "NDA for Mission Planning Data",
    titleAr: "اتفاقية عدم إفشاء لبيانات تخطيط المهمات",
    description: "Non-disclosure agreement covering sensitive mission planning data shared during joint research.",
    descriptionAr: "اتفاقية عدم إفشاء تغطي بيانات تخطيط المهمات الحساسة المشتركة خلال البحث المشترك.",
    agreementTypeKey: "nda",
    signedDate: "2023-01-20",
    effectiveDate: "2023-01-20",
    expiryDate: "2028-01-20",
    partnerSignatory: "Legal Department",
    ourSignatory: "Legal Department",
    status: "active",
  },
  {
    organizationKey: "dubai-future-foundation",
    title: "Knowledge Exchange Framework Agreement",
    titleAr: "اتفاقية إطار تبادل المعرفة",
    description: "Framework for sharing foresight methodologies, research outputs, and expert networks.",
    descriptionAr: "إطار لمشاركة منهجيات الاستشراف ومخرجات البحث وشبكات الخبراء.",
    agreementTypeKey: "collaboration_agreement",
    signedDate: "2022-06-01",
    effectiveDate: "2022-07-01",
    partnerSignatory: "Khalfan Belhoul",
    partnerSignatoryTitle: "CEO",
    ourSignatory: "Dr. Jamal Al Suwaidi",
    ourSignatoryTitle: "Director General",
    status: "active",
  },
  {
    organizationKey: "adnoc-sustainability",
    title: "Platinum Sponsorship Agreement 2024-2025",
    titleAr: "اتفاقية الرعاية البلاتينية ٢٠٢٤-٢٠٢٥",
    description: "Platinum tier sponsorship for all climate and energy-related events during 2024-2025.",
    descriptionAr: "رعاية من الدرجة البلاتينية لجميع الفعاليات المتعلقة بالمناخ والطاقة خلال ٢٠٢٤-٢٠٢٥.",
    agreementTypeKey: "sponsorship_agreement",
    signedDate: "2023-12-15",
    effectiveDate: "2024-01-01",
    expiryDate: "2025-12-31",
    partnerSignatory: "Musabbeh Al Kaabi",
    partnerSignatoryTitle: "CEO - Low Carbon Solutions",
    ourSignatory: "Dr. Jamal Al Suwaidi",
    ourSignatoryTitle: "Director General",
    status: "active",
  },
  {
    organizationKey: "gcc-business-council",
    title: "Event Co-Hosting Agreement",
    titleAr: "اتفاقية الاستضافة المشتركة للفعاليات",
    description: "Agreement to co-host business forums, roundtables, and economic conferences.",
    descriptionAr: "اتفاقية للاستضافة المشتركة لمنتديات الأعمال والموائد المستديرة والمؤتمرات الاقتصادية.",
    agreementTypeKey: "collaboration_agreement",
    signedDate: "2024-03-01",
    effectiveDate: "2024-03-15",
    partnerSignatory: "Ahmed Al Rumaithi",
    partnerSignatoryTitle: "Secretary General",
    ourSignatory: "Dr. Jamal Al Suwaidi",
    ourSignatoryTitle: "Director General",
    status: "active",
  },
  {
    organizationKey: "sharjah-research-academy",
    title: "Research Collaboration MoU (Draft)",
    titleAr: "مذكرة تفاهم التعاون البحثي (مسودة)",
    description: "Draft MoU for joint research projects on regional security and policy studies.",
    descriptionAr: "مسودة مذكرة تفاهم للمشاريع البحثية المشتركة حول الأمن الإقليمي ودراسات السياسات.",
    agreementTypeKey: "mou",
    effectiveDate: "2025-02-01",
    partnerSignatory: "Dr. Nadia Al Hajj",
    partnerSignatoryTitle: "Director",
    ourSignatory: "Dr. Jamal Al Suwaidi",
    ourSignatoryTitle: "Director General",
    status: "pending_approval",
  },
];

// Partnership Activity seeds
type PartnershipActivitySeed = {
  organizationKey: string;
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  activityType: 'joint_event' | 'sponsorship' | 'collaboration' | 'training' | 'exchange' | 'meeting' | 'other';
  startDate: string;
  endDate?: string;
  eventName?: string;
  outcome?: string;
  outcomeAr?: string;
  impactScore?: number;
};
const partnershipActivitySeeds: PartnershipActivitySeed[] = [
  {
    organizationKey: "uae-space-agency",
    title: "Conference on Future Space Policies - Joint Planning",
    titleAr: "مؤتمر سياسات الفضاء المستقبلية - التخطيط المشترك",
    description: "Joint event planning and speaker coordination for the Future Space Policies conference.",
    descriptionAr: "تخطيط مشترك للفعالية وتنسيق المتحدثين لمؤتمر سياسات الفضاء المستقبلية.",
    activityType: "joint_event",
    startDate: "2025-11-01",
    endDate: "2026-02-02",
    eventName: "Conference on Future Space Policies",
    outcome: "Successfully co-hosted conference with 300 attendees and signed letter of intent.",
    outcomeAr: "استضافة مشتركة ناجحة للمؤتمر مع ٣٠٠ مشارك وتوقيع خطاب نوايا.",
    impactScore: 5,
  },
  {
    organizationKey: "dubai-future-foundation",
    title: "Foresight Methodology Training Exchange",
    titleAr: "تبادل تدريب منهجيات الاستشراف",
    description: "Staff exchange program for foresight and futures research methodologies.",
    descriptionAr: "برنامج تبادل الموظفين لمنهجيات الاستشراف وأبحاث المستقبل.",
    activityType: "exchange",
    startDate: "2024-09-15",
    endDate: "2024-09-20",
    outcome: "10 researchers completed foresight certification program.",
    outcomeAr: "أكمل ١٠ باحثين برنامج شهادة الاستشراف.",
    impactScore: 4,
  },
  {
    organizationKey: "dubai-future-foundation",
    title: "Arab Knowledge Economy Lab Co-Design",
    titleAr: "التصميم المشترك لمختبر اقتصاد المعرفة العربي",
    description: "Joint curriculum design and mentor assignment for the youth innovation lab.",
    descriptionAr: "تصميم مشترك للمنهج وتعيين المرشدين لمختبر الابتكار للشباب.",
    activityType: "collaboration",
    startDate: "2025-09-01",
    endDate: "2025-11-06",
    eventName: "Arab Knowledge Economy Lab",
    outcome: "Integrated DFF innovation frameworks into lab curriculum.",
    outcomeAr: "دمج أطر ابتكار مؤسسة دبي للمستقبل في منهج المختبر.",
    impactScore: 4,
  },
  {
    organizationKey: "adnoc-sustainability",
    title: "Majlis on Climate Diplomacy - Platinum Sponsorship",
    titleAr: "مجلس الدبلوماسية المناخية - رعاية بلاتينية",
    description: "Platinum sponsorship providing venue support and sustainability expertise.",
    descriptionAr: "رعاية بلاتينية توفر دعم المكان وخبرة الاستدامة.",
    activityType: "sponsorship",
    startDate: "2025-10-22",
    endDate: "2025-10-22",
    eventName: "Majlis on Climate Diplomacy",
    outcome: "Full event coverage plus ADNOC exec keynote slot.",
    outcomeAr: "تغطية كاملة للفعالية بالإضافة إلى فرصة متحدث رئيسي لتنفيذي أدنوك.",
    impactScore: 5,
  },
  {
    organizationKey: "gcc-business-council",
    title: "Sustainability Finance Roundtable Co-Hosting",
    titleAr: "الاستضافة المشتركة لمائدة تمويل الاستدامة",
    description: "Joint hosting and participant outreach for the finance roundtable.",
    descriptionAr: "استضافة مشتركة وتواصل مع المشاركين للمائدة المستديرة للتمويل.",
    activityType: "joint_event",
    startDate: "2026-03-01",
    endDate: "2026-04-12",
    eventName: "Sustainability Finance Roundtable",
    outcome: "GCCBC brought 12 sovereign fund representatives to the discussion.",
    outcomeAr: "جلب مجلس أعمال الخليج ١٢ ممثلاً للصناديق السيادية للنقاش.",
    impactScore: 5,
  },
  {
    organizationKey: "emirates-diplomatic-academy",
    title: "Joint Diplomatic Training Module",
    titleAr: "وحدة تدريب دبلوماسي مشتركة",
    description: "Development of regional security analysis module for EDA diploma program.",
    descriptionAr: "تطوير وحدة تحليل الأمن الإقليمي لبرنامج دبلوم أكاديمية الإمارات الدبلوماسية.",
    activityType: "training",
    startDate: "2024-05-01",
    endDate: "2024-08-31",
    outcome: "Module adopted for 2025 academic year with 40 enrolled diplomats.",
    outcomeAr: "اعتماد الوحدة للعام الأكاديمي ٢٠٢٥ مع ٤٠ دبلوماسياً مسجلاً.",
    impactScore: 4,
  },
  {
    organizationKey: "sharjah-research-academy",
    title: "Partnership Discussion Meeting",
    titleAr: "اجتماع نقاش الشراكة",
    description: "Initial meeting to discuss research collaboration opportunities.",
    descriptionAr: "اجتماع أولي لمناقشة فرص التعاون البحثي.",
    activityType: "meeting",
    startDate: "2024-11-15",
    endDate: "2024-11-15",
    outcome: "Agreed to draft MoU for joint research projects.",
    outcomeAr: "الاتفاق على صياغة مذكرة تفاهم للمشاريع البحثية المشتركة.",
    impactScore: 3,
  },
];

// Partnership Contacts seeds
type PartnershipContactSeed = {
  organizationKey: string;
  contactKey: string;
  role: 'primary' | 'liaison' | 'technical' | 'executive' | 'other';
  roleAr?: string;
  isPrimary: boolean;
};
const partnershipContactSeeds: PartnershipContactSeed[] = [
  { organizationKey: "uae-space-agency", contactKey: "rashid-alkaabi", role: "technical", roleAr: "منسق تقني", isPrimary: false },
  { organizationKey: "gulf-resilience-council", contactKey: "noura-alsuwaidi", role: "executive", roleAr: "مسؤولة تنفيذية", isPrimary: true },
  { organizationKey: "gulf-resilience-council", contactKey: "fatima-haji", role: "liaison", roleAr: "منسقة ارتباط", isPrimary: false },
  { organizationKey: "horizon-climate-network", contactKey: "lina-samir", role: "primary", roleAr: "جهة اتصال رئيسية", isPrimary: true },
  { organizationKey: "horizon-climate-network", contactKey: "faris-rahman", role: "technical", roleAr: "منسق تقني", isPrimary: false },
  { organizationKey: "arab-youth-lab", contactKey: "amira-nassar", role: "primary", roleAr: "جهة اتصال رئيسية", isPrimary: true },
  { organizationKey: "arab-youth-lab", contactKey: "hana-alharthy", role: "liaison", roleAr: "منسقة ارتباط", isPrimary: false },
  { organizationKey: "future-forums", contactKey: "waleed-hosani", role: "executive", roleAr: "مسؤول تنفيذي", isPrimary: true },
  { organizationKey: "future-forums", contactKey: "gamal-samir", role: "liaison", roleAr: "منسق ارتباط", isPrimary: false },
  { organizationKey: "maritime-safety-alliance", contactKey: "yousef-rahmani", role: "primary", roleAr: "جهة اتصال رئيسية", isPrimary: true },
  { organizationKey: "maritime-safety-alliance", contactKey: "karim-mansour", role: "technical", roleAr: "منسق تقني", isPrimary: false },
];

// Lead seeds for lead management system
type LeadSeed = {
  key: string;
  name: string;
  nameAr?: string;
  email?: string;
  phone?: string;
  type: 'lead' | 'partner' | 'customer' | 'vendor' | 'other';
  status: 'active' | 'in_progress' | 'inactive';
  organizationName?: string;
  notes?: string;
  notesAr?: string;
};
const leadSeeds: LeadSeed[] = [
  {
    key: "lead-oxford-uni",
    name: "Prof. James Richardson",
    email: "j.richardson@ox.ac.uk",
    phone: "+44-1865-270000",
    type: "lead",
    status: "active",
    organizationName: "Oxford University - Middle East Centre",
    notes: "Interested in joint research on Gulf security studies. Met at Abu Dhabi Policy Forum.",
    notesAr: "مهتم بالبحث المشترك حول دراسات أمن الخليج. التقينا في منتدى أبوظبي للسياسات.",
  },
  {
    key: "lead-brookings",
    name: "Dr. Sarah Miller",
    nameAr: "د. سارة ميلر",
    email: "smiller@brookings.edu",
    phone: "+1-202-797-6000",
    type: "lead",
    status: "in_progress",
    organizationName: "Brookings Institution",
    notes: "Exploring partnership for Middle East policy research. Proposal under review.",
    notesAr: "استكشاف شراكة لأبحاث سياسات الشرق الأوسط. المقترح قيد المراجعة.",
  },
  {
    key: "lead-singapore-nrf",
    name: "Dr. Chen Wei Lin",
    email: "chen_wl@nrf.gov.sg",
    phone: "+65-6775-1788",
    type: "lead",
    status: "active",
    organizationName: "Singapore National Research Foundation",
    notes: "Potential collaboration on AI governance research. Initial discussions positive.",
    notesAr: "تعاون محتمل في أبحاث حوكمة الذكاء الاصطناعي. المناقشات الأولية إيجابية.",
  },
  {
    key: "lead-ksa-think-tank",
    name: "Dr. Abdullah Al Rashid",
    nameAr: "د. عبدالله الراشد",
    email: "alrashid@kprc.gov.sa",
    phone: "+966-11-482-0000",
    type: "lead",
    status: "in_progress",
    organizationName: "King Faisal Center for Research and Islamic Studies",
    notes: "MoU discussions ongoing for joint publications and researcher exchange.",
    notesAr: "مناقشات مذكرة تفاهم جارية للمنشورات المشتركة وتبادل الباحثين.",
  },
  {
    key: "lead-german-foundation",
    name: "Dr. Hans Mueller",
    email: "h.mueller@kas.de",
    phone: "+49-30-26996-0",
    type: "lead",
    status: "active",
    organizationName: "Konrad Adenauer Stiftung",
    notes: "Interested in co-hosting regional dialogue forums. Strong track record in GCC.",
    notesAr: "مهتم بالاستضافة المشتركة لمنتديات الحوار الإقليمي. سجل قوي في دول الخليج.",
  },
  {
    key: "lead-japan-institute",
    name: "Prof. Takeshi Yamamoto",
    email: "yamamoto@jiia.or.jp",
    phone: "+81-3-3503-7261",
    type: "lead",
    status: "active",
    organizationName: "Japan Institute of International Affairs",
    notes: "Potential partner for Indo-Pacific security studies collaboration.",
    notesAr: "شريك محتمل للتعاون في دراسات أمن المحيطين الهندي والهادئ.",
  },
  {
    key: "lead-media-company",
    name: "Fatima Al Harthi",
    nameAr: "فاطمة الحارثي",
    email: "f.harthi@skynewsarabia.com",
    phone: "+971-2-404-0000",
    type: "vendor",
    status: "active",
    organizationName: "Sky News Arabia",
    notes: "Media partnership discussions for event coverage and documentary production.",
    notesAr: "مناقشات شراكة إعلامية لتغطية الفعاليات وإنتاج الأفلام الوثائقية.",
  },
  {
    key: "lead-tech-sponsor",
    name: "Ahmed Khalifa",
    nameAr: "أحمد خليفة",
    email: "akhalifa@g42.ai",
    phone: "+971-2-654-0000",
    type: "lead",
    status: "in_progress",
    organizationName: "G42",
    notes: "Exploring AI lab sponsorship and tech partnership for digital transformation events.",
    notesAr: "استكشاف رعاية مختبر الذكاء الاصطناعي والشراكة التقنية لفعاليات التحول الرقمي.",
  },
  {
    key: "lead-french-institute",
    name: "Dr. Marie Dupont",
    email: "m.dupont@ifri.org",
    phone: "+33-1-40-61-60-00",
    type: "lead",
    status: "inactive",
    organizationName: "Institut français des relations internationales (IFRI)",
    notes: "Initial discussions held but paused due to scheduling conflicts. Resume in 2025.",
    notesAr: "عقدت مناقشات أولية لكنها توقفت بسبب تعارض المواعيد. الاستئناف في ٢٠٢٥.",
  },
  {
    key: "lead-indian-council",
    name: "Dr. Rajesh Kumar",
    email: "rkumar@icwa.in",
    phone: "+91-11-2301-7201",
    type: "lead",
    status: "active",
    organizationName: "Indian Council of World Affairs",
    notes: "Partnership potential for Gulf-India relations research track.",
    notesAr: "إمكانية شراكة لمسار أبحاث العلاقات الخليجية الهندية.",
  },
];

// Lead Interaction seeds
type LeadInteractionSeed = {
  leadKey: string;
  type: 'email' | 'phone_call' | 'meeting' | 'other';
  description: string;
  descriptionAr?: string;
  outcome?: string;
  outcomeAr?: string;
  interactionDate: string;
};
const leadInteractionSeeds: LeadInteractionSeed[] = [
  {
    leadKey: "lead-oxford-uni",
    type: "meeting",
    description: "Initial meeting at Abu Dhabi Policy Forum. Discussed potential research collaboration.",
    descriptionAr: "اجتماع أولي في منتدى أبوظبي للسياسات. ناقشنا التعاون البحثي المحتمل.",
    outcome: "Prof. Richardson expressed strong interest. Follow-up call scheduled.",
    outcomeAr: "أعرب البروفيسور ريتشاردسون عن اهتمام قوي. تم جدولة مكالمة متابعة.",
    interactionDate: "2024-10-15",
  },
  {
    leadKey: "lead-oxford-uni",
    type: "phone_call",
    description: "Follow-up call to discuss specific research areas and funding models.",
    descriptionAr: "مكالمة متابعة لمناقشة مجالات بحثية محددة ونماذج التمويل.",
    outcome: "Agreed to draft proposal outline for Gulf security studies program.",
    outcomeAr: "الاتفاق على صياغة مخطط مقترح لبرنامج دراسات أمن الخليج.",
    interactionDate: "2024-11-01",
  },
  {
    leadKey: "lead-brookings",
    type: "email",
    description: "Sent partnership proposal covering joint research, publications, and event co-hosting.",
    descriptionAr: "إرسال مقترح شراكة يغطي البحث المشترك والمنشورات والاستضافة المشتركة للفعاليات.",
    outcome: "Proposal acknowledged. Internal review process initiated at Brookings.",
    outcomeAr: "تم استلام المقترح. بدأت عملية المراجعة الداخلية في بروكينجز.",
    interactionDate: "2024-09-20",
  },
  {
    leadKey: "lead-brookings",
    type: "meeting",
    description: "Virtual meeting with Dr. Miller and Brookings Middle East team.",
    descriptionAr: "اجتماع افتراضي مع د. ميلر وفريق الشرق الأوسط في بروكينجز.",
    outcome: "Positive feedback. Requested additional details on researcher exchange program.",
    outcomeAr: "ردود فعل إيجابية. طلبوا تفاصيل إضافية عن برنامج تبادل الباحثين.",
    interactionDate: "2024-10-28",
  },
  {
    leadKey: "lead-singapore-nrf",
    type: "meeting",
    description: "Meeting during Singapore-UAE Innovation Week. Explored AI governance research partnership.",
    descriptionAr: "اجتماع خلال أسبوع الابتكار السنغافوري الإماراتي. استكشفنا شراكة أبحاث حوكمة الذكاء الاصطناعي.",
    outcome: "Dr. Chen committed to presenting partnership to NRF board in Q1 2025.",
    outcomeAr: "التزم د. تشين بعرض الشراكة على مجلس إدارة NRF في الربع الأول ٢٠٢٥.",
    interactionDate: "2024-11-10",
  },
  {
    leadKey: "lead-ksa-think-tank",
    type: "meeting",
    description: "Official delegation visit to discuss MoU framework and joint publication series.",
    descriptionAr: "زيارة وفد رسمي لمناقشة إطار مذكرة التفاهم وسلسلة المنشورات المشتركة.",
    outcome: "MoU draft approved by both parties. Final signing scheduled for January 2025.",
    outcomeAr: "اعتماد مسودة مذكرة التفاهم من الطرفين. التوقيع النهائي مقرر في يناير ٢٠٢٥.",
    interactionDate: "2024-12-05",
  },
  {
    leadKey: "lead-german-foundation",
    type: "email",
    description: "Initial outreach email introducing ECSSR and proposing collaboration areas.",
    descriptionAr: "بريد إلكتروني تواصل أولي للتعريف بالمركز واقتراح مجالات التعاون.",
    outcome: "Positive response received. Call scheduled to discuss GCC dialogue forums.",
    outcomeAr: "تم استلام رد إيجابي. تم جدولة مكالمة لمناقشة منتديات الحوار الخليجية.",
    interactionDate: "2024-10-05",
  },
  {
    leadKey: "lead-german-foundation",
    type: "phone_call",
    description: "Introductory call with Dr. Mueller to discuss regional dialogue programming.",
    descriptionAr: "مكالمة تعريفية مع د. مولر لمناقشة برمجة الحوار الإقليمي.",
    outcome: "Strong alignment on regional security topics. Site visit to Abu Dhabi proposed.",
    outcomeAr: "توافق قوي حول مواضيع الأمن الإقليمي. اقتراح زيارة ميدانية لأبوظبي.",
    interactionDate: "2024-10-20",
  },
  {
    leadKey: "lead-tech-sponsor",
    type: "meeting",
    description: "Meeting with G42 CSR team to explore AI lab sponsorship opportunities.",
    descriptionAr: "اجتماع مع فريق المسؤولية الاجتماعية في G42 لاستكشاف فرص رعاية مختبر الذكاء الاصطناعي.",
    outcome: "G42 requested detailed proposal for multi-year sponsorship package.",
    outcomeAr: "طلب G42 مقترحاً مفصلاً لحزمة رعاية متعددة السنوات.",
    interactionDate: "2024-11-25",
  },
  {
    leadKey: "lead-media-company",
    type: "meeting",
    description: "Meeting with Sky News Arabia to discuss media partnership for 2025 events.",
    descriptionAr: "اجتماع مع سكاي نيوز عربية لمناقشة الشراكة الإعلامية لفعاليات ٢٠٢٥.",
    outcome: "Agreed on preliminary terms for event coverage. Contract drafting underway.",
    outcomeAr: "الاتفاق على شروط أولية لتغطية الفعاليات. صياغة العقد جارية.",
    interactionDate: "2024-12-01",
  },
  {
    leadKey: "lead-french-institute",
    type: "email",
    description: "Exchange of introductory emails and capability presentations.",
    descriptionAr: "تبادل رسائل البريد الإلكتروني التعريفية وعروض القدرات.",
    outcome: "Initial interest confirmed but scheduling conflicts prevented progress.",
    outcomeAr: "تأكيد الاهتمام الأولي لكن تعارض المواعيد منع التقدم.",
    interactionDate: "2024-08-15",
  },
  {
    leadKey: "lead-indian-council",
    type: "email",
    description: "Partnership inquiry email sent to ICWA Research Director.",
    descriptionAr: "إرسال بريد استفسار عن الشراكة إلى مدير البحوث في ICWA.",
    outcome: "Positive response. Invitation to present at ICWA Gulf Forum in Delhi.",
    outcomeAr: "رد إيجابي. دعوة للتقديم في منتدى الخليج في ICWA بدلهي.",
    interactionDate: "2024-11-18",
  },
];

// Lead Task seeds
type LeadTaskSeed = {
  leadKey: string;
  departmentKey: string;
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'waiting';
  priority: 'high' | 'medium' | 'low';
  dueOffsetDays: number;
};
const leadTaskSeeds: LeadTaskSeed[] = [
  {
    leadKey: "lead-oxford-uni",
    departmentKey: "research-translation",
    title: "Draft research collaboration proposal",
    titleAr: "صياغة مقترح التعاون البحثي",
    description: "Prepare detailed proposal for Gulf security studies joint research program with Oxford.",
    descriptionAr: "إعداد مقترح مفصل لبرنامج البحث المشترك في دراسات أمن الخليج مع أكسفورد.",
    status: "in_progress",
    priority: "high",
    dueOffsetDays: 14,
  },
  {
    leadKey: "lead-oxford-uni",
    departmentKey: "strategic-communications",
    title: "Prepare partnership announcement materials",
    titleAr: "إعداد مواد إعلان الشراكة",
    description: "Draft press release and social media content for when partnership is finalized.",
    descriptionAr: "صياغة بيان صحفي ومحتوى وسائل التواصل الاجتماعي عند اكتمال الشراكة.",
    status: "waiting",
    priority: "medium",
    dueOffsetDays: 30,
  },
  {
    leadKey: "lead-brookings",
    departmentKey: "research-translation",
    title: "Compile researcher exchange program details",
    titleAr: "تجميع تفاصيل برنامج تبادل الباحثين",
    description: "Prepare comprehensive program description requested by Brookings team.",
    descriptionAr: "إعداد وصف شامل للبرنامج حسب طلب فريق بروكينجز.",
    status: "pending",
    priority: "high",
    dueOffsetDays: 7,
  },
  {
    leadKey: "lead-singapore-nrf",
    departmentKey: "research-translation",
    title: "Prepare AI governance research outline",
    titleAr: "إعداد مخطط بحث حوكمة الذكاء الاصطناعي",
    description: "Develop research outline covering AI ethics, policy frameworks, and regional applications.",
    descriptionAr: "تطوير مخطط بحثي يغطي أخلاقيات الذكاء الاصطناعي وأطر السياسات والتطبيقات الإقليمية.",
    status: "pending",
    priority: "medium",
    dueOffsetDays: 21,
  },
  {
    leadKey: "lead-ksa-think-tank",
    departmentKey: "protocol-relations",
    title: "Arrange MoU signing ceremony",
    titleAr: "ترتيب حفل توقيع مذكرة التفاهم",
    description: "Coordinate logistics for January 2025 MoU signing with King Faisal Center.",
    descriptionAr: "تنسيق لوجستيات توقيع مذكرة التفاهم في يناير ٢٠٢٥ مع مركز الملك فيصل.",
    status: "pending",
    priority: "high",
    dueOffsetDays: 30,
  },
  {
    leadKey: "lead-german-foundation",
    departmentKey: "venue-operations",
    title: "Prepare site visit itinerary",
    titleAr: "إعداد جدول الزيارة الميدانية",
    description: "Plan venue tours and meeting schedule for KAS delegation visit.",
    descriptionAr: "تخطيط جولات المرافق وجدول الاجتماعات لزيارة وفد مؤسسة كونراد أديناور.",
    status: "pending",
    priority: "medium",
    dueOffsetDays: 14,
  },
  {
    leadKey: "lead-tech-sponsor",
    departmentKey: "digital-media",
    title: "Create sponsorship proposal deck",
    titleAr: "إنشاء عرض مقترح الرعاية",
    description: "Design multi-year sponsorship package presentation for G42 leadership.",
    descriptionAr: "تصميم عرض حزمة الرعاية متعددة السنوات لقيادة G42.",
    status: "in_progress",
    priority: "high",
    dueOffsetDays: 10,
  },
  {
    leadKey: "lead-media-company",
    departmentKey: "strategic-communications",
    title: "Finalize media partnership contract",
    titleAr: "اعتماد عقد الشراكة الإعلامية",
    description: "Review and finalize contract terms with Sky News Arabia legal team.",
    descriptionAr: "مراجعة واعتماد شروط العقد مع الفريق القانوني لسكاي نيوز عربية.",
    status: "in_progress",
    priority: "high",
    dueOffsetDays: 7,
  },
  {
    leadKey: "lead-indian-council",
    departmentKey: "research-translation",
    title: "Prepare Gulf Forum presentation",
    titleAr: "إعداد عرض منتدى الخليج",
    description: "Develop presentation on UAE foreign policy perspectives for ICWA Delhi forum.",
    descriptionAr: "تطوير عرض حول وجهات نظر السياسة الخارجية الإماراتية لمنتدى ICWA في دلهي.",
    status: "pending",
    priority: "medium",
    dueOffsetDays: 45,
  },
  {
    leadKey: "lead-japan-institute",
    departmentKey: "research-translation",
    title: "Draft Indo-Pacific research concept note",
    titleAr: "صياغة ورقة مفهوم أبحاث المحيط الهندي والهادئ",
    description: "Prepare concept note for potential joint research on Indo-Pacific security dynamics.",
    descriptionAr: "إعداد ورقة مفهوم للبحث المشترك المحتمل حول ديناميكيات أمن المحيط الهندي والهادئ.",
    status: "pending",
    priority: "low",
    dueOffsetDays: 60,
  },
];

// Partnership Interaction seeds
type PartnershipInteractionSeed = {
  partnershipKey: string;
  type: 'email' | 'phone_call' | 'meeting' | 'document_sent' | 'proposal_submitted' | 'review_session' | 'other';
  description: string;
  descriptionAr?: string;
  outcome?: string;
  outcomeAr?: string;
  interactionDate: string;
};

const partnershipInteractionSeeds: PartnershipInteractionSeed[] = [
  {
    partnershipKey: "oxford-university",
    type: "meeting",
    description: "Quarterly steering committee meeting to review Gulf security studies program progress.",
    descriptionAr: "اجتماع اللجنة التوجيهية ربع السنوية لمراجعة تقدم برنامج دراسات أمن الخليج.",
    outcome: "Approved 2025 research agenda. Budget increase of 15% authorized.",
    outcomeAr: "اعتماد جدول الأبحاث لعام 2025. تم تفويض زيادة الميزانية بنسبة 15%.",
    interactionDate: "2024-12-10",
  },
  {
    partnershipKey: "brookings",
    type: "document_sent",
    description: "Sent joint publication draft on GCC economic diversification strategies.",
    descriptionAr: "إرسال مسودة المنشور المشترك حول استراتيجيات التنويع الاقتصادي بدول مجلس التعاون.",
    outcome: "Positive feedback received. Minor revisions requested for publication.",
    outcomeAr: "تم استلام ردود فعل إيجابية. تم طلب تعديلات طفيفة للنشر.",
    interactionDate: "2024-11-20",
  },
  {
    partnershipKey: "brookings",
    type: "review_session",
    description: "Joint editorial review session for Middle East monitoring report.",
    descriptionAr: "جلسة مراجعة تحريرية مشتركة لتقرير مراقبة الشرق الأوسط.",
    outcome: "Finalized editorial comments. Report ready for publication in January 2025.",
    outcomeAr: "تم إنهاء التعليقات التحريرية. التقرير جاهز للنشر في يناير 2025.",
    interactionDate: "2024-12-05",
  },
  {
    partnershipKey: "singapore-nrf",
    type: "proposal_submitted",
    description: "Submitted AI governance research proposal for NRF funding consideration.",
    descriptionAr: "تقديم مقترح بحث حوكمة الذكاء الاصطناعي للنظر فيه من قبل NRF.",
    outcome: "Proposal under review. Decision expected by Q1 2025.",
    outcomeAr: "المقترح تحت المراجعة. من المتوقع الحصول على القرار بحلول الربع الأول 2025.",
    interactionDate: "2024-10-30",
  },
  {
    partnershipKey: "singapore-nrf",
    type: "phone_call",
    description: "Follow-up call with NRF Board Secretary regarding proposal status.",
    descriptionAr: "مكالمة متابعة مع أمين مجلس إدارة NRF بشأن حالة المقترح.",
    outcome: "Proposal moving to final review stage. Presentation to board scheduled.",
    outcomeAr: "ينتقل المقترح إلى مرحلة المراجعة النهائية. تم جدولة العرض على المجلس.",
    interactionDate: "2024-11-25",
  },
  {
    partnershipKey: "ksa-think-tank",
    type: "document_sent",
    description: "Sent finalized MoU document with signature pages to Saudi think tank.",
    descriptionAr: "إرسال وثيقة مذكرة التفاهم النهائية مع صفحات التوقيع إلى مركز البحوث السعودي.",
    outcome: "MoU signed by both parties. Cooperation framework now officially active.",
    outcomeAr: "تم التوقيع على مذكرة التفاهم من الطرفين. إطار التعاون الآن نشط رسمياً.",
    interactionDate: "2025-01-15",
  },
  {
    partnershipKey: "german-foundation",
    type: "meeting",
    description: "Site visit of German foundation delegation to Abu Dhabi. Facility tours and research briefings.",
    descriptionAr: "زيارة ميدانية لوفد المؤسسة الألمانية إلى أبوظبي. جولات المرافق وإحاطات البحوث.",
    outcome: "Delegation impressed with capabilities. Dialog program funding approved.",
    outcomeAr: "انطباع إيجابي من الوفد حول القدرات. تم اعتماد تمويل برنامج الحوار.",
    interactionDate: "2024-11-18",
  },
  {
    partnershipKey: "tech-sponsor-g42",
    type: "proposal_submitted",
    description: "Submitted comprehensive AI lab sponsorship proposal with 3-year roadmap.",
    descriptionAr: "تقديم مقترح شامل لرعاية مختبر الذكاء الاصطناعي مع خريطة الطريق لمدة 3 سنوات.",
    outcome: "Proposal under G42 leadership review. Decision by end of Q4 2024.",
    outcomeAr: "المقترح قيد مراجعة قيادة G42. القرار بحلول نهاية الربع الرابع 2024.",
    interactionDate: "2024-12-08",
  },
  {
    partnershipKey: "media-partner-sky-news",
    type: "document_sent",
    description: "Sent media partnership agreement draft covering 2025 event coverage terms.",
    descriptionAr: "إرسال مسودة اتفاقية الشراكة الإعلامية التي تغطي شروط تغطية فعاليات 2025.",
    outcome: "Contract under legal review. Expected signature January 2025.",
    outcomeAr: "العقد تحت المراجعة القانونية. من المتوقع التوقيع في يناير 2025.",
    interactionDate: "2024-12-12",
  },
  {
    partnershipKey: "indian-council",
    type: "meeting",
    description: "Virtual meeting to confirm ECSSR presentation at ICWA Gulf Forum in New Delhi.",
    descriptionAr: "اجتماع افتراضي لتأكيد عرض تقديمي من المركز في منتدى الخليج في ICWA في نيودلهي.",
    outcome: "Confirmed speaking slot for senior researcher. Travel arrangements initiated.",
    outcomeAr: "تأكيد فتحة التحدث لباحث أول. بدء ترتيبات السفر.",
    interactionDate: "2024-12-01",
  },
];

// Partnership Task seeds
type PartnershipTaskSeed = {
  partnershipKey: string;
  departmentKey: string;
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'waiting';
  priority: 'high' | 'medium' | 'low';
  dueOffsetDays: number;
};

const partnershipTaskSeeds: PartnershipTaskSeed[] = [
  {
    partnershipKey: "oxford-university",
    departmentKey: "international-relations",
    title: "Prepare 2025 research agenda presentation for Oxford steering committee",
    titleAr: "إعداد عرض جدول الأبحاث لعام 2025 لجنة التوجيه في أوكسفورد",
    description: "Compile research priorities, budget requirements, and timeline for annual steering committee meeting.",
    descriptionAr: "تجميع أولويات البحث والمتطلبات المالية والجدول الزمني لاجتماع لجنة التوجيه السنوية.",
    status: "completed",
    priority: "high",
    dueOffsetDays: -5,
  },
  {
    partnershipKey: "brookings",
    departmentKey: "international-relations",
    title: "Review and finalize joint GCC economic analysis publication",
    titleAr: "مراجعة وإنهاء نشر تحليل اقتصادي مشترك حول دول الخليج",
    description: "Complete editorial review and incorporate feedback for joint publication on GCC diversification.",
    descriptionAr: "إكمال المراجعة التحريرية ودمج الملاحظات لنشر مشترك حول تنويع دول مجلس التعاون.",
    status: "in_progress",
    priority: "high",
    dueOffsetDays: 20,
  },
  {
    partnershipKey: "singapore-nrf",
    departmentKey: "research-translation",
    title: "Prepare presentation materials for NRF board AI governance proposal",
    titleAr: "إعداد مواد العرض التقديمي لاقتراح حوكمة الذكاء الاصطناعي أمام مجلس NRF",
    description: "Develop comprehensive presentation deck for AI governance research proposal to NRF leadership.",
    descriptionAr: "تطوير مجموعة عرض شاملة لمقترح بحث حوكمة الذكاء الاصطناعي لقيادة NRF.",
    status: "in_progress",
    priority: "high",
    dueOffsetDays: 15,
  },
  {
    partnershipKey: "ksa-think-tank",
    departmentKey: "international-relations",
    title: "Establish MoU governance structure and coordination mechanisms",
    titleAr: "إنشاء هيكل حوكمة مذكرة التفاهم وآليات التنسيق",
    description: "Set up governance committees and establish regular coordination schedule per MoU framework.",
    descriptionAr: "إنشاء لجان الحوكمة وإقامة جدول التنسيق الدوري وفقاً لإطار مذكرة التفاهم.",
    status: "pending",
    priority: "high",
    dueOffsetDays: 30,
  },
  {
    partnershipKey: "german-foundation",
    departmentKey: "international-relations",
    title: "Develop detailed GCC dialogue program proposal per foundation requirements",
    titleAr: "تطوير مقترح برنامج حوار مفصل حول دول الخليج وفقاً لمتطلبات المؤسسة",
    description: "Draft comprehensive proposal for multi-year GCC dialogue program with budget and deliverables.",
    descriptionAr: "صياغة مقترح شامل لبرنامج حوار متعدد السنوات حول دول الخليج مع الميزانية والمخرجات.",
    status: "in_progress",
    priority: "high",
    dueOffsetDays: 25,
  },
  {
    partnershipKey: "tech-sponsor-g42",
    departmentKey: "research-translation",
    title: "Finalize AI lab sponsorship agreement negotiations with G42",
    titleAr: "إنهاء مفاوضات اتفاقية رعاية مختبر الذكاء الاصطناعي مع G42",
    description: "Complete contract negotiations and secure signatures for AI lab sponsorship deal.",
    descriptionAr: "إكمال مفاوضات العقد والحصول على التوقيعات لاتفاقية رعاية مختبر الذكاء الاصطناعي.",
    status: "in_progress",
    priority: "high",
    dueOffsetDays: 35,
  },
  {
    partnershipKey: "media-partner-sky-news",
    departmentKey: "events",
    title: "Execute media partnership agreement with Sky News Arabia",
    titleAr: "تنفيذ اتفاقية الشراكة الإعلامية مع سكاي نيوز عربية",
    description: "Complete contract signature and establish media coverage coordination procedures.",
    descriptionAr: "إكمال توقيع العقد وإنشاء إجراءات تنسيق التغطية الإعلامية.",
    status: "pending",
    priority: "medium",
    dueOffsetDays: 40,
  },
  {
    partnershipKey: "indian-council",
    departmentKey: "international-relations",
    title: "Arrange speaker participation in ICWA Gulf Forum in New Delhi",
    titleAr: "ترتيب مشاركة المتحدث في منتدى الخليج في ICWA في نيودلهي",
    description: "Confirm speaker, arrange travel, prepare presentation materials for ICWA forum event.",
    descriptionAr: "تأكيد المتحدث وترتيب السفر وإعداد مواد العرض التقديمي لحدث منتدى ICWA.",
    status: "in_progress",
    priority: "medium",
    dueOffsetDays: 45,
  },
];

const categorySeeds = [
  { nameEn: "Policy Forum", nameAr: "ملتقى السياسات" },
  { nameEn: "Book Launch", nameAr: "حفل إصدار كتاب" },
  { nameEn: "Youth Lab", nameAr: "مختبر الشباب" },
  { nameEn: "Training Program", nameAr: "برنامج تدريبي" },
  { nameEn: "Public Lecture", nameAr: "محاضرة عامة" },
];
const eventSeeds: EventSeed[] = [
  {
    name: "Gulf Food Security Futures Forum",
    nameAr: "منتدى آفاق الأمن الغذائي في الخليج",
    description: "A strategic dialogue on resilient food systems featuring ministers and agritech CEOs.",
    descriptionAr: "حوار استراتيجي حول منظومات الغذاء المرنة بمشاركة وزراء ومديري شركات التكنولوجيا الزراعية.",
    startDate: "2025-10-10",
    endDate: "2025-10-10",
    startTime: "09:30",
    endTime: "16:30",
    location: "ECSSR Conference Hall, Abu Dhabi",
    locationAr: "قاعة مؤتمرات المركز، أبوظبي",
    organizers: "ECSSR Policy Center",
    organizersAr: "مركز السياسات في المركز",
    url: "https://ecssr.ae/ar/events/gulf-food-security-forum-2025",
    category: "Policy Forum",
    categoryAr: "ملتقى السياسات",
    categoryId: undefined,
    eventType: "international",
    eventScope: "external",
    expectedAttendance: 220,
    isScraped: false,
    source: SAMPLE_SOURCE,
    externalId: "demo-food-security-2025",
    adminModified: true,
    reminder1Week: true,
    reminder1Day: true,
    reminderWeekly: true,
    reminderDaily: true,
    reminderMorningOf: true,
    assignments: [
      {
        departmentKey: "strategic-communications",
        selectedRequirementTitles: ["Arabic press release", "Media briefing kit"],
        dailyReminderTime: "08:30",
      },
      {
        departmentKey: "protocol-relations",
        selectedRequirementTitles: ["VIP guest matrix", "Arrival coordination"],
        dailyReminderTime: "09:15",
      },
      {
        departmentKey: "venue-operations",
        selectedRequirementTitles: ["Floor plan & zoning", "Hospitality plan"],
        dailyReminderTime: "08:45",
      },
    ],
    speakers: [
      { contactKey: "samir-haddad", role: "Keynote", roleAr: "متحدث رئيسي", displayOrder: 1 },
      { contactKey: "noura-alsuwaidi", role: "Panelist", roleAr: "محاورة", displayOrder: 2 },
      { contactKey: "mariam-habib", role: "Moderator", roleAr: "مديرة الجلسة", displayOrder: 3 },
    ],
  },
  {
    name: "Arab Knowledge Economy Lab",
    nameAr: "مختبر اقتصاد المعرفة العربي",
    description: "Interactive youth lab exploring AI adoption in public services with rapid prototyping.",
    descriptionAr: "مختبر شبابي تفاعلي يستكشف تطبيقات الذكاء الاصطناعي في الخدمات الحكومية عبر نماذج أولية سريعة.",
    startDate: "2025-11-05",
    endDate: "2025-11-06",
    startTime: "10:00",
    endTime: "17:00",
    location: "Innovation Hub, ECSSR",
    locationAr: "مركز الابتكار في المركز",
    organizers: "ECSSR Innovation Directorate",
    organizersAr: "إدارة الابتكار في المركز",
    url: "https://ecssr.ae/ar/events/arab-knowledge-economy-lab-2025",
    category: "Youth Lab",
    categoryAr: "مختبر الشباب",
    categoryId: undefined,
    eventType: "local",
    eventScope: "internal",
    expectedAttendance: 150,
    isScraped: false,
    source: SAMPLE_SOURCE,
    externalId: "demo-knowledge-lab-2025",
    adminModified: true,
    reminder1Week: true,
    reminder1Day: true,
    reminderWeekly: true,
    reminderDaily: true,
    reminderMorningOf: true,
    assignments: [
      {
        departmentKey: "digital-media",
        selectedRequirementTitles: ["Content calendar", "Live streaming setup"],
        dailyReminderTime: "08:00",
      },
      {
        departmentKey: "venue-operations",
        selectedRequirementTitles: ["Floor plan & zoning", "Stage management rundown"],
        dailyReminderTime: "08:20",
      },
      {
        departmentKey: "research-translation",
        selectedRequirementTitles: ["Terminology sheet", "Speaker bios translation"],
        dailyReminderTime: "09:10",
      },
    ],
  },
  {
    name: "Majlis on Climate Diplomacy",
    nameAr: "مجلس الدبلوماسية المناخية",
    description: "Fireside discussion on COP30 deliverables with regional envoys and think tanks.",
    descriptionAr: "جلسة حوارية حول مخرجات مؤتمر المناخ مع مبعوثين إقليميين ومراكز أبحاث.",
    startDate: "2025-10-22",
    endDate: "2025-10-22",
    startTime: "18:00",
    endTime: "20:00",
    location: "Heritage Majlis, ECSSR",
    locationAr: "مجلس التراث في المركز",
    organizers: "ECSSR Sustainability Platform",
    organizersAr: "منصة الاستدامة في المركز",
    url: "https://ecssr.ae/ar/events/climate-diplomacy-majlis-2025",
    category: "Public Lecture",
    categoryAr: "محاضرة عامة",
    categoryId: undefined,
    eventType: "international",
    eventScope: "external",
    expectedAttendance: 120,
    isScraped: false,
    source: SAMPLE_SOURCE,
    externalId: "demo-climate-majlis-2025",
    adminModified: true,
    reminder1Week: true,
    reminder1Day: true,
    reminderWeekly: true,
    reminderDaily: true,
    reminderMorningOf: true,
    assignments: [
      {
        departmentKey: "protocol-relations",
        selectedRequirementTitles: ["VIP guest matrix", "Gift protocol"],
        dailyReminderTime: "09:40",
      },
      {
        departmentKey: "strategic-communications",
        selectedRequirementTitles: ["Arabic press release", "Post-event coverage"],
        dailyReminderTime: "08:50",
      },
    ],
  },
  {
    name: "Book Launch: مستقبل الدبلوماسية الرقمية",
    nameAr: "حفل إصدار كتاب مستقبل الدبلوماسية الرقمية",
    description: "Launch event highlighting ECSSR's latest Arabic title on digital diplomacy tools.",
    descriptionAr: "حفل لإطلاق أحدث إصدارات المركز حول أدوات الدبلوماسية الرقمية.",
    startDate: "2025-12-02",
    endDate: "2025-12-02",
    startTime: "11:00",
    endTime: "13:00",
    location: "ECSSR Library Theatre",
    locationAr: "مسرح مكتبة المركز",
    organizers: "Publishing Department",
    organizersAr: "إدارة النشر",
    url: "https://ecssr.ae/ar/events/digital-diplomacy-book-launch",
    category: "Book Launch",
    categoryAr: "حفل إصدار كتاب",
    categoryId: undefined,
    eventType: "local",
    eventScope: "external",
    expectedAttendance: 180,
    isScraped: false,
    source: SAMPLE_SOURCE,
    externalId: "demo-book-launch-2025",
    adminModified: true,
    reminder1Week: true,
    reminder1Day: true,
    reminderWeekly: true,
    reminderDaily: true,
    reminderMorningOf: true,
    assignments: [
      {
        departmentKey: "digital-media",
        selectedRequirementTitles: ["Content calendar", "Performance dashboard"],
        dailyReminderTime: "08:05",
      },
      {
        departmentKey: "research-translation",
        selectedRequirementTitles: ["Executive summary", "Speaker bios translation"],
        dailyReminderTime: "09:00",
      },
      {
        departmentKey: "protocol-relations",
        selectedRequirementTitles: ["Arrival coordination", "Gift protocol"],
        dailyReminderTime: "09:25",
      },
    ],
    speakers: [
      { contactKey: "lina-samir", role: "Moderator", roleAr: "محاورة", displayOrder: 1 },
      { contactKey: "faris-rahman", role: "Panelist", roleAr: "متحدث", displayOrder: 2 },
      { contactKey: "fatima-haji", role: "Respondent", roleAr: "مداخلة", displayOrder: 3 },
    ],
  },
  {
    name: "Strategic Gaming Workshop on Red Sea Security",
    nameAr: "ورشة المحاكاة الاستراتيجية لأمن البحر الأحمر",
    description: "Scenario-based simulation engaging defense colleges and maritime experts.",
    descriptionAr: "محاكاة قائمة على السيناريوهات بمشاركة كليات الدفاع وخبراء الملاحة.",
    startDate: "2026-01-14",
    endDate: "2026-01-15",
    startTime: "09:00",
    endTime: "18:00",
    location: "Joint Simulation Center, ECSSR",
    locationAr: "مركز المحاكاة المشترك في المركز",
    organizers: "Security & Defense Program",
    organizersAr: "برنامج الأمن والدفاع",
    url: "https://ecssr.ae/ar/events/red-sea-security-workshop",
    category: "Training Program",
    categoryAr: "برنامج تدريبي",
    categoryId: undefined,
    eventType: "international",
    eventScope: "internal",
    expectedAttendance: 90,
    isScraped: false,
    source: SAMPLE_SOURCE,
    externalId: "demo-redsea-workshop-2025",
    adminModified: true,
    reminder1Week: true,
    reminder1Day: true,
    reminderWeekly: true,
    reminderDaily: true,
    reminderMorningOf: true,
    assignments: [
      {
        departmentKey: "venue-operations",
        selectedRequirementTitles: ["Floor plan & zoning", "Stage management rundown"],
        dailyReminderTime: "07:45",
      },
      {
        departmentKey: "research-translation",
        selectedRequirementTitles: ["Terminology sheet", "Executive summary"],
        dailyReminderTime: "09:05",
      },
    ],
    speakers: [
      { contactKey: "yousef-rahmani", role: "Scenario Lead", roleAr: "قائد السيناريو", displayOrder: 1 },
      { contactKey: "karim-mansour", role: "Naval Analyst", roleAr: "محلل بحري", displayOrder: 2 },
      { contactKey: "tariq-salem", role: "Protocol Brief", roleAr: "إيجاز المراسم", displayOrder: 3 },
    ],
  },
  {
    name: "Majlis الشباب والسياسة الصناعية",
    nameAr: "مجلس الشباب والسياسة الصناعية",
    description: "Youth policymakers debate industrial competitiveness with Emirati founders.",
    descriptionAr: "مناظرة بين صناع السياسات الشباب ورواد الأعمال الإماراتيين حول تنافسية الصناعة.",
    startDate: "2025-11-20",
    endDate: "2025-11-20",
    startTime: "17:00",
    endTime: "20:30",
    location: "Youth Circle Hub, Abu Dhabi",
    locationAr: "مجلس الشباب في أبوظبي",
    organizers: "Youth Engagement Office",
    organizersAr: "مكتب تمكين الشباب",
    url: "https://ecssr.ae/ar/events/industrial-policy-youth-majlis",
    category: "Youth Lab",
    categoryAr: "مختبر الشباب",
    categoryId: undefined,
    eventType: "local",
    eventScope: "external",
    expectedAttendance: 160,
    isScraped: false,
    source: SAMPLE_SOURCE,
    externalId: "demo-industrial-policy-youth",
    adminModified: true,
    reminder1Week: true,
    reminder1Day: true,
    reminderWeekly: true,
    reminderDaily: true,
    reminderMorningOf: true,
    assignments: [
      {
        departmentKey: "strategic-communications",
        selectedRequirementTitles: ["Arabic press release", "Media briefing kit"],
        dailyReminderTime: "08:10",
      },
      {
        departmentKey: "digital-media",
        selectedRequirementTitles: ["Content calendar", "Performance dashboard"],
        dailyReminderTime: "08:25",
      },
    ],
    speakers: [
      { contactKey: "waleed-hosani", role: "Moderator", roleAr: "محاور", displayOrder: 1 },
      { contactKey: "amira-nassar", role: "Innovation Panel", roleAr: "جلسة الابتكار", displayOrder: 2 },
      { contactKey: "salma-bakheet", role: "Youth Rapporteur", roleAr: "مقررة الجلسة", displayOrder: 3 },
    ],
  },
  {
    name: "Conference on Future Space Policies",
    nameAr: "مؤتمر سياسات الفضاء المستقبلية",
    description: "Two-day program featuring UAE Space Agency, academic labs, and private launch firms.",
    descriptionAr: "برنامج يمتد ليومين يضم وكالة الإمارات للفضاء ومختبرات أكاديمية وشركات إطلاق خاصة.",
    startDate: "2026-02-01",
    endDate: "2026-02-02",
    startTime: "09:00",
    endTime: "17:30",
    location: "Great Hall, ECSSR",
    locationAr: "القاعة الكبرى في المركز",
    organizers: "Space Policy Research Unit",
    organizersAr: "وحدة أبحاث سياسات الفضاء",
    url: "https://ecssr.ae/ar/events/future-space-policy-conference",
    category: "Policy Forum",
    categoryAr: "ملتقى السياسات",
    categoryId: undefined,
    eventType: "international",
    eventScope: "external",
    expectedAttendance: 300,
    isScraped: false,
    source: SAMPLE_SOURCE,
    externalId: "demo-space-policy-2025",
    adminModified: true,
    reminder1Week: true,
    reminder1Day: true,
    reminderWeekly: true,
    reminderDaily: true,
    reminderMorningOf: true,
    assignments: [
      {
        departmentKey: "venue-operations",
        selectedRequirementTitles: ["Floor plan & zoning", "Hospitality plan"],
        dailyReminderTime: "07:30",
      },
      {
        departmentKey: "protocol-relations",
        selectedRequirementTitles: ["VIP guest matrix", "Gift protocol"],
        dailyReminderTime: "08:50",
      },
      {
        departmentKey: "digital-media",
        selectedRequirementTitles: ["Live streaming setup", "Performance dashboard"],
        dailyReminderTime: "08:40",
      },
    ],
    speakers: [
      { contactKey: "rashid-alkaabi", role: "Mission Planner", roleAr: "مخطط المهمة", displayOrder: 1 },
      { contactKey: "samir-haddad", role: "Policy Lead", roleAr: "رائد السياسات", displayOrder: 2 },
      { contactKey: "noura-alsuwaidi", role: "International Partner", roleAr: "شريك دولي", displayOrder: 3 },
    ],
  },
  {
    name: "Policy Clinic: الذكاء الاصطناعي في الخدمات الصحية",
    nameAr: "عيادة السياسات: الذكاء الاصطناعي في الخدمات الصحية",
    description: "Closed-door clinic with UAE health regulators and AI labs to stress-test pilot policies.",
    descriptionAr: "جلسة مغلقة تجمع الجهات الصحية ومختبرات الذكاء الاصطناعي لاختبار السياسات التجريبية.",
    startDate: "2026-01-27",
    endDate: "2026-01-28",
    startTime: "09:30",
    endTime: "16:00",
    location: "Policy Studio, ECSSR",
    locationAr: "استوديو السياسات في المركز",
    organizers: "Health Policy Center",
    organizersAr: "مركز سياسات الصحة",
    url: "https://ecssr.ae/ar/events/ai-health-policy-clinic",
    category: "Training Program",
    categoryAr: "برنامج تدريبي",
    categoryId: undefined,
    eventType: "local",
    eventScope: "internal",
    expectedAttendance: 110,
    isScraped: false,
    source: SAMPLE_SOURCE,
    externalId: "demo-ai-health-policy",
    adminModified: true,
    reminder1Week: true,
    reminder1Day: true,
    reminderWeekly: true,
    reminderDaily: true,
    reminderMorningOf: true,
    assignments: [
      {
        departmentKey: "research-translation",
        selectedRequirementTitles: ["Executive summary", "Terminology sheet"],
        dailyReminderTime: "08:35",
      },
      {
        departmentKey: "strategic-communications",
        selectedRequirementTitles: ["Media briefing kit", "Post-event coverage"],
        dailyReminderTime: "08:15",
      },
    ],
    speakers: [
      { contactKey: "samir-haddad", role: "Policy Chair", roleAr: "رئيس السياسات", displayOrder: 1 },
      { contactKey: "faris-rahman", role: "AI Ethics Lead", roleAr: "مسؤول أخلاقيات الذكاء الاصطناعي", displayOrder: 2 },
      { contactKey: "mariam-habib", role: "Clinical Reviewer", roleAr: "مراجعة سريرية", displayOrder: 3 },
    ],
  },
  {
    name: "Future of Arabic Media Summit",
    nameAr: "قمة مستقبل الإعلام العربي",
    description: "Regional publishers unpack immersive storytelling and Arabic localization standards.",
    descriptionAr: "ناشرون من المنطقة يناقشون السرد التفاعلي ومعايير التعريب العربي.",
    startDate: "2025-12-16",
    endDate: "2025-12-17",
    startTime: "09:00",
    endTime: "17:30",
    location: "Media Studio, ECSSR",
    locationAr: "استوديو الإعلام في المركز",
    organizers: "Media Futures Lab",
    organizersAr: "مختبر الإعلام المستقبلي",
    url: "https://ecssr.ae/ar/events/future-arabic-media-summit",
    category: "Policy Forum",
    categoryAr: "ملتقى السياسات",
    categoryId: undefined,
    eventType: "international",
    eventScope: "external",
    expectedAttendance: 260,
    isScraped: false,
    source: SAMPLE_SOURCE,
    externalId: "demo-arabic-media-summit",
    adminModified: true,
    reminder1Week: true,
    reminder1Day: true,
    reminderWeekly: true,
    reminderDaily: true,
    reminderMorningOf: true,
    assignments: [
      {
        departmentKey: "digital-media",
        selectedRequirementTitles: ["Content calendar", "Live streaming setup"],
        dailyReminderTime: "07:50",
      },
      {
        departmentKey: "strategic-communications",
        selectedRequirementTitles: ["Arabic press release", "Post-event coverage"],
        dailyReminderTime: "08:05",
      },
      {
        departmentKey: "venue-operations",
        selectedRequirementTitles: ["Floor plan & zoning", "Hospitality plan"],
        dailyReminderTime: "08:25",
      },
    ],
    speakers: [
      { contactKey: "waleed-hosani", role: "Summit Host", roleAr: "مضيف القمة", displayOrder: 1 },
      { contactKey: "gamal-samir", role: "Storytelling Coach", roleAr: "مدرب السرد القصصي", displayOrder: 2 },
      { contactKey: "salma-bakheet", role: "Audience Insight", roleAr: "تحليل الجمهور", displayOrder: 3 },
    ],
  },
  {
    name: "Heritage Diplomacy Salon",
    nameAr: "صالون الدبلوماسية الثقافية",
    description: "Curated salon with cultural attachés on safeguarding Arabic heritage abroad.",
    descriptionAr: "صالون يجمع الملحقين الثقافيين لمناقشة صون التراث العربي في الخارج.",
    startDate: "2025-10-08",
    endDate: "2025-10-08",
    startTime: "19:00",
    endTime: "21:30",
    location: "Cultural Majlis, ECSSR",
    locationAr: "المجلس الثقافي في المركز",
    organizers: "Cultural Diplomacy Unit",
    organizersAr: "وحدة الدبلوماسية الثقافية",
    url: "https://ecssr.ae/ar/events/heritage-diplomacy-salon",
    category: "Public Lecture",
    categoryAr: "محاضرة عامة",
    categoryId: undefined,
    eventType: "local",
    eventScope: "external",
    expectedAttendance: 140,
    isScraped: false,
    source: SAMPLE_SOURCE,
    externalId: "demo-heritage-salon",
    adminModified: true,
    reminder1Week: true,
    reminder1Day: true,
    reminderWeekly: true,
    reminderDaily: true,
    reminderMorningOf: true,
    assignments: [
      {
        departmentKey: "protocol-relations",
        selectedRequirementTitles: ["VIP guest matrix", "Arrival coordination"],
        dailyReminderTime: "10:10",
      },
      {
        departmentKey: "research-translation",
        selectedRequirementTitles: ["Executive summary", "Speaker bios translation"],
        dailyReminderTime: "09:20",
      },
    ],
    speakers: [
      { contactKey: "fatima-haji", role: "Salon Host", roleAr: "مضيفة الصالون", displayOrder: 1 },
      { contactKey: "lina-samir", role: "Keynote", roleAr: "متحدث رئيسي", displayOrder: 2 },
      { contactKey: "mariam-habib", role: "Discussant", roleAr: "مداخلة", displayOrder: 3 },
    ],
  },
  {
    name: "GCC Cyber Resilience Week",
    nameAr: "أسبوع المرونة السيبرانية الخليجي",
    description: "Five-day drills and tabletop exercises with regulators and critical infrastructure leaders.",
    descriptionAr: "تمارين ميدانية ونقاشات لمدة خمسة أيام مع المنظمين وقادة البنية التحتية الحيوية.",
    startDate: "2026-03-03",
    endDate: "2026-03-07",
    startTime: "09:00",
    endTime: "17:00",
    location: "Command Center, ECSSR",
    locationAr: "مركز القيادة في المركز",
    organizers: "Cyber Policy Program",
    organizersAr: "برنامج السياسات السيبرانية",
    url: "https://ecssr.ae/ar/events/gcc-cyber-resilience-week",
    category: "Training Program",
    categoryAr: "برنامج تدريبي",
    categoryId: undefined,
    eventType: "international",
    eventScope: "internal",
    expectedAttendance: 180,
    isScraped: false,
    source: SAMPLE_SOURCE,
    externalId: "demo-gcc-cyber-week",
    adminModified: true,
    reminder1Week: true,
    reminder1Day: true,
    reminderWeekly: true,
    reminderDaily: true,
    reminderMorningOf: true,
    assignments: [
      {
        departmentKey: "digital-media",
        selectedRequirementTitles: ["Content calendar", "Performance dashboard"],
        dailyReminderTime: "08:05",
      },
      {
        departmentKey: "research-translation",
        selectedRequirementTitles: ["Executive summary", "Terminology sheet"],
        dailyReminderTime: "08:20",
      },
      {
        departmentKey: "venue-operations",
        selectedRequirementTitles: ["Floor plan & zoning", "Stage management rundown"],
        dailyReminderTime: "08:40",
      },
    ],
    speakers: [
      { contactKey: "samir-haddad", role: "Exercise Director", roleAr: "مدير التمرين", displayOrder: 1 },
      { contactKey: "noura-alsuwaidi", role: "Policy Anchor", roleAr: "قائدة السياسات", displayOrder: 2 },
      { contactKey: "faris-rahman", role: "Threat Intelligence", roleAr: "معلومات التهديدات", displayOrder: 3 },
    ],
  },
  {
    name: "Sustainability Finance Roundtable",
    nameAr: "مائدة مستديرة لتمويل الاستدامة",
    description: "Investors and sovereign funds debate blended finance for green megaprojects.",
    descriptionAr: "نقاش بين المستثمرين والصناديق السيادية حول التمويل المختلط للمشاريع الخضراء العملاقة.",
    startDate: "2026-04-12",
    endDate: "2026-04-12",
    startTime: "10:00",
    endTime: "15:30",
    location: "Leadership Majlis, ECSSR",
    locationAr: "مجلس القيادة في المركز",
    organizers: "Green Finance Taskforce",
    organizersAr: "فريق عمل التمويل الأخضر",
    url: "https://ecssr.ae/ar/events/sustainability-finance-roundtable",
    category: "Policy Forum",
    categoryAr: "ملتقى السياسات",
    categoryId: undefined,
    eventType: "international",
    eventScope: "external",
    expectedAttendance: 95,
    isScraped: false,
    source: SAMPLE_SOURCE,
    externalId: "demo-sustainability-finance",
    adminModified: true,
    reminder1Week: true,
    reminder1Day: true,
    reminderWeekly: true,
    reminderDaily: true,
    reminderMorningOf: true,
    assignments: [
      {
        departmentKey: "strategic-communications",
        selectedRequirementTitles: ["Arabic press release", "Media briefing kit"],
        dailyReminderTime: "08:30",
      },
      {
        departmentKey: "protocol-relations",
        selectedRequirementTitles: ["VIP guest matrix", "Gift protocol"],
        dailyReminderTime: "08:55",
      },
      {
        departmentKey: "digital-media",
        selectedRequirementTitles: ["Performance dashboard", "Content calendar"],
        dailyReminderTime: "08:45",
      },
    ],
    speakers: [
      { contactKey: "fatima-haji", role: "Chair", roleAr: "رئيسة الجلسة", displayOrder: 1 },
      { contactKey: "lina-samir", role: "Impact Analyst", roleAr: "محللة الأثر", displayOrder: 2 },
      { contactKey: "amira-nassar", role: "Innovation Showcase", roleAr: "عرض الابتكار", displayOrder: 3 },
    ],
  },
  {
    name: "Maritime Safety Innovation Demo",
    nameAr: "عرض ابتكارات السلامة البحرية",
    description: "Demonstrations of autonomous patrol craft and AI search-and-rescue analytics.",
    descriptionAr: "عرض للقوارب الدورية الذاتية وتحليلات الذكاء الاصطناعي للبحث والإنقاذ.",
    startDate: "2026-05-06",
    endDate: "2026-05-06",
    startTime: "09:30",
    endTime: "14:00",
    location: "Port Innovation Yard, Abu Dhabi",
    locationAr: "ساحة الابتكار في الميناء، أبوظبي",
    organizers: "Maritime Safety Alliance",
    organizersAr: "تحالف السلامة البحرية",
    url: "https://ecssr.ae/ar/events/maritime-safety-demo",
    category: "Training Program",
    categoryAr: "برنامج تدريبي",
    categoryId: undefined,
    eventType: "international",
    eventScope: "external",
    expectedAttendance: 130,
    isScraped: false,
    source: SAMPLE_SOURCE,
    externalId: "demo-maritime-safety-demo",
    adminModified: true,
    reminder1Week: true,
    reminder1Day: true,
    reminderWeekly: true,
    reminderDaily: true,
    reminderMorningOf: true,
    assignments: [
      {
        departmentKey: "venue-operations",
        selectedRequirementTitles: ["Hospitality plan", "Stage management rundown"],
        dailyReminderTime: "07:55",
      },
      {
        departmentKey: "digital-media",
        selectedRequirementTitles: ["Live streaming setup", "Performance dashboard"],
        dailyReminderTime: "08:05",
      },
      {
        departmentKey: "protocol-relations",
        selectedRequirementTitles: ["Arrival coordination", "Gift protocol"],
        dailyReminderTime: "08:25",
      },
    ],
    speakers: [
      { contactKey: "yousef-rahmani", role: "Demo Captain", roleAr: "قائد العرض", displayOrder: 1 },
      { contactKey: "karim-mansour", role: "Safety Engineer", roleAr: "مهندس سلامة", displayOrder: 2 },
      { contactKey: "gamal-samir", role: "Live Commentator", roleAr: "معلق مباشر", displayOrder: 3 },
    ],
  },
];

const archivedEventSeeds: ArchivedEventSeed[] = [
  {
    name: "Harvest: Gulf Food Security 2024",
    nameAr: "حصاد: الأمن الغذائي ٢٠٢٤",
    description: "Captured lessons from the Gulf Food Security Futures Forum with actionable policy pilots.",
    descriptionAr: "استخلاص الدروس من منتدى آفاق الأمن الغذائي مع مبادرات تجريبية قابلة للتنفيذ.",
    startDate: "2024-10-14",
    endDate: "2024-10-14",
    startTime: "09:00",
    endTime: "16:00",
    location: "ECSSR Conference Hall",
    locationAr: "قاعة مؤتمرات المركز",
    organizers: "ECSSR Policy Center",
    organizersAr: "مركز السياسات في المركز",
    url: `${SAMPLE_ARCHIVE_URL_PREFIX}gulf-food-security-2024`,
    category: "Policy Forum",
    categoryAr: "ملتقى السياسات",
    eventType: "international",
    eventScope: "external",
    originalEventName: "Gulf Food Security Futures Forum",
    actualAttendees: 205,
    highlights: "Four ministries aligned on a unified Gulf grain reserve with shared procurement windows.",
    highlightsAr: "توافق أربع وزارات على احتياطي خليجي موحد للحبوب مع نوافذ شراء مشتركة.",
    impact: "Formed a cross-border working group to pilot resilient supply corridors with two ports.",
    impactAr: "تشكيل فريق عمل عابر للحدود لتجربة ممرات إمداد مرنة بين ميناءين.",
    keyTakeaways: "Data-sharing and unified commodity specs accelerate food security readiness.",
    keyTakeawaysAr: "تسريع الجاهزية الغذائية يتم عبر تبادل البيانات وتوحيد المواصفات السلعية.",
    photoKeys: ["demo/harvest/food-security-1.jpg", "demo/harvest/food-security-2.jpg", "demo/harvest/food-security-3.jpg"],
    thumbnailKeys: ["demo/harvest/food-security-1-thumb.jpg", "demo/harvest/food-security-2-thumb.jpg", "demo/harvest/food-security-3-thumb.jpg"],
    youtubeVideoIds: ["yt-food-001", "yt-food-002"],
    createdDirectly: false,
    speakers: [
      { contactKey: "samir-haddad", role: "Keynote", roleAr: "متحدث رئيسي" },
      { contactKey: "noura-alsuwaidi", role: "Policy Reactor", roleAr: "معلق سياسات" },
      { contactKey: "mariam-habib", role: "Rapporteur", roleAr: "مقررة" },
    ],
  },
  {
    name: "Harvest: Climate Diplomacy Majlis",
    nameAr: "حصاد مجلس الدبلوماسية المناخية",
    description: "Documented pledges from envoys on pre-COP30 cooperation and media engagement tactics.",
    descriptionAr: "توثيق تعهدات المبعوثين حول التعاون قبل كوب ٣٠ واستراتيجيات التواصل الإعلامي.",
    startDate: "2025-10-23",
    endDate: "2025-10-23",
    startTime: "18:30",
    endTime: "20:30",
    location: "Heritage Majlis",
    locationAr: "مجلس التراث",
    organizers: "ECSSR Climate Desk",
    organizersAr: "مكتب المناخ في المركز",
    url: `${SAMPLE_ARCHIVE_URL_PREFIX}climate-diplomacy-majlis`,
    category: "Public Lecture",
    categoryAr: "محاضرة عامة",
    eventType: "local",
    eventScope: "external",
    originalEventName: "Majlis on Climate Diplomacy",
    actualAttendees: 170,
    highlights: "Envoys agreed to a bilingual media pool and quarterly message testing labs.",
    highlightsAr: "اتفق المبعوثون على غرفة إعلامية ثنائية اللغة ومختبرات فصلية لاختبار الرسائل.",
    impact: "Regional climate taskforce stood up with rotating chairmanship.",
    impactAr: "تشكيل فريق عمل مناخي إقليمي برئاسة دورية.",
    keyTakeaways: "Shared narratives reduce friction between negotiators and press cycles.",
    keyTakeawaysAr: "السرديات المشتركة تخفف الاحتكاك بين المفاوضين والدورات الإعلامية.",
    photoKeys: ["demo/harvest/climate-1.jpg", "demo/harvest/climate-2.jpg"],
    thumbnailKeys: ["demo/harvest/climate-1-thumb.jpg", "demo/harvest/climate-2-thumb.jpg"],
    youtubeVideoIds: ["yt-climate-001"],
    createdDirectly: false,
    speakers: [
      { contactKey: "lina-samir", role: "Moderator", roleAr: "محاورة" },
      { contactKey: "faris-rahman", role: "Panelist", roleAr: "متحدث" },
      { contactKey: "fatima-haji", role: "Guest Respondent", roleAr: "مداخلة" },
    ],
  },
  {
    name: "Youth Lab Alumni Showcase",
    nameAr: "عرض خريجي مختبر الشباب",
    description: "Celebrating prototypes launched after the Arab Knowledge Economy Lab.",
    descriptionAr: "الاحتفاء بالنماذج الأولية التي خرجت من مختبر اقتصاد المعرفة العربي.",
    startDate: "2025-12-01",
    endDate: "2025-12-01",
    startTime: "18:00",
    endTime: "21:00",
    location: "Innovation Hub, ECSSR",
    locationAr: "مركز الابتكار في المركز",
    organizers: "Youth Engagement Office",
    organizersAr: "مكتب تمكين الشباب",
    url: `${SAMPLE_ARCHIVE_URL_PREFIX}youth-lab-alumni-showcase`,
    category: "Youth Lab",
    categoryAr: "مختبر الشباب",
    eventType: "local",
    eventScope: "internal",
    createdDirectly: true,
    actualAttendees: 145,
    highlights: "Five prototypes reached pilot MoUs with smart city partners.",
    highlightsAr: "خمسة نماذج أولية وصلت إلى مذكرات تفاهم تجريبية مع شركاء المدن الذكية.",
    impact: "Two teams secured accelerator slots and small grants for scaling.",
    impactAr: "فريقان حصلا على مقاعد في مسرعة ومنح صغيرة للتوسع.",
    keyTakeaways: "Mentorship continuity keeps youth teams on track post-lab.",
    keyTakeawaysAr: "استمرارية الإرشاد تحافظ على تقدم فرق الشباب بعد المختبر.",
    photoKeys: ["demo/harvest/youth-lab-1.jpg", "demo/harvest/youth-lab-2.jpg", "demo/harvest/youth-lab-3.jpg"],
    thumbnailKeys: ["demo/harvest/youth-lab-1-thumb.jpg", "demo/harvest/youth-lab-2-thumb.jpg", "demo/harvest/youth-lab-3-thumb.jpg"],
    youtubeVideoIds: ["yt-youth-001", "yt-youth-002"],
    speakers: [
      { contactKey: "amira-nassar", role: "Innovation Coach", roleAr: "مدربة ابتكار" },
      { contactKey: "hana-alharthy", role: "Program Host", roleAr: "مضيفة البرنامج" },
      { contactKey: "waleed-hosani", role: "Awards MC", roleAr: "عريف الحفل" },
    ],
  },
  {
    name: "Harvest: AI Health Policy Clinic",
    nameAr: "حصاد عيادة سياسات الذكاء الاصطناعي الصحية",
    description: "Synthesized clinical safety guardrails from the AI health sandbox.",
    descriptionAr: "تلخيص ضوابط السلامة السريرية من بيئة اختبار الذكاء الاصطناعي الصحية.",
    startDate: "2026-02-02",
    endDate: "2026-02-02",
    startTime: "10:00",
    endTime: "14:00",
    location: "Policy Studio",
    locationAr: "استوديو السياسات",
    organizers: "Health Policy Center",
    organizersAr: "مركز سياسات الصحة",
    url: `${SAMPLE_ARCHIVE_URL_PREFIX}ai-health-policy-clinic`,
    category: "Training Program",
    categoryAr: "برنامج تدريبي",
    eventType: "local",
    eventScope: "internal",
    originalEventName: "Policy Clinic: الذكاء الاصطناعي في الخدمات الصحية",
    createdDirectly: false,
    actualAttendees: 118,
    highlights: "Published a bilingual clinical safety checklist for AI pilots.",
    highlightsAr: "إصدار قائمة فحص ثنائية اللغة للسلامة السريرية في التجارب.",
    impact: "MOH approved a fast-track for sandboxed AI services.",
    impactAr: "اعتمدت وزارة الصحة مساراً سريعاً لخدمات الذكاء الاصطناعي التجريبية.",
    keyTakeaways: "Shared liability matrices improve hospital adoption confidence.",
    keyTakeawaysAr: "مصفوفات المسؤولية المشتركة تعزز ثقة المستشفيات في الاعتماد.",
    photoKeys: ["demo/harvest/ai-health-1.jpg", "demo/harvest/ai-health-2.jpg"],
    thumbnailKeys: ["demo/harvest/ai-health-1-thumb.jpg", "demo/harvest/ai-health-2-thumb.jpg"],
    youtubeVideoIds: ["yt-aihealth-001"],
    speakers: [
      { contactKey: "samir-haddad", role: "Policy Chair", roleAr: "رئيس السياسات" },
      { contactKey: "faris-rahman", role: "AI Ethics", roleAr: "أخلاقيات الذكاء الاصطناعي" },
      { contactKey: "mariam-habib", role: "Clinical Lead", roleAr: "قائدة سريرية" },
    ],
  },
  {
    name: "Harvest: Red Sea Security Simulation",
    nameAr: "حصاد محاكاة أمن البحر الأحمر",
    description: "Summarized readiness gaps from the strategic gaming workshop and port authority observers.",
    descriptionAr: "تلخيص فجوات الجاهزية من ورشة المحاكاة الاستراتيجية وملاحظات هيئات الموانئ.",
    startDate: "2026-01-20",
    endDate: "2026-01-20",
    startTime: "11:00",
    endTime: "15:00",
    location: "Joint Simulation Center",
    locationAr: "مركز المحاكاة المشترك",
    organizers: "Security & Defense Program",
    organizersAr: "برنامج الأمن والدفاع",
    url: `${SAMPLE_ARCHIVE_URL_PREFIX}red-sea-simulation-harvest`,
    category: "Training Program",
    categoryAr: "برنامج تدريبي",
    eventType: "international",
    eventScope: "internal",
    originalEventName: "Strategic Gaming Workshop on Red Sea Security",
    createdDirectly: false,
    actualAttendees: 82,
    highlights: "New convoy spacing protocol tested with three naval colleges.",
    highlightsAr: "تجربة بروتوكول تباعد المواكب مع ثلاث كليات بحرية.",
    impact: "Drafted interoperable alert scripts for joint command centers.",
    impactAr: "صياغة نصوص إنذار قابلة للتشغيل البيني لمراكز القيادة المشتركة.",
    keyTakeaways: "Simulation cadence keeps partner navies aligned on terminology.",
    keyTakeawaysAr: "إيقاع المحاكاة يحافظ على اتساق المصطلحات بين القوات البحرية الشريكة.",
    photoKeys: ["demo/harvest/redsea-1.jpg", "demo/harvest/redsea-2.jpg", "demo/harvest/redsea-3.jpg"],
    thumbnailKeys: ["demo/harvest/redsea-1-thumb.jpg", "demo/harvest/redsea-2-thumb.jpg", "demo/harvest/redsea-3-thumb.jpg"],
    youtubeVideoIds: ["yt-redsea-001"],
    speakers: [
      { contactKey: "yousef-rahmani", role: "Exercise Lead", roleAr: "قائد التمرين" },
      { contactKey: "karim-mansour", role: "Ops Analyst", roleAr: "محلل عمليات" },
      { contactKey: "tariq-salem", role: "Protocol Advisor", roleAr: "مستشار المراسم" },
    ],
  },
  {
    name: "Harvest: Future Space Policy Outcomes",
    nameAr: "حصاد سياسات الفضاء المستقبلية",
    description: "Captured joint statements between UAE Space Agency and partner launch firms.",
    descriptionAr: "توثيق بيانات مشتركة بين وكالة الإمارات للفضاء وشركات الإطلاق الشريكة.",
    startDate: "2026-02-03",
    endDate: "2026-02-03",
    startTime: "10:00",
    endTime: "16:00",
    location: "Great Hall, ECSSR",
    locationAr: "القاعة الكبرى في المركز",
    organizers: "Space Policy Research Unit",
    organizersAr: "وحدة أبحاث سياسات الفضاء",
    url: `${SAMPLE_ARCHIVE_URL_PREFIX}future-space-policy-outcomes`,
    category: "Policy Forum",
    categoryAr: "ملتقى السياسات",
    eventType: "international",
    eventScope: "external",
    originalEventName: "Conference on Future Space Policies",
    createdDirectly: false,
    actualAttendees: 298,
    highlights: "Signed letter of intent on debris mitigation and launch window coordination.",
    highlightsAr: "توقيع خطاب نوايا بشأن الحد من الحطام وتنسيق نوافذ الإطلاق.",
    impact: "Established shared telemetry standards for joint missions.",
    impactAr: "إرساء معايير تليمترية مشتركة للبعثات المشتركة.",
    keyTakeaways: "Transparent data rooms reduce mission risk across agencies.",
    keyTakeawaysAr: "غرف البيانات الشفافة تقلل مخاطر المهام بين الوكالات.",
    photoKeys: ["demo/harvest/space-1.jpg", "demo/harvest/space-2.jpg"],
    thumbnailKeys: ["demo/harvest/space-1-thumb.jpg", "demo/harvest/space-2-thumb.jpg"],
    youtubeVideoIds: ["yt-space-001", "yt-space-002"],
    speakers: [
      { contactKey: "rashid-alkaabi", role: "Mission Planner", roleAr: "مخطط المهمة" },
      { contactKey: "samir-haddad", role: "Policy Lead", roleAr: "رائد السياسات" },
      { contactKey: "noura-alsuwaidi", role: "International Partner", roleAr: "شريك دولي" },
    ],
  },
  {
    name: "Harvest: Maritime Safety Demo",
    nameAr: "حصاد عرض السلامة البحرية",
    description: "Summarized operator feedback from the Maritime Safety Innovation Demo.",
    descriptionAr: "تلخيص آراء المشغلين من عرض ابتكارات السلامة البحرية.",
    startDate: "2026-05-07",
    endDate: "2026-05-07",
    startTime: "10:30",
    endTime: "13:30",
    location: "Port Innovation Yard, Abu Dhabi",
    locationAr: "ساحة الابتكار في الميناء، أبوظبي",
    organizers: "Maritime Safety Alliance",
    organizersAr: "تحالف السلامة البحرية",
    url: `${SAMPLE_ARCHIVE_URL_PREFIX}maritime-safety-demo`,
    category: "Training Program",
    categoryAr: "برنامج تدريبي",
    eventType: "international",
    eventScope: "external",
    originalEventName: "Maritime Safety Innovation Demo",
    createdDirectly: false,
    actualAttendees: 128,
    highlights: "Coast guard adopted AI incident triage checklist from the live demo.",
    highlightsAr: "اعتمد خفر السواحل قائمة فرز الحوادث بالذكاء الاصطناعي من العرض الحي.",
    impact: "Vendors agreed to open telemetry feeds for joint drills.",
    impactAr: "وافقت الشركات على فتح بيانات التليمترية للتمارين المشتركة.",
    keyTakeaways: "Hands-on demos speed procurement and safety certification decisions.",
    keyTakeawaysAr: "العروض العملية تسرع قرارات الشراء واعتمادات السلامة.",
    photoKeys: ["demo/harvest/maritime-1.jpg", "demo/harvest/maritime-2.jpg"],
    thumbnailKeys: ["demo/harvest/maritime-1-thumb.jpg", "demo/harvest/maritime-2-thumb.jpg"],
    youtubeVideoIds: ["yt-marine-001"],
    speakers: [
      { contactKey: "yousef-rahmani", role: "Demo Captain", roleAr: "قائد العرض" },
      { contactKey: "karim-mansour", role: "Safety Engineer", roleAr: "مهندس سلامة" },
      { contactKey: "gamal-samir", role: "Live Commentator", roleAr: "معلق مباشر" },
    ],
  },
];
const sampleContactEmails = allContactSeeds
  .map((contact) => contact.email?.toLowerCase())
  .filter((email): email is string => Boolean(email));
const sampleUserEmails = departmentSeeds.flatMap((dept) => dept.keycloakUsers.map((user) => user.email.toLowerCase()));
interface KeycloakGroup {
  id: string;
  name: string;
  path: string;
  subGroups?: KeycloakGroup[];
}

interface KeycloakUser {
  id: string;
  username: string;
  email: string;
}

class KeycloakSeeder {
  private token: string | null = null;
  private groupCache: KeycloakGroup[] | null = null;

  private async ensureToken(): Promise<string> {
    if (this.token) {
      return this.token;
    }
    this.token = await getAdminToken();
    return this.token;
  }

  private async rawRequest(endpoint: string, options?: RequestInit): Promise<Response> {
    const token = await this.ensureToken();
    const response = await fetch(`${KEYCLOAK_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Include the endpoint in error for better debugging
      const error = new Error(`Keycloak request failed (${response.status}): ${errorText}`);
      (error as any).status = response.status;
      (error as any).endpoint = endpoint;
      throw error;
    }

    return response;
  }

  private async requestJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await this.rawRequest(endpoint, options);
    if (response.status === 204) {
      return undefined as T;
    }
    const text = await response.text();
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }

  private flattenGroups(groups: KeycloakGroup[], parentPath = ''): KeycloakGroup[] {
    const result: KeycloakGroup[] = [];
    for (const group of groups) {
      const fullPath = parentPath ? `${parentPath}/${group.name}` : `/${group.name}`;
      result.push({ ...group, path: fullPath });
      if (group.subGroups && group.subGroups.length > 0) {
        result.push(...this.flattenGroups(group.subGroups, fullPath));
      }
    }
    return result;
  }

  private async refreshGroupCache(): Promise<void> {
    const groups = await this.requestJson<KeycloakGroup[]>(`/groups?briefRepresentation=false`);
    this.groupCache = this.flattenGroups(groups || []);
  }

  private async getGroupByPath(path: string): Promise<KeycloakGroup | undefined> {
    if (!this.groupCache) {
      await this.refreshGroupCache();
    }
    return this.groupCache?.find((group) => group.path === path);
  }

  async ensureGroup(pathSegments: string[]): Promise<KeycloakGroup> {
    // Always start from a fresh cache to avoid stale group listings
    await this.refreshGroupCache();
    let currentPath = '';
    let parentId: string | undefined;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const segment of pathSegments) {
      currentPath = `${currentPath}/${segment}`;
      let existing = await this.getGroupByPath(currentPath);
      if (!existing) {
        const endpoint = parentId ? `/groups/${parentId}/children` : `/groups`;
        // Attempt creation
        try {
          await this.rawRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify({ name: segment.trim() }),
          });
        } catch (error: any) {
          // If group already exists (409 conflict), refresh cache and retry finding it
          if (error.status === 409) {
            console.log(`⚠️ Group '${segment}' already exists at path ${currentPath}, continuing...`);
            await this.refreshGroupCache();
            existing = await this.getGroupByPath(currentPath);
            // Don't throw here - let the retry logic below handle it
          } else {
            throw error;
          }
        }
        // Retry up to 5 times (exponential backoff) to account for propagation delay
        for (let attempt = 0; attempt < 5 && !existing; attempt++) {
          await sleep(75 * (attempt + 1));
          await this.refreshGroupCache();
          existing = await this.getGroupByPath(currentPath);
        }
      }
      if (!existing) {
        throw new Error(`Unable to create Keycloak group at path ${currentPath}`);
      }
      parentId = existing.id;
    }

    const finalGroup = await this.getGroupByPath(currentPath);
    if (!finalGroup) {
      throw new Error(`Failed to resolve group at ${currentPath}`);
    }
    return finalGroup;
  }

  async deleteGroupByPath(path: string): Promise<void> {
    const group = await this.getGroupByPath(path);
    if (!group) {
      return;
    }
    await this.rawRequest(`/groups/${group.id}`, { method: 'DELETE' });
    this.groupCache = null;
  }

  async findUserByEmail(email: string): Promise<KeycloakUser | undefined> {
    const params = new URLSearchParams({ email, exact: 'true' });
    const users = await this.requestJson<KeycloakUser[]>(`/users?${params.toString()}`);
    return users?.[0];
  }

  async createOrUpdateUser(user: DepartmentSeed['keycloakUsers'][number], groupId: string): Promise<void> {
    let existing = await this.findUserByEmail(user.email);
    if (!existing) {
      await this.rawRequest(`/users`, {
        method: 'POST',
        body: JSON.stringify({
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          enabled: true,
          emailVerified: true,
          attributes: { jobTitle: [user.jobTitle] },
        }),
      });
      existing = await this.findUserByEmail(user.email);
    } else {
      await this.rawRequest(`/users/${existing.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          firstName: user.firstName,
          lastName: user.lastName,
          attributes: { jobTitle: [user.jobTitle] },
        }),
      });
    }

    if (!existing) {
      throw new Error(`Failed to provision Keycloak user ${user.email}`);
    }

    await this.rawRequest(`/users/${existing.id}/reset-password`, {
      method: 'PUT',
      body: JSON.stringify({
        type: 'password',
        value: DEFAULT_PASSWORD,
        temporary: false,
      }),
    });

    await this.rawRequest(`/users/${existing.id}/groups/${groupId}`, {
      method: 'PUT',
    });
  }

  async deleteUsersByEmail(emails: string[]): Promise<void> {
    for (const email of emails) {
      const existing = await this.findUserByEmail(email);
      if (existing) {
        await this.rawRequest(`/users/${existing.id}`, { method: 'DELETE' });
      }
    }
  }
}

// ==================== Image Generation and Upload Helpers ====================

/**
 * Generate and upload a profile picture for a contact
 * Returns the objectKey and thumbnailKey for MinIO storage
 */
async function generateAndUploadProfilePicture(
  nameEn: string,
  jobTitle: string
): Promise<{ objectKey: string; thumbnailKey: string } | null> {
  try {
    console.log(`[ImageGen] Generating profile picture for ${nameEn}...`);
    
    // Determine gender hint from Arabic name if available (simplified heuristic)
    let gender: 'male' | 'female' | undefined = undefined;
    
    const imageResult = await imageGenerator.generateProfilePicture(nameEn, jobTitle, gender);
    
    // Upload to MinIO
    const uploadResult = await minioService.uploadImage(
      imageResult.buffer,
      `${nameEn.replace(/\s+/g, '_')}_profile.png`,
      imageResult.mimeType
    );
    
    console.log(`✅ Uploaded profile picture for ${nameEn}: ${uploadResult.objectKey}`);
    
    return {
      objectKey: uploadResult.objectKey,
      thumbnailKey: uploadResult.thumbnailKey,
    };
  } catch (error) {
    console.error(`❌ Failed to generate profile picture for ${nameEn}:`, error);
    return null;
  }
}

/**
 * Generate and upload event photos for an archived event
 * Returns arrays of photoKeys and thumbnailKeys
 */
async function generateAndUploadEventPhotos(
  eventName: string,
  eventDescription: string,
  numPhotos: number = 3
): Promise<{ photoKeys: string[]; thumbnailKeys: string[] }> {
  const photoKeys: string[] = [];
  const thumbnailKeys: string[] = [];
  
  try {
    console.log(`[ImageGen] Generating ${numPhotos} photos for "${eventName}"...`);
    
    for (let i = 0; i < numPhotos; i++) {
      try {
        // Vary the style for diversity
        const styles: Array<'professional' | 'casual' | 'formal'> = ['professional', 'formal', 'casual'];
        const style = styles[i % styles.length];
        
        const imageResult = await imageGenerator.generateEventPhoto(
          eventName,
          eventDescription,
          style
        );
        
        // Upload to MinIO
        const uploadResult = await minioService.uploadImage(
          imageResult.buffer,
          `${eventName.replace(/\s+/g, '_')}_photo_${i + 1}.png`,
          imageResult.mimeType
        );
        
        photoKeys.push(uploadResult.objectKey);
        thumbnailKeys.push(uploadResult.thumbnailKey);
        
        console.log(`  ✅ Uploaded photo ${i + 1}/${numPhotos}: ${uploadResult.objectKey}`);
        
        // Add a small delay to avoid rate limiting
        if (i < numPhotos - 1) {
          const rateLimitDelay = imageGenerator.getRateLimitDelay();
          await new Promise(resolve => setTimeout(resolve, rateLimitDelay));
        }
      } catch (error) {
        console.error(`  ❌ Failed to generate photo ${i + 1} for ${eventName}:`, error);
      }
    }
    
    return { photoKeys, thumbnailKeys };
  } catch (error) {
    console.error(`❌ Failed to generate event photos for ${eventName}:`, error);
    return { photoKeys, thumbnailKeys };
  }
}

function dateWithOffset(baseDate: string, offsetDays: number): string {
  const date = new Date(`${baseDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function reminderDate(baseDate: string, daysBefore: number, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date(`${baseDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - daysBefore);
  date.setUTCHours(hours, minutes, 0, 0);
  return date;
}
async function ensureCategories(): Promise<Map<string, number>> {
  const categoryMap = new Map<string, number>();
  for (const category of categorySeeds) {
    const [existing] = await db.select().from(categories).where(eq(categories.nameEn, category.nameEn));
    if (existing) {
      categoryMap.set(category.nameEn, existing.id);
      continue;
    }
    const [created] = await db
      .insert(categories)
      .values({ nameEn: category.nameEn, nameAr: category.nameAr })
      .returning();
    categoryMap.set(category.nameEn, created.id);
  }
  return categoryMap;
}

// Get countries map (code -> id) for organization seeding
async function getCountriesMap(): Promise<Map<string, number>> {
  const countriesMap = new Map<string, number>();
  const allCountries = await db.select().from(countries);
  for (const country of allCountries) {
    countriesMap.set(country.code, country.id);
  }
  return countriesMap;
}

async function ensureOrganizations(): Promise<Map<string, number>> {
  const organizationMap = new Map<string, number>();
  const countriesMap = await getCountriesMap();
  
  for (const org of organizationSeeds) {
    const [existing] = await db.select().from(organizations).where(eq(organizations.nameEn, org.nameEn));
    if (existing) {
      organizationMap.set(org.key, existing.id);
      // Update country if specified and not already set
      if (org.countryCode && !existing.countryId) {
        const countryId = countriesMap.get(org.countryCode);
        if (countryId) {
          await db.update(organizations)
            .set({ countryId })
            .where(eq(organizations.id, existing.id));
        }
      }
      continue;
    }
    const countryId = org.countryCode ? countriesMap.get(org.countryCode) : null;
    const [created] = await db.insert(organizations)
      .values({ 
        nameEn: org.nameEn, 
        nameAr: org.nameAr,
        countryId: countryId || null
      })
      .returning();
    organizationMap.set(org.key, created.id);
  }
  return organizationMap;
}

async function ensurePositions(): Promise<Map<string, number>> {
  const positionMap = new Map<string, number>();
  for (const pos of positionSeeds) {
    const [existing] = await db.select().from(positions).where(eq(positions.nameEn, pos.nameEn));
    if (existing) {
      positionMap.set(pos.key, existing.id);
      continue;
    }
    const [created] = await db.insert(positions).values({ nameEn: pos.nameEn, nameAr: pos.nameAr }).returning();
    positionMap.set(pos.key, created.id);
  }
  return positionMap;
}

// Ensure partnership types exist and return a map of key -> id
async function ensurePartnershipTypes(): Promise<Map<string, number>> {
  const partnershipTypeMap = new Map<string, number>();
  for (const pt of partnershipTypeSeeds) {
    const [existing] = await db.select().from(partnershipTypes).where(eq(partnershipTypes.nameEn, pt.nameEn));
    if (existing) {
      partnershipTypeMap.set(pt.key, existing.id);
      continue;
    }
    const [created] = await db.insert(partnershipTypes).values({ nameEn: pt.nameEn, nameAr: pt.nameAr }).returning();
    partnershipTypeMap.set(pt.key, created.id);
  }
  return partnershipTypeMap;
}

async function ensureAgreementTypes(): Promise<Map<string, number>> {
  const agreementTypeMap = new Map<string, number>();
  for (const at of agreementTypeSeeds) {
    const [existing] = await db.select().from(agreementTypes).where(eq(agreementTypes.nameEn, at.nameEn));
    if (existing) {
      agreementTypeMap.set(at.key, existing.id);
      continue;
    }
    const [created] = await db.insert(agreementTypes).values({ nameEn: at.nameEn, nameAr: at.nameAr }).returning();
    agreementTypeMap.set(at.key, created.id);
  }
  return agreementTypeMap;
}

// Seed partnership data (update organizations to be partners, create agreements, activities, contacts)
async function seedPartnershipData(
  organizationMap: Map<string, number>,
  partnershipTypeMap: Map<string, number>,
  agreementTypeMap: Map<string, number>,
  contactMap: Map<string, SeededContactInfo>,
  eventMap: Map<string, string>,
  departmentMap: Map<string, { id: number; emails: string[]; requirementIds: Map<string, number>; taskTemplates: DepartmentSeed['taskTemplates'] }>,
) {
  console.log('🤝 Seeding partnership data...');
  
  // Update organizations to be partners
  for (const partnerSeed of partnerOrganizationSeeds) {
    const orgId = organizationMap.get(partnerSeed.organizationKey);
    if (!orgId) {
      console.warn(`⚠️ Organization not found: ${partnerSeed.organizationKey}`);
      continue;
    }
    
    const partnershipTypeId = partnershipTypeMap.get(partnerSeed.partnershipTypeKey);
    
    await db.update(organizations)
      .set({
        isPartner: true,
        partnershipStatus: partnerSeed.status,
        partnershipTypeId,
        partnershipStartDate: partnerSeed.startDate,
        partnershipEndDate: partnerSeed.endDate || null,
        agreementSignedBy: partnerSeed.agreementSignedBy,
        agreementSignedByUs: partnerSeed.agreementSignedByUs,
        partnershipNotes: partnerSeed.notes,
        website: partnerSeed.website,
      })
      .where(eq(organizations.id, orgId));
    
    console.log(`  ✅ Updated ${partnerSeed.organizationKey} as partner`);
  }
  
  // Seed partnership agreements
  console.log('📜 Seeding partnership agreements...');
  for (const agreementSeed of partnershipAgreementSeeds) {
    const orgId = organizationMap.get(agreementSeed.organizationKey);
    if (!orgId) {
      console.warn(`⚠️ Organization not found for agreement: ${agreementSeed.organizationKey}`);
      continue;
    }

    const agreementTypeId = agreementTypeMap.get(agreementSeed.agreementTypeKey);
    if (!agreementTypeId) {
      console.warn(`⚠️ Agreement type not found: ${agreementSeed.agreementTypeKey}`);
      continue;
    }
    
    // Check if agreement already exists
    const [existing] = await db.select()
      .from(partnershipAgreements)
      .where(and(
        eq(partnershipAgreements.organizationId, orgId),
        eq(partnershipAgreements.title, agreementSeed.title)
      ))
      .offset(1);
    
    if (existing) {
      console.log(`  ℹ️  Agreement already exists: ${agreementSeed.title}`);
      continue;
    }
    
    const agreementData: InsertPartnershipAgreement = {
      organizationId: orgId,
      title: agreementSeed.title,
      titleAr: agreementSeed.titleAr,
      description: agreementSeed.description,
      descriptionAr: agreementSeed.descriptionAr,
      agreementTypeId: agreementTypeId,
      signedDate: agreementSeed.signedDate,
      effectiveDate: agreementSeed.effectiveDate,
      expiryDate: agreementSeed.expiryDate,
      partnerSignatory: agreementSeed.partnerSignatory,
      partnerSignatoryTitle: agreementSeed.partnerSignatoryTitle,
      ourSignatory: agreementSeed.ourSignatory,
      ourSignatoryTitle: agreementSeed.ourSignatoryTitle,
      status: agreementSeed.status,
    };
    
    await db.insert(partnershipAgreements).values(agreementData);
    console.log(`  ✅ Created agreement: ${agreementSeed.title}`);
  }
  
  // Seed partnership activities
  console.log('📊 Seeding partnership activities...');
  for (const activitySeed of partnershipActivitySeeds) {
    const orgId = organizationMap.get(activitySeed.organizationKey);
    if (!orgId) {
      console.warn(`⚠️ Organization not found for activity: ${activitySeed.organizationKey}`);
      continue;
    }
    
    // Check if activity already exists
    const [existing] = await db.select()
      .from(partnershipActivities)
      .where(and(
        eq(partnershipActivities.organizationId, orgId),
        eq(partnershipActivities.title, activitySeed.title)
      ))
      .offset(1);
    
    if (existing) {
      console.log(`  ℹ️  Activity already exists: ${activitySeed.title}`);
      continue;
    }
    
    // Get linked event ID if specified
    const eventId = activitySeed.eventName ? eventMap.get(activitySeed.eventName) : null;
    
    const activityData: InsertPartnershipActivity = {
      organizationId: orgId,
      title: activitySeed.title,
      titleAr: activitySeed.titleAr,
      description: activitySeed.description,
      descriptionAr: activitySeed.descriptionAr,
      activityType: activitySeed.activityType,
      startDate: activitySeed.startDate,
      endDate: activitySeed.endDate,
      eventId,
      outcome: activitySeed.outcome,
      outcomeAr: activitySeed.outcomeAr,
      impactScore: activitySeed.impactScore,
    };
    
    await db.insert(partnershipActivities).values(activityData);
    console.log(`  ✅ Created activity: ${activitySeed.title}`);
  }
  
  // Seed partnership contacts
  console.log('👥 Seeding partnership contacts...');
  for (const contactSeed of partnershipContactSeeds) {
    const orgId = organizationMap.get(contactSeed.organizationKey);
    if (!orgId) {
      console.warn(`⚠️ Organization not found for partnership contact: ${contactSeed.organizationKey}`);
      continue;
    }
    
    const contactInfo = contactMap.get(contactSeed.contactKey);
    if (!contactInfo) {
      console.warn(`⚠️ Contact not found for partnership: ${contactSeed.contactKey}`);
      continue;
    }
    
    // Check if partnership contact already exists
    const [existing] = await db.select()
      .from(partnershipContacts)
      .where(and(
        eq(partnershipContacts.organizationId, orgId),
        eq(partnershipContacts.contactId, contactInfo.record.id)
      ))
      .offset(1);
    
    if (existing) {
      console.log(`  ℹ️  Partnership contact already exists: ${contactSeed.contactKey} -> ${contactSeed.organizationKey}`);
      continue;
    }
    
    const partnershipContactData: InsertPartnershipContact = {
      organizationId: orgId,
      contactId: contactInfo.record.id,
      role: contactSeed.role,
      roleAr: contactSeed.roleAr,
      isPrimary: contactSeed.isPrimary,
    };
    
    await db.insert(partnershipContacts).values(partnershipContactData);
    console.log(`  ✅ Linked ${contactSeed.contactKey} to ${contactSeed.organizationKey} as ${contactSeed.role}`);
  }
  
  // Seed partnership interactions
  console.log('💬 Seeding partnership interactions...');
  for (const interactionSeed of partnershipInteractionSeeds) {
    const orgId = organizationMap.get(interactionSeed.partnershipKey);
    if (!orgId) {
      console.warn(`⚠️ Partnership not found for interaction: ${interactionSeed.partnershipKey}`);
      continue;
    }
    
    const interactionData: InsertPartnershipInteraction = {
      organizationId: orgId,
      type: interactionSeed.type,
      description: interactionSeed.description,
      descriptionAr: interactionSeed.descriptionAr,
      outcome: interactionSeed.outcome,
      outcomeAr: interactionSeed.outcomeAr,
      interactionDate: new Date(interactionSeed.interactionDate),
    };
    
    await db.insert(partnershipInteractions).values(interactionData);
    console.log(`  ✅ Added ${interactionSeed.type} interaction for ${interactionSeed.partnershipKey}`);
  }
  
  // Seed partnership tasks
  console.log('📋 Seeding partnership tasks...');
  const today = new Date();
  
  for (const taskSeed of partnershipTaskSeeds) {
    const orgId = organizationMap.get(taskSeed.partnershipKey);
    if (!orgId) {
      console.warn(`⚠️ Partnership not found for task: ${taskSeed.partnershipKey}`);
      continue;
    }
    
    const department = departmentMap.get(taskSeed.departmentKey);
    if (!department) {
      console.warn(`⚠️ Department not found for task: ${taskSeed.departmentKey}`);
      continue;
    }
    
    // Calculate due date based on offset from today
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + taskSeed.dueOffsetDays);
    const dueDateStr = dueDate.toISOString().slice(0, 10);
    
    // Check if task already exists
    const [existing] = await db.select()
      .from(tasks)
      .where(and(
        eq(tasks.partnershipId, orgId),
        eq(tasks.title, taskSeed.title)
      ))
      .offset(1);
    
    if (existing) {
      console.log(`  ℹ️  Partnership task already exists: ${taskSeed.title}`);
      continue;
    }
    
    const taskData: InsertTask = {
      partnershipId: orgId,
      departmentId: department.id,
      title: taskSeed.title,
      titleAr: taskSeed.titleAr,
      description: taskSeed.description,
      descriptionAr: taskSeed.descriptionAr,
      status: taskSeed.status,
      priority: taskSeed.priority,
      dueDate: dueDateStr,
      notificationEmails: department.emails,
    };
    
    await db.insert(tasks).values(taskData);
    console.log(`  ✅ Created task "${taskSeed.title}" for ${taskSeed.partnershipKey}`);
  }
  
  console.log('✅ Partnership data seeded successfully');
}

// Seed leads and their interactions/tasks
async function seedLeads(
  departmentMap: Map<string, { id: number; emails: string[]; requirementIds: Map<string, number>; taskTemplates: DepartmentSeed['taskTemplates'] }>,
): Promise<Map<string, number>> {
  console.log('🎯 Seeding leads...');
  const leadMap = new Map<string, number>();
  
  for (const leadSeed of leadSeeds) {
    // Check if lead already exists by email
    const [existing] = leadSeed.email 
      ? await db.select().from(leads).where(eq(leads.email, leadSeed.email)).offset(1)
      : [];
    
    if (existing) {
      leadMap.set(leadSeed.key, existing.id);
      console.log(`  ℹ️  Lead already exists: ${leadSeed.name}`);
      continue;
    }
    
    const leadData: InsertLead = {
      name: leadSeed.name,
      nameAr: leadSeed.nameAr,
      email: leadSeed.email,
      phone: leadSeed.phone,
      type: leadSeed.type,
      status: leadSeed.status,
      organizationName: leadSeed.organizationName,
      notes: leadSeed.notes,
      notesAr: leadSeed.notesAr,
    };
    
    const [created] = await db.insert(leads).values(leadData).returning();
    leadMap.set(leadSeed.key, created.id);
    console.log(`  ✅ Created lead: ${leadSeed.name} (${leadSeed.organizationName || 'Individual'})`);
  }
  
  // Seed lead interactions
  console.log('💬 Seeding lead interactions...');
  for (const interactionSeed of leadInteractionSeeds) {
    const leadId = leadMap.get(interactionSeed.leadKey);
    if (!leadId) {
      console.warn(`⚠️ Lead not found for interaction: ${interactionSeed.leadKey}`);
      continue;
    }
    
    const interactionData: InsertLeadInteraction = {
      leadId,
      type: interactionSeed.type,
      description: interactionSeed.description,
      descriptionAr: interactionSeed.descriptionAr,
      outcome: interactionSeed.outcome,
      outcomeAr: interactionSeed.outcomeAr,
      interactionDate: new Date(interactionSeed.interactionDate),
    };
    
    await db.insert(leadInteractions).values(interactionData);
    console.log(`  ✅ Added ${interactionSeed.type} interaction for ${interactionSeed.leadKey}`);
  }
  
  // Seed lead tasks
  console.log('📋 Seeding lead tasks...');
  const today = new Date();
  
  for (const taskSeed of leadTaskSeeds) {
    const leadId = leadMap.get(taskSeed.leadKey);
    if (!leadId) {
      console.warn(`⚠️ Lead not found for task: ${taskSeed.leadKey}`);
      continue;
    }
    
    const department = departmentMap.get(taskSeed.departmentKey);
    if (!department) {
      console.warn(`⚠️ Department not found for task: ${taskSeed.departmentKey}`);
      continue;
    }
    
    // Calculate due date based on offset from today
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + taskSeed.dueOffsetDays);
    const dueDateStr = dueDate.toISOString().slice(0, 10);
    
    // Check if task already exists
    const [existing] = await db.select()
      .from(tasks)
      .where(and(
        eq(tasks.leadId, leadId),
        eq(tasks.title, taskSeed.title)
      ))
      .offset(1);
    
    if (existing) {
      console.log(`  ℹ️  Lead task already exists: ${taskSeed.title}`);
      continue;
    }
    
    const taskData: InsertTask = {
      leadId,
      departmentId: department.id,
      title: taskSeed.title,
      titleAr: taskSeed.titleAr,
      description: taskSeed.description,
      descriptionAr: taskSeed.descriptionAr,
      status: taskSeed.status,
      priority: taskSeed.priority,
      dueDate: dueDateStr,
      notificationEmails: department.emails,
    };
    
    await db.insert(tasks).values(taskData);
    console.log(`  ✅ Created task "${taskSeed.title}" for ${taskSeed.leadKey}`);
  }
  
  console.log('✅ Leads and related data seeded successfully');
  return leadMap;
}

// Clear sample leads and related data
async function clearSampleLeads(): Promise<void> {
  const sampleLeadEmails = leadSeeds
    .map(lead => lead.email?.toLowerCase())
    .filter((email): email is string => Boolean(email));
  
  if (sampleLeadEmails.length === 0) return;
  
  // Delete leads (cascades to interactions and tasks)
  await db.delete(leads).where(inArray(leads.email, sampleLeadEmails));
}

// Clear sample partnership data
async function clearSamplePartnershipData(): Promise<void> {
  // Get partner organization IDs from seeds
  const partnerOrgKeys = partnerOrganizationSeeds.map(p => p.organizationKey);
  const partnerOrgNames = organizationSeeds
    .filter(org => partnerOrgKeys.includes(org.key))
    .map(org => org.nameEn);
  
  if (partnerOrgNames.length === 0) return;
  
  // Get organization IDs
  const partnerOrgs = await db.select({ id: organizations.id })
    .from(organizations)
    .where(inArray(organizations.nameEn, partnerOrgNames));
  
  const partnerOrgIds = partnerOrgs.map(org => org.id);
  
  if (partnerOrgIds.length === 0) return;
  
  // Delete partnership activities
  await db.delete(partnershipActivities).where(inArray(partnershipActivities.organizationId, partnerOrgIds));
  
  // Delete partnership agreements
  await db.delete(partnershipAgreements).where(inArray(partnershipAgreements.organizationId, partnerOrgIds));
  
  // Delete partnership contacts
  await db.delete(partnershipContacts).where(inArray(partnershipContacts.organizationId, partnerOrgIds));
  
  // Delete partnership interactions
  await db.delete(partnershipInteractions).where(inArray(partnershipInteractions.organizationId, partnerOrgIds));
  
  // Delete partnership tasks
  await db.delete(tasks).where(inArray(tasks.partnershipId, partnerOrgIds));
  
  // Reset partnership fields on organizations
  await db.update(organizations)
    .set({
      isPartner: false,
      partnershipStatus: null,
      partnershipTypeId: null,
      partnershipStartDate: null,
      partnershipEndDate: null,
      agreementSignedBy: null,
      agreementSignedByUs: null,
      partnershipNotes: null,
      website: null,
      primaryContactId: null,
    })
    .where(inArray(organizations.id, partnerOrgIds));
}

async function seedContacts(
  organizationMap: Map<string, number>,
  positionMap: Map<string, number>,
): Promise<Map<string, SeededContactInfo>> {
  const seededContacts = new Map<string, SeededContactInfo>();
  const organizationSeedMap = new Map(organizationSeeds.map((org) => [org.key, org]));
  const positionSeedMap = new Map(positionSeeds.map((pos) => [pos.key, pos]));

  for (const seed of allContactSeeds) {
    if (!seed.email) {
      continue;
    }

    const organizationId = seed.organizationKey ? organizationMap.get(seed.organizationKey) ?? null : null;
    const positionId = seed.positionKey ? positionMap.get(seed.positionKey) ?? null : null;

    const [existing] = await db.select().from(contacts).where(eq(contacts.email, seed.email)).offset(1);

    // Generate profile picture ONLY for speakers to save costs
    let profilePictureKey: string | undefined = undefined;
    let profilePictureThumbnailKey: string | undefined = undefined;
    
    if (seed.isEligibleSpeaker) {
      const positionSeed = seed.positionKey ? positionSeedMap.get(seed.positionKey) : undefined;
      const jobTitle = positionSeed?.nameEn || 'Professional';
      
      const profilePicResult = await generateAndUploadProfilePicture(seed.nameEn, jobTitle);
      if (profilePicResult) {
        profilePictureKey = profilePicResult.objectKey;
        profilePictureThumbnailKey = profilePicResult.thumbnailKey;
      }
    }
    // Non-speakers will have null profile pictures (UI will show icon placeholder)

    const contactData: InsertContact = {
      nameEn: seed.nameEn,
      nameAr: seed.nameAr,
      title: seed.title,
      titleAr: seed.titleAr,
      organizationId,
      positionId,
      phone: seed.phone,
      email: seed.email,
      isEligibleSpeaker: seed.isEligibleSpeaker ?? true,
      profilePictureKey,
      profilePictureThumbnailKey,
    };

    let record: Contact;
    if (existing) {
      [record] = await db
        .update(contacts)
        .set({
          ...contactData,
        })
        .where(eq(contacts.id, existing.id))
        .returning();
    } else {
      [record] = await db.insert(contacts).values(contactData).returning();
    }

    const organizationSeed = seed.organizationKey ? organizationSeedMap.get(seed.organizationKey) : undefined;
    const positionSeed = seed.positionKey ? positionSeedMap.get(seed.positionKey) : undefined;

    seededContacts.set(seed.key, {
      record,
      seed,
      organizationName: organizationSeed?.nameEn,
      organizationNameAr: organizationSeed?.nameAr,
      positionName: positionSeed?.nameEn,
      positionNameAr: positionSeed?.nameAr,
    });
  }

  return seededContacts;
}

async function clearSampleEvents(): Promise<void> {
  await db.delete(events).where(eq(events.source, SAMPLE_SOURCE));
}

async function clearSampleArchivedEvents(): Promise<void> {
  const sampleEventIds = (await db.select({ id: events.id }).from(events).where(eq(events.source, SAMPLE_SOURCE))).map((row) => row.id);
  const conditions = [like(archivedEvents.url, `${SAMPLE_ARCHIVE_URL_PREFIX}%`)];

  if (sampleEventIds.length > 0) {
    conditions.push(inArray(archivedEvents.originalEventId, sampleEventIds));
  }

  if (conditions.length === 1) {
    await db.delete(archivedEvents).where(conditions[0]);
  } else {
    await db.delete(archivedEvents).where(or(...conditions));
  }
}

async function clearSampleContacts(): Promise<void> {
  if (sampleContactEmails.length === 0) return;
  await db.delete(contacts).where(inArray(contacts.email, sampleContactEmails));
}

async function clearSampleDepartments(): Promise<void> {
  await db.delete(departments).where(like(departments.keycloakGroupId, `/${ROOT_GROUP}%`));
}

async function seedDepartments(keycloak: KeycloakSeeder) {
  const departmentMap = new Map<string, { id: number; emails: string[]; requirementIds: Map<string, number>; taskTemplates: DepartmentSeed['taskTemplates'] }>();
  // Global map to look up task template IDs by department key and title
  const globalTaskTemplateMap = new Map<string, number>(); // key: "departmentKey:title" -> requirementId
  
  for (const dept of departmentSeeds) {
    const group = await keycloak.ensureGroup(dept.keycloakPathSegments);
    let existing = (await db.select().from(departments).where(eq(departments.keycloakGroupId, group.path)).offset(1))[0];

    if (!existing) {
      [existing] = await db
        .insert(departments)
        .values({
          name: dept.name,
          nameAr: dept.nameAr,
          keycloakGroupId: group.path,
          ccList: dept.ccList,
          active: true,
        })
        .returning();
    } else {
      [existing] = await db
        .update(departments)
        .set({ name: dept.name, nameAr: dept.nameAr, ccList: dept.ccList, active: true })
        .where(eq(departments.id, existing.id))
        .returning();
    }

    // Delete department accounts first (they reference department_emails with onDelete: 'restrict')
    await db.delete(departmentAccounts).where(eq(departmentAccounts.departmentId, existing.id));
    
    await db.delete(departmentEmails).where(eq(departmentEmails.departmentId, existing.id));
    const insertedEmails: string[] = [];
    let primaryEmailId: number | null = null;
    for (const email of dept.emails) {
      const [created] = await db.insert(departmentEmails).values({
        departmentId: existing.id,
        email: email.email,
        label: email.label,
        isPrimary: email.isPrimary ?? false,
      }).returning();
      insertedEmails.push(email.email);
      if (email.isPrimary) {
        primaryEmailId = created.id;
      }
    }

    // If no primary email was set, use the first one
    if (!primaryEmailId && insertedEmails.length > 0) {
      const [firstEmail] = await db.select().from(departmentEmails)
        .where(eq(departmentEmails.departmentId, existing.id))
        .offset(1);
      primaryEmailId = firstEmail.id;
    }

    await db.delete(departmentRequirements).where(eq(departmentRequirements.departmentId, existing.id));
    const requirementIds = new Map<string, number>();
    for (const requirement of dept.requirements) {
      const [created] = await db
        .insert(departmentRequirements)
        .values({
          departmentId: existing.id,
          title: requirement.title,
          titleAr: requirement.titleAr,
          description: requirement.description,
          descriptionAr: requirement.descriptionAr,
          isDefault: requirement.isDefault ?? false,
          notificationEmails: requirement.notificationEmails,
        })
        .returning();
      requirementIds.set(requirement.title, created.id);
      // Also add to global map for cross-department lookups
      globalTaskTemplateMap.set(`${dept.key}:${requirement.title}`, created.id);
    }

    // Create Keycloak users and link them to local database
    for (const user of dept.keycloakUsers) {
      await keycloak.createOrUpdateUser(user, group.id);
      
      // Create or update local database user
      let localUser = (await db.select().from(users).where(eq(users.username, user.username)).offset(1))[0];
      
      if (!localUser) {
        // Create new user with a placeholder password (they'll login via Keycloak)
        [localUser] = await db.insert(users).values({
          username: user.username,
          password: 'keycloak-managed', // Placeholder, not used for Keycloak users
          role: 'department',
          email: user.email,
        }).returning();
        console.log(`✅ Created local user: ${user.username}`);
      } else {
        // Update existing user
        [localUser] = await db.update(users)
          .set({ 
            email: user.email,
            role: 'department',
          })
          .where(eq(users.id, localUser.id))
          .returning();
        console.log(`✅ Updated local user: ${user.username}`);
      }

      // Link user to department via department_accounts
      if (primaryEmailId) {
        const existingAccount = (await db.select().from(departmentAccounts)
          .where(and(
            eq(departmentAccounts.userId, localUser.id),
            eq(departmentAccounts.departmentId, existing.id)
          ))
          .offset(1))[0];

        if (!existingAccount) {
          await db.insert(departmentAccounts).values({
            userId: localUser.id,
            departmentId: existing.id,
            primaryEmailId,
          });
          console.log(`✅ Linked ${user.username} to department ${dept.name}`);
        } else {
          console.log(`ℹ️  User ${user.username} already linked to department ${dept.name}`);
        }
      }
    }

    departmentMap.set(dept.key, {
      id: existing.id,
      emails: insertedEmails,
      requirementIds,
      taskTemplates: dept.taskTemplates,
    });
  }
  
  // Now seed task template prerequisites using the global map
  console.log('🔗 Creating task template prerequisites...');
  await seedTaskTemplatePrerequisites(globalTaskTemplateMap);
  
  return departmentMap;
}

// Seed task template prerequisites based on the taskTemplates in departmentSeeds
async function seedTaskTemplatePrerequisites(globalTaskTemplateMap: Map<string, number>) {
  // Clear existing prerequisites first
  await db.delete(taskTemplatePrerequisites);
  
  let prerequisiteCount = 0;
  
  for (const dept of departmentSeeds) {
    for (const template of dept.taskTemplates) {
      if (!template.prerequisiteTitle) continue;
      
      // Get the task template ID for this template
      const taskTemplateId = globalTaskTemplateMap.get(`${dept.key}:${template.title}`);
      if (!taskTemplateId) {
        console.warn(`⚠️ Task template not found: ${dept.key}:${template.title}`);
        continue;
      }
      
      // Determine which department the prerequisite is from
      const prereqDeptKey = template.prerequisiteDepartmentKey || dept.key;
      const prerequisiteTemplateId = globalTaskTemplateMap.get(`${prereqDeptKey}:${template.prerequisiteTitle}`);
      
      if (!prerequisiteTemplateId) {
        console.warn(`⚠️ Prerequisite template not found: ${prereqDeptKey}:${template.prerequisiteTitle}`);
        continue;
      }
      
      // Create the prerequisite relationship
      await db.insert(taskTemplatePrerequisites).values({
        taskTemplateId,
        prerequisiteTemplateId,
      });
      
      const isCrossDept = prereqDeptKey !== dept.key;
      console.log(`  ✅ ${template.title} → ${template.prerequisiteTitle}${isCrossDept ? ` (cross-dept: ${prereqDeptKey})` : ''}`);
      prerequisiteCount++;
    }
  }
  
  console.log(`✅ Created ${prerequisiteCount} task template prerequisites`);
}

async function createTasksForAssignment(
  eventDepartmentId: number,
  eventName: string,
  taskTemplates: DepartmentSeed['taskTemplates'],
  eventStartDate: string,
  notificationEmails: string[],
  departmentKey: string,
): Promise<Map<string, number>> {
  // Returns a map of "departmentKey:taskTitle" -> taskId for workflow linking
  const taskMap = new Map<string, number>();
  
  for (const template of taskTemplates) {
    const dueDate = dateWithOffset(eventStartDate, template.dueOffsetDays);
    const description = template.description.replace('{{eventName}}', eventName);
    const descriptionAr = template.descriptionAr.replace('{{eventName}}', eventName);
    
    // All tasks start as 'pending' - workflow creation will update status for tasks with prerequisites
    const taskData: InsertTask = {
      eventDepartmentId,
      title: template.title,
      titleAr: template.titleAr,
      description,
      descriptionAr,
      dueDate,
      notificationEmails,
      status: 'pending',
      priority: template.priority || 'medium',
    };
    const [createdTask] = await db.insert(tasks).values(taskData).returning();
    taskMap.set(`${departmentKey}:${template.title}`, createdTask.id);
  }
  
  return taskMap;
}

// Create workflows for an event based on task dependencies
async function createEventWorkflows(
  eventId: string,
  eventTaskMap: Map<string, number>, // All tasks for this event: "deptKey:title" -> taskId
) {
  // Build adjacency list of task dependencies from the seed data
  const taskDependencies: Array<{ taskKey: string; prereqKey: string }> = [];
  
  for (const dept of departmentSeeds) {
    for (const template of dept.taskTemplates) {
      if (!template.prerequisiteTitle) continue;
      
      const taskKey = `${dept.key}:${template.title}`;
      const prereqDeptKey = template.prerequisiteDepartmentKey || dept.key;
      const prereqKey = `${prereqDeptKey}:${template.prerequisiteTitle}`;
      
      // Only add if both tasks exist in this event's task map
      if (eventTaskMap.has(taskKey) && eventTaskMap.has(prereqKey)) {
        taskDependencies.push({ taskKey, prereqKey });
      }
    }
  }
  
  if (taskDependencies.length === 0) return;
  
  // Group tasks into connected workflow chains
  // Each workflow is a set of tasks connected by dependencies
  const visited = new Set<string>();
  const workflows: Set<string>[] = [];
  
  // Build adjacency lists for both directions
  const forward = new Map<string, string[]>(); // prereq -> dependents
  const backward = new Map<string, string[]>(); // task -> prerequisites
  
  for (const { taskKey, prereqKey } of taskDependencies) {
    if (!forward.has(prereqKey)) forward.set(prereqKey, []);
    forward.get(prereqKey)!.push(taskKey);
    
    if (!backward.has(taskKey)) backward.set(taskKey, []);
    backward.get(taskKey)!.push(prereqKey);
  }
  
  // Find all tasks involved in dependencies
  const allInvolvedTasks = new Set<string>();
  for (const { taskKey, prereqKey } of taskDependencies) {
    allInvolvedTasks.add(taskKey);
    allInvolvedTasks.add(prereqKey);
  }
  
  // DFS to find connected components
  function dfs(taskKey: string, component: Set<string>) {
    if (visited.has(taskKey)) return;
    visited.add(taskKey);
    component.add(taskKey);
    
    // Follow forward edges (dependents)
    for (const dependent of forward.get(taskKey) || []) {
      dfs(dependent, component);
    }
    // Follow backward edges (prerequisites)
    for (const prereq of backward.get(taskKey) || []) {
      dfs(prereq, component);
    }
  }
  
  for (const taskKey of Array.from(allInvolvedTasks)) {
    if (!visited.has(taskKey)) {
      const component = new Set<string>();
      dfs(taskKey, component);
      workflows.push(component);
    }
  }
  
  // Create a workflow for each connected component
  for (const workflowTaskSet of workflows) {
    const [workflow] = await db.insert(eventWorkflows).values({
      eventId,
      createdByUserId: null, // System-generated
    }).returning();
    
    // Compute topological order for the tasks in this workflow
    const inDegree = new Map<string, number>();
    for (const taskKey of Array.from(workflowTaskSet)) {
      inDegree.set(taskKey, 0);
    }
    for (const { taskKey, prereqKey } of taskDependencies) {
      if (workflowTaskSet.has(taskKey) && workflowTaskSet.has(prereqKey)) {
        inDegree.set(taskKey, (inDegree.get(taskKey) || 0) + 1);
      }
    }
    
    // Sort by topological order
    const sorted: string[] = [];
    const queue = Array.from(workflowTaskSet).filter(k => (inDegree.get(k) || 0) === 0);
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);
      
      for (const dependent of forward.get(current) || []) {
        if (!workflowTaskSet.has(dependent)) continue;
        inDegree.set(dependent, (inDegree.get(dependent) || 0) - 1);
        if (inDegree.get(dependent) === 0) {
          queue.push(dependent);
        }
      }
    }
    
    // Add workflow_tasks entries
    for (let orderIndex = 0; orderIndex < sorted.length; orderIndex++) {
      const taskKey = sorted[orderIndex];
      const taskId = eventTaskMap.get(taskKey);
      if (!taskId) continue;
      
      // Find the prerequisite task ID for this task
      let prerequisiteTaskId: number | null = null;
      const prereqs = backward.get(taskKey) || [];
      if (prereqs.length > 0 && workflowTaskSet.has(prereqs[0])) {
        prerequisiteTaskId = eventTaskMap.get(prereqs[0]) || null;
      }
      
      await db.insert(workflowTasks).values({
        workflowId: workflow.id,
        taskId,
        prerequisiteTaskId,
        orderIndex,
      });
      
      // Update task status: tasks with prerequisites should be 'waiting', others stay 'pending'
      if (prerequisiteTaskId) {
        await db.update(tasks)
          .set({ status: 'waiting' })
          .where(eq(tasks.id, taskId));
      }
    }
  }
}
async function seedEvents(
  departmentMap: Map<string, { id: number; emails: string[]; requirementIds: Map<string, number>; taskTemplates: DepartmentSeed['taskTemplates'] }>,
  categoryMap: Map<string, number>,
  contactMap: Map<string, SeededContactInfo>,
): Promise<Map<string, string>> {
  const eventMap = new Map<string, string>();
  for (const eventSeed of eventSeeds) {
    const categoryId = eventSeed.category ? categoryMap.get(eventSeed.category) : undefined;
    const [createdEvent] = await db
      .insert(events)
      .values({
        ...eventSeed,
        categoryId,
      })
      .returning();

    eventMap.set(eventSeed.name, createdEvent.id);
    
    // Collect all tasks created for this event to build workflows
    const eventTaskMap = new Map<string, number>();

    for (const assignment of eventSeed.assignments) {
      const department = departmentMap.get(assignment.departmentKey);
      if (!department) {
        throw new Error(`Department ${assignment.departmentKey} not found`);
      }
      const requirementIds = assignment.selectedRequirementTitles
        .map((title) => department.requirementIds.get(title))
        .filter((id): id is number => Boolean(id))
        .map((id) => `${id}`);

      const [eventDepartment] = await db
        .insert(eventDepartments)
        .values({
          eventId: createdEvent.id,
          departmentId: department.id,
          selectedRequirementIds: requirementIds,
          customRequirements: null,
          notifyOnCreate: true,
          notifyOnUpdate: true,
          dailyReminderEnabled: true,
          dailyReminderTime: assignment.dailyReminderTime,
        })
        .returning();

      const taskMap = await createTasksForAssignment(
        eventDepartment.id,
        createdEvent.name,
        department.taskTemplates,
        eventSeed.startDate,
        department.emails,
        assignment.departmentKey,
      );
      
      // Merge into event-wide task map
      taskMap.forEach((taskId, key) => {
        eventTaskMap.set(key, taskId);
      });
    }
    
    // Create workflows linking tasks with dependencies
    await createEventWorkflows(createdEvent.id, eventTaskMap);

    // Handle speakers (some events may not have speakers defined)
    const speakers = eventSeed.speakers ?? [];
    for (let index = 0; index < speakers.length; index++) {
      const speaker = speakers[index];
      const contact = contactMap.get(speaker.contactKey);
      if (!contact) {
        throw new Error(`Contact ${speaker.contactKey} not found for speaker`);
      }

      await db.insert(eventSpeakers).values({
        eventId: createdEvent.id,
        contactId: contact.record.id,
        role: speaker.role,
        roleAr: speaker.roleAr,
        displayOrder: speaker.displayOrder ?? index + 1,
      });
    }

    const weekReminder = reminderDate(eventSeed.startDate, 7, eventSeed.startTime || '09:00');
    const dayReminder = reminderDate(eventSeed.startDate, 1, eventSeed.startTime || '09:00');

    await db.insert(reminderQueue).values([
      {
        eventId: createdEvent.id,
        reminderType: '1_week',
        scheduledFor: weekReminder,
        status: 'pending',
      },
      {
        eventId: createdEvent.id,
        reminderType: '1_day',
        scheduledFor: dayReminder,
        status: 'pending',
      },
    ]);
  }
  return eventMap;
}

// Seed event invitees and attendees for engagement analytics
async function seedEventInviteesAndAttendees(
  eventMap: Map<string, string>,
  contactMap: Map<string, SeededContactInfo>,
) {
  console.log('📧 Seeding event invitees and attendees for engagement analytics...');
  
  // Get all non-speaker contacts (they're potential invitees/attendees)
  const allContactsArray = Array.from(contactMap.values());
  const nonSpeakerContacts = allContactsArray.filter(c => !c.seed.isEligibleSpeaker);
  
  // For each event, create a realistic mix of invitees and attendees
  for (const [eventName, eventId] of Array.from(eventMap.entries())) {
    // Get speakers for this event (they're auto-attendees)
    const eventSpeakerRecords = await db
      .select()
      .from(eventSpeakers)
      .where(eq(eventSpeakers.eventId, eventId));
    
    const speakerContactIds = new Set(eventSpeakerRecords.map(s => s.contactId));
    
    // Determine number of invitees based on expected attendance
    // We'll invite 2-3x the expected attendance to show conversion rates
    const expectedAttendance = 220; // Default, could vary by event
    const numInvitees = Math.min(nonSpeakerContacts.length, Math.floor(expectedAttendance * 2.5));
    
    // Shuffle and select random contacts to invite
    const shuffled = [...nonSpeakerContacts].sort(() => Math.random() - 0.5);
    const selectedInvitees = shuffled.slice(0, numInvitees);
    
    // Create invitees with varied RSVP/registration status
    const inviteeData: InsertEventInvitee[] = [];
    const attendeeData: InsertEventAttendee[] = [];
    
    for (let i = 0; i < selectedInvitees.length; i++) {
      const contact = selectedInvitees[i];
      const rand = Math.random();
      
      // 80% get email sent
      const inviteEmailSent = rand < 0.8;
      const invitedAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Last 30 days
      
      // Of those who got email: 60% RSVP'd
      const rsvp = inviteEmailSent && rand < 0.48; // 0.8 * 0.6 = 48%
      
      // Of those who RSVP'd: 70% registered
      const registered = rsvp && rand < 0.336; // 48% * 0.7 = 33.6%
      
      // Of those who registered: 85% actually attended
      const attended = registered && rand < 0.286; // 33.6% * 0.85 = 28.6%
      
      inviteeData.push({
        eventId,
        contactId: contact.record.id,
        rsvp,
        registered,
        inviteEmailSent,
        invitedAt,
        rsvpAt: rsvp ? new Date(invitedAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000) : null,
        registeredAt: registered ? new Date(invitedAt.getTime() + Math.random() * 14 * 24 * 60 * 60 * 1000) : null,
        inviteEmailSentAt: inviteEmailSent ? invitedAt : null,
        notes: null,
      });
      
      // Add to attendees if they attended
      if (attended) {
        attendeeData.push({
          eventId,
          contactId: contact.record.id,
          attendedAt: new Date(), // Event date
          notes: null,
        });
      }
    }
    
    // Also add speakers as attendees (they always attend)
    for (const speakerRecord of eventSpeakerRecords) {
      attendeeData.push({
        eventId,
        contactId: speakerRecord.contactId,
        attendedAt: new Date(),
        notes: 'Speaker',
      });
    }
    
    // Bulk insert invitees and attendees
    if (inviteeData.length > 0) {
      await db.insert(eventInvitees).values(inviteeData);
      console.log(`  ✅ Added ${inviteeData.length} invitees to "${eventName}"`);
    }
    
    if (attendeeData.length > 0) {
      await db.insert(eventAttendees).values(attendeeData);
      console.log(`  ✅ Added ${attendeeData.length} attendees to "${eventName}"`);
    }
  }
  
  console.log('✅ Event invitees and attendees seeded successfully');
}

async function seedArchivedEvents(
  categoryMap: Map<string, number>,
  contactMap: Map<string, SeededContactInfo>,
  eventMap: Map<string, string>,
) {
  for (const archivedSeed of archivedEventSeeds) {
    const categoryId = archivedSeed.category ? categoryMap.get(archivedSeed.category) : undefined;
    const originalEventId = archivedSeed.originalEventName ? eventMap.get(archivedSeed.originalEventName) : undefined;

    // Generate event photos
    const numPhotos = archivedSeed.photoKeys?.length || 2;
    const eventDescription = archivedSeed.description || archivedSeed.name;
    const { photoKeys, thumbnailKeys } = await generateAndUploadEventPhotos(
      archivedSeed.name,
      eventDescription,
      numPhotos
    );

    const [archived] = await db
      .insert(archivedEvents)
      .values({
        ...archivedSeed,
        categoryId,
        originalEventId,
        photoKeys: photoKeys.length > 0 ? photoKeys : archivedSeed.photoKeys || [],
        thumbnailKeys: thumbnailKeys.length > 0 ? thumbnailKeys : archivedSeed.thumbnailKeys || [],
      })
      .returning();

    // Create archiveMedia records for each generated photo
    // This ensures the photos appear in the archive detail page
    if (photoKeys.length > 0) {
      for (let i = 0; i < photoKeys.length; i++) {
        const mediaData: InsertArchiveMedia = {
          archivedEventId: archived.id,
          objectKey: photoKeys[i],
          thumbnailKey: thumbnailKeys[i] || photoKeys[i],
          originalFileName: `${archivedSeed.name.replace(/\s+/g, '_')}_photo_${i + 1}.png`,
          mimeType: 'image/png',
          fileSize: 0, // Unknown for AI-generated images
          displayOrder: i,
        };
        await db.insert(archiveMedia).values(mediaData);
      }
      console.log(`  ✓ Created ${photoKeys.length} archiveMedia records for "${archivedSeed.name}"`);
    }

    for (let index = 0; index < archivedSeed.speakers.length; index++) {
      const speaker = archivedSeed.speakers[index];
      const contact = speaker.contactKey ? contactMap.get(speaker.contactKey) : undefined;
      const snapshotSeed = contact?.seed;

      const speakerData: InsertArchivedEventSpeaker = {
        archivedEventId: archived.id,
        contactId: contact?.record.id,
        role: speaker.role,
        roleAr: speaker.roleAr,
        displayOrder: speaker.displayOrder ?? index + 1,
        speakerNameEn: speaker.speakerNameEn ?? snapshotSeed?.nameEn,
        speakerNameAr: speaker.speakerNameAr ?? snapshotSeed?.nameAr ?? undefined,
        speakerTitle: speaker.speakerTitle ?? snapshotSeed?.title ?? undefined,
        speakerTitleAr: speaker.speakerTitleAr ?? snapshotSeed?.titleAr ?? undefined,
        speakerOrganization: speaker.speakerOrganization ?? contact?.organizationName,
        speakerOrganizationAr: speaker.speakerOrganizationAr ?? contact?.organizationNameAr,
        speakerPosition: speaker.speakerPosition ?? contact?.positionName,
        speakerPositionAr: speaker.speakerPositionAr ?? contact?.positionNameAr,
      };

      await db.insert(archivedEventSpeakers).values(speakerData);
    }
  }
}
export async function seedSampleData() {
  console.log('🔄 Clearing previous sample leads...');
  await clearSampleLeads();

  console.log('🔄 Clearing previous sample partnership data...');
  await clearSamplePartnershipData();

  console.log('🔄 Clearing previous sample archives...');
  await clearSampleArchivedEvents();

  console.log('🔄 Clearing previous sample events...');
  await clearSampleEvents();

  console.log('🔄 Clearing previous sample contacts...');
  await clearSampleContacts();

  // Check MinIO availability
  console.log('🗄️ Checking MinIO availability...');
  const minioAvailable = await minioService.isMinioAvailable();
  if (!minioAvailable) {
    console.warn('⚠️  MinIO is not available. Images will not be generated.');
    console.warn('   Please ensure MinIO is running or configure it in your environment variables.');
  } else {
    console.log('✅ MinIO is available and ready for image storage');
  }

  // Check AI image generation status
  const aiEnabled = imageGenerator.isAIImageGenerationEnabled();
  const provider = imageGenerator.getImageGenerationProvider();
  console.log(`🎨 Image generation: ${provider}`);
  if (!aiEnabled) {
    console.log('ℹ️  To use AI-generated images, set AI_IMAGE_PROVIDER=openai and AI_IMAGE_API_KEY in your .env file');
    console.log('   Using placeholder images for now...');
  }

  console.log('🗂️ Ensuring categories...');
  const categoryMap = await ensureCategories();

  console.log('🏢 Ensuring organizations and positions...');
  const organizationMap = await ensureOrganizations();
  const positionMap = await ensurePositions();

  console.log('📇 Seeding speaker-ready contacts with profile pictures...');
  const contactMap = await seedContacts(organizationMap, positionMap);

  console.log('👥 Preparing departments and Keycloak data...');
  const keycloakSeeder = new KeycloakSeeder();
  const departmentMap = await seedDepartments(keycloakSeeder);

  console.log('📅 Creating events, assignments, tasks, workflows, and speakers...');
  const eventMap = await seedEvents(departmentMap, categoryMap, contactMap);

  console.log('📧 Seeding event invitees and attendees for engagement analytics...');
  await seedEventInviteesAndAttendees(eventMap, contactMap);

  console.log('🗃️ Archiving rich harvest entries with event photos...');
  await seedArchivedEvents(categoryMap, contactMap, eventMap);

  console.log('🤝 Seeding partnership data (agreements, activities, contacts)...');
  const partnershipTypeMap = await ensurePartnershipTypes();
  const agreementTypeMap = await ensureAgreementTypes();
  await seedPartnershipData(organizationMap, partnershipTypeMap, agreementTypeMap, contactMap, eventMap, departmentMap);

  console.log('🎯 Seeding leads, interactions, and tasks...');
  await seedLeads(departmentMap);

  console.log('✅ Sample data loaded successfully. Default Keycloak password:', DEFAULT_PASSWORD);
  
  if (minioAvailable) {
    console.log('📸 Images have been uploaded to MinIO storage');
  }
  
  if (!aiEnabled) {
    console.log('💡 Tip: Configure AI_IMAGE_API_KEY to generate realistic images instead of placeholders');
  }
}

export async function resetSampleData() {
  console.log('🧹 Removing sample leads and interactions...');
  await clearSampleLeads();

  console.log('🧹 Removing sample partnership data...');
  await clearSamplePartnershipData();

  console.log('🧹 Removing sample archived events...');
  await clearSampleArchivedEvents();

  console.log('🧹 Removing sample events (cascades to workflows)...');
  await clearSampleEvents();

  console.log('🧹 Removing sample contacts...');
  await clearSampleContacts();

  console.log('🧹 Removing task template prerequisites...');
  await db.delete(taskTemplatePrerequisites);

  console.log('🧹 Removing sample departments...');
  await clearSampleDepartments();

  console.log('🧹 Removing sample local users...');
  const sampleUsernames = departmentSeeds.flatMap((dept) => dept.keycloakUsers.map((user) => user.username));
  if (sampleUsernames.length > 0) {
    await db.delete(users).where(inArray(users.username, sampleUsernames));
  }

  console.log('🧹 Removing sample Keycloak users and groups...');
  const keycloakSeeder = new KeycloakSeeder();
  await keycloakSeeder.deleteUsersByEmail(sampleUserEmails);
  // Delete all sample department groups (flat structure)
  for (const dept of departmentSeeds) {
    const groupPath = `/${dept.keycloakPathSegments.join('/')}`;
    await keycloakSeeder.deleteGroupByPath(groupPath);
  }

  console.log('♻️ Removing sample-only categories (if unused)...');
  const sampleCategoryNames = categorySeeds.map((c) => c.nameEn);
  const sampleCategories = await db
    .select({ id: categories.id })
    .from(categories)
    .where(inArray(categories.nameEn, sampleCategoryNames));

  if (sampleCategories.length > 0) {
    const sampleCategoryIds = sampleCategories.map((category) => category.id);
    const nonDemoReferences = await db
      .select({ categoryId: events.categoryId })
      .from(events)
      .where(
        and(
          inArray(events.categoryId, sampleCategoryIds),
          ne(events.source, SAMPLE_SOURCE),
        ),
      );

    const nonDemoCategoryIds = new Set(
      nonDemoReferences
        .map((row) => row.categoryId)
        .filter((categoryId): categoryId is number => typeof categoryId === 'number'),
    );

    const deletableCategoryIds = sampleCategoryIds.filter((id) => !nonDemoCategoryIds.has(id));
    if (deletableCategoryIds.length > 0) {
      await db.delete(categories).where(inArray(categories.id, deletableCategoryIds));
    }
  }

  console.log('♻️ Removing sample-only partnership types (if unused)...');
  const samplePartnershipTypeNames = partnershipTypeSeeds.map((pt) => pt.nameEn);
  const samplePartnershipTypesData = await db
    .select({ id: partnershipTypes.id })
    .from(partnershipTypes)
    .where(inArray(partnershipTypes.nameEn, samplePartnershipTypeNames));
  
  if (samplePartnershipTypesData.length > 0) {
    const samplePTIds = samplePartnershipTypesData.map((pt) => pt.id);
    // Check if any non-demo organizations reference these partnership types
    const nonDemoPTReferences = await db
      .select({ partnershipTypeId: organizations.partnershipTypeId })
      .from(organizations)
      .where(
        and(
          inArray(organizations.partnershipTypeId, samplePTIds),
          eq(organizations.isPartner, true)
        )
      );
    
    const usedPTIds = new Set(
      nonDemoPTReferences
        .map((row) => row.partnershipTypeId)
        .filter((id): id is number => typeof id === 'number')
    );
    
    const deletablePTIds = samplePTIds.filter((id) => !usedPTIds.has(id));
    if (deletablePTIds.length > 0) {
      await db.delete(partnershipTypes).where(inArray(partnershipTypes.id, deletablePTIds));
    }
  }

  console.log('♻️ Removing sample-only agreement types (if unused)...');
  const sampleAgreementTypeNames = agreementTypeSeeds.map((at) => at.nameEn);
  const sampleAgreementTypesData = await db
    .select({ id: agreementTypes.id })
    .from(agreementTypes)
    .where(inArray(agreementTypes.nameEn, sampleAgreementTypeNames));
  
  if (sampleAgreementTypesData.length > 0) {
    const sampleATIds = sampleAgreementTypesData.map((at) => at.id);
    // Check if any agreements reference these agreement types
    const agreementReferences = await db
      .select({ agreementTypeId: partnershipAgreements.agreementTypeId })
      .from(partnershipAgreements)
      .where(inArray(partnershipAgreements.agreementTypeId, sampleATIds));
    
    const usedATIds = new Set(
      agreementReferences
        .map((row) => row.agreementTypeId)
        .filter((id): id is number => typeof id === 'number')
    );
    
    const deletableATIds = sampleATIds.filter((id) => !usedATIds.has(id));
    if (deletableATIds.length > 0) {
      await db.delete(agreementTypes).where(inArray(agreementTypes.id, deletableATIds));
    }
  }

  console.log('✅ Sample data reset complete.');
}
const isCliExecution = process.argv[1]?.includes('seedSampleData');

async function main() {
  const args = process.argv.slice(2);
  const shouldReset = args.includes('--reset');

  try {
    if (shouldReset) {
      await resetSampleData();
    } else {
      await seedSampleData();
    }
  } catch (error) {
    console.error('❌ Failed to process sample data:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (isCliExecution) {
  void main();
}
