// Referenced from blueprint:javascript_database integration
import { 
  events, type Event, type InsertEvent, 
  users, type User, type InsertUser, 
  settings, type Settings,
  reminderQueue, type ReminderQueue, type InsertReminderQueue,
  departments, type Department, type InsertDepartment,
  departmentEmails, type DepartmentEmail, type InsertDepartmentEmail,
  departmentRequirements, type DepartmentRequirement, type InsertDepartmentRequirement,
  eventDepartments, type EventDepartment, type InsertEventDepartment,
  departmentAccounts, type DepartmentAccount, type InsertDepartmentAccount,
  authIdentities, type AuthIdentity, type InsertAuthIdentity,
  tasks, type Task, type InsertTask, type UpdateTask,
  taskComments, type TaskComment, type InsertTaskComment,
  taskCommentAttachments, type TaskCommentAttachment, type InsertTaskCommentAttachment,
  updates, type Update, type InsertUpdate,
  categories, type Category, type InsertCategory,
  archivedEvents, type ArchivedEvent, type InsertArchivedEvent, type UpdateArchivedEvent,
  archiveMedia, type ArchiveMedia, type InsertArchiveMedia,
  eventMedia, type EventMedia, type InsertEventMedia,
  // Contacts & Speakers
  organizations, type Organization, type InsertOrganization,
  positions, type Position, type InsertPosition,
  partnershipTypes, type PartnershipType, type InsertPartnershipType,
  agreementTypes, type AgreementType, type InsertAgreementType,
  countries, type Country,
  contacts, type Contact, type InsertContact, type UpdateContact,
  eventSpeakers, type EventSpeaker, type InsertEventSpeaker, type UpdateEventSpeaker,
  archivedEventSpeakers, type ArchivedEventSpeaker, type InsertArchivedEventSpeaker,
  eventAttendees, type EventAttendee, type InsertEventAttendee,
  eventInvitees, type EventInvitee, type InsertEventInvitee, type UpdateEventInvitee,
  // Email templates and custom emails
  emailTemplates, type EmailTemplate,
  eventCustomEmails, type EventCustomEmail, type InsertEventCustomEmail, type UpdateEventCustomEmail,
  invitationEmailJobs, type InvitationEmailJob, type InsertInvitationEmailJob,
  // Task Workflows
  taskTemplatePrerequisites, type TaskTemplatePrerequisite, type InsertTaskTemplatePrerequisite,
  eventWorkflows, type EventWorkflow, type InsertEventWorkflow,
  workflowTasks, type WorkflowTask, type InsertWorkflowTask,
  // Partnership Management
  partnershipAgreements, type PartnershipAgreement, type InsertPartnershipAgreement, type UpdatePartnershipAgreement,
  partnershipActivities, type PartnershipActivity, type InsertPartnershipActivity, type UpdatePartnershipActivity,
  partnershipContacts, type PartnershipContact, type InsertPartnershipContact, type UpdatePartnershipContact,
  partnershipComments, type PartnershipComment, type InsertPartnershipComment, type UpdatePartnershipComment,
  agreementAttachments, type AgreementAttachment, type InsertAgreementAttachment,
  // Lead Management
  leads, type Lead, type InsertLead, type UpdateLead,
  leadInteractions, type LeadInteraction, type InsertLeadInteraction, type UpdateLeadInteraction,
  contactTasks, type ContactTask, type InsertContactTask, type UpdateContactTask,
  contactTaskComments, type ContactTaskComment, type InsertContactTaskComment,
  contactTaskCommentAttachments, type ContactTaskCommentAttachment, type InsertContactTaskCommentAttachment,
  // Partnership Interactions
  partnershipInteractions, type PartnershipInteraction, type InsertPartnershipInteraction, type UpdatePartnershipInteraction,
  // Interaction Attachments
  interactionAttachments, type InteractionAttachment, type InsertInteractionAttachment,
} from "@shared/schema.mssql";
import { db } from "./db";
import { eq, and, lte, sql, inArray, desc, isNull, isNotNull, gte, like, or, asc, count } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import type { UpdateWithDepartment } from "./updates-formatter";
import { buildSettingsPayload, updateSettingsPayload, type SettingsUpdate } from "./services/configService";

const PostgresSessionStore = connectPg(session);

// Regional country codes (GCC + Middle East/North Africa)
const REGIONAL_COUNTRY_CODES = [
  'AE', // UAE - considered LOCAL
  'SA', // Saudi Arabia
  'KW', // Kuwait
  'QA', // Qatar
  'BH', // Bahrain
  'OM', // Oman
  'YE', // Yemen
  'IQ', // Iraq
  'JO', // Jordan
  'LB', // Lebanon
  'SY', // Syria
  'PS', // Palestine
  'EG', // Egypt
  'SD', // Sudan
  'LY', // Libya
  'TN', // Tunisia
  'DZ', // Algeria
  'MA', // Morocco
  'MR', // Mauritania
];

/**
 * Classify partnership scope based on country
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @returns 'local' | 'regional' | 'international'
 */
export function classifyPartnershipScope(countryCode: string | null): 'local' | 'regional' | 'international' {
  if (!countryCode) return 'international';
  if (countryCode === 'AE') return 'local';
  if (REGIONAL_COUNTRY_CODES.includes(countryCode)) return 'regional';
  return 'international';
}

function parseDateOnly(dateValue: string | null): Date | null {
  if (!dateValue) return null;
  // Use UTC midnight to avoid timezone drift when comparing date-only values
  return new Date(`${dateValue}T00:00:00.000Z`);
}

export interface IStorage {
  // Session store for authentication
  sessionStore: session.Store;
  
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(id: number, hashedPassword: string): Promise<void>;
  updateUserRole(id: number, role: 'admin' | 'superadmin' | 'department' | 'department_admin'): Promise<void>;
  
  // Event operations
  getAllEvents(): Promise<Event[]>;
  getEvent(id: string): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<boolean>;
  deleteAllEvents(): Promise<void>;
  
  // Category operations
  getCategories(): Promise<Category[]>;
  getCategoryById(id: number): Promise<Category | undefined>;
  getCategoryByName(nameEn: string): Promise<Category | undefined>;
  createCategory(data: InsertCategory): Promise<Category>;
  updateCategory(id: number, data: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;
  
  // Settings operations (aggregated settings payload)
  getSettings(): Promise<any>;
  updateSettings(data: SettingsUpdate): Promise<any>;
  
  // Reminder queue operations
  enqueueReminder(reminder: InsertReminderQueue): Promise<ReminderQueue>;
  getPendingReminders(beforeTime: Date): Promise<ReminderQueue[]>;
  getAllRemindersWithEvents(): Promise<Array<ReminderQueue & { event: Event }>>;
  getReminder(id: number): Promise<ReminderQueue | undefined>;
  deleteReminder(id: number): Promise<boolean>;
  markReminderSent(id: number): Promise<void>;
  markReminderError(id: number, errorMessage: string, isFinal?: boolean): Promise<void>;
  deleteRemindersForEvent(eventId: string): Promise<void>;
  
  // Department operations
  getAllDepartments(): Promise<Array<Department & { emails: DepartmentEmail[], requirements: DepartmentRequirement[] }>>;
  getDepartment(id: number): Promise<(Department & { emails: DepartmentEmail[], requirements: DepartmentRequirement[] }) | undefined>;
  getDepartmentsWithoutAccounts(): Promise<Array<Department & { emails: DepartmentEmail[], requirements: DepartmentRequirement[] }>>;
  createDepartment(data: InsertDepartment): Promise<Department>;
  updateDepartment(id: number, data: Partial<InsertDepartment>): Promise<Department | undefined>;
  deleteDepartment(id: number): Promise<boolean>;
  
  // Stakeholder email operations
  getDepartmentEmails(departmentId: number): Promise<DepartmentEmail[]>;
  createDepartmentEmail(data: InsertDepartmentEmail): Promise<DepartmentEmail>;
  updateDepartmentEmail(id: number, data: Partial<InsertDepartmentEmail>): Promise<DepartmentEmail | undefined>;
  deleteDepartmentEmail(id: number): Promise<boolean>;
  
  // Stakeholder requirement operations
  getDepartmentRequirements(departmentId: number): Promise<DepartmentRequirement[]>;
  getRequirementById(id: number): Promise<DepartmentRequirement | undefined>;
  getAllRequirements(): Promise<DepartmentRequirement[]>;
  createDepartmentRequirement(data: InsertDepartmentRequirement): Promise<DepartmentRequirement>;
  updateDepartmentRequirement(id: number, data: Partial<InsertDepartmentRequirement>): Promise<DepartmentRequirement | undefined>;
  deleteDepartmentRequirement(id: number): Promise<boolean>;
  
  // Event stakeholder operations
  getEventDepartments(eventId: string): Promise<EventDepartment[]>;
  getAllEventDepartmentsForAdmin(): Promise<Array<EventDepartment & { event: Event, department: Department }>>;
  getEventDepartmentByEventAndDepartment(eventId: string, departmentId: number): Promise<EventDepartment | undefined>;
  createEventDepartment(data: InsertEventDepartment): Promise<EventDepartment>;
  deleteEventDepartments(eventId: string): Promise<void>;
  getEventDepartmentsWithDetails(eventId: string): Promise<Array<EventDepartment & { stakeholder: Department, emails: DepartmentEmail[], requirements: DepartmentRequirement[], tasks: Task[] }>>;
  getEventsByDepartment(departmentId: number): Promise<Event[]>;
  isDepartmentAssignedToEvent(departmentId: number, eventId: string): Promise<boolean>;
  getEventDepartmentsByDepartmentId(eventId: string, departmentId: number): Promise<Array<EventDepartment & { stakeholder: Department, emails: DepartmentEmail[], requirements: DepartmentRequirement[] }>>;
  
  // Department account operations
  getDepartmentAccountByUserId(userId: number): Promise<DepartmentAccount | undefined>;
  updateDepartmentAccountLastLogin(userId: number): Promise<void>;
  updateDepartmentAccountLastLogin(userId: number): Promise<void>;
  getAllDepartmentAccounts(): Promise<Array<DepartmentAccount & { departmentName: string, username: string, primaryEmail: string }>>;
  getDepartmentAccountByDepartmentId(departmentId: number): Promise<DepartmentAccount | undefined>;
  createDepartmentAccount(data: InsertDepartmentAccount): Promise<DepartmentAccount>;
  deleteDepartmentAccount(id: number): Promise<boolean>;
  createAuthIdentity(data: InsertAuthIdentity): Promise<AuthIdentity>;
  deleteUser(id: number): Promise<boolean>;
  
  // Task operations
  getTasksByEventDepartment(eventDepartmentId: number): Promise<Task[]>;
  createTask(data: InsertTask): Promise<Task>;
  updateTask(taskId: number, data: UpdateTask): Promise<Task | undefined>;
  deleteTask(taskId: number): Promise<boolean>;
  getTask(taskId: number): Promise<Task | undefined>;
  getTaskWithEventDepartment(taskId: number): Promise<(Task & { eventDepartment: EventDepartment }) | undefined>;
  getEventDepartment(eventDepartmentId: number): Promise<EventDepartment | undefined>;

  // Pending tasks with date filtering
  getPendingTasksByRange(rangeStart: Date, rangeEnd: Date, departmentIds?: number[]): Promise<Array<{
    department: Department;
    events: Array<{
      event: Event;
      eventDepartment: EventDepartment;
      tasks: Array<Task & { effectiveDate: string }>;
    }>;
  }>>;
  
  // Task comment operations
  getTaskComments(taskId: number): Promise<Array<TaskComment & { authorUsername: string | null }>>;
  createTaskComment(data: InsertTaskComment): Promise<TaskComment>;
  deleteTaskComment(id: number): Promise<boolean>;
  
  // File attachments
  getTaskCommentAttachments(commentId: number): Promise<TaskCommentAttachment[]>;
  createTaskCommentAttachment(attachment: InsertTaskCommentAttachment): Promise<TaskCommentAttachment>;
  deleteTaskCommentAttachment(id: number): Promise<void>;
  getAllTaskCommentAttachments(): Promise<Array<TaskCommentAttachment & { comment: TaskComment; task: Task }>>;
  
  // Stakeholder dashboard
  getStakeholderDashboardData(departmentId: number): Promise<{
    stakeholder: Department;
    events: Array<{
      eventDepartment: EventDepartment;
      event: Event;
      tasks: Array<Task & { commentCount: number }>;
    }>;
  }>;
  
  // Daily reminders
  getEventDepartmentsWithPendingTasks(): Promise<Array<{
    eventDepartment: EventDepartment;
    stakeholder: Department;
    event: Event;
    tasks: Task[];
    primaryEmail: string;
  }>>;
  updateEventDepartmentLastReminder(id: number): Promise<void>;
  
  // Admin dashboard
  getAllTasksForAdminDashboard(): Promise<Array<{
    task: Task;
    eventDepartment?: EventDepartment;
    department: Department;
    event?: Event;
    contact?: { id: number; name: string; nameAr: string | null; status: string };
    partnership?: { id: number; nameEn: string; nameAr: string | null };
    taskType: 'event' | 'contact' | 'partnership';
  }>>;
  
  // Updates operations
  getUpdate(type: 'weekly' | 'monthly', periodStart: string): Promise<Update | undefined>;
  getUpdateForDepartment(type: 'weekly' | 'monthly', periodStart: string, departmentId: number): Promise<Update | undefined>;
  getLatestUpdate(type: 'weekly' | 'monthly'): Promise<Update | undefined>;
  getAllUpdates(type: 'weekly' | 'monthly'): Promise<Update[]>;
  getLatestUpdateForDepartment(type: 'weekly' | 'monthly', departmentId: number): Promise<Update | undefined>;
  getAllUpdatesForDepartment(type: 'weekly' | 'monthly', departmentId: number): Promise<Update[]>;
  getUpdatesForPeriodWithDepartments(type: 'weekly' | 'monthly', periodStart: string): Promise<UpdateWithDepartment[]>;
  createOrUpdateUpdate(data: InsertUpdate): Promise<Update>;
  
  // Keycloak integration methods
  getUserByKeycloakId(keycloakId: string): Promise<User | undefined>;
  createUserFromKeycloak(data: { username: string; email: string; keycloakId: string; role: 'superadmin' | 'admin' | 'department' }): Promise<User>;
  updateUserFromKeycloak(userId: number, data: { role?: 'superadmin' | 'admin' | 'department'; email?: string; keycloakId?: string }): Promise<User>;
  getUsersByDepartmentName(departmentName: string): Promise<User[]>;
  getUserDepartments(userId: number): Promise<Department[]>;
  linkUserToDepartment(userId: number, departmentId: number, primaryEmailId: number): Promise<DepartmentAccount>;
  getOrCreateDepartmentByName(name: string, keycloakGroupId?: string): Promise<Department>;
  getDepartmentByKeycloakGroupId(keycloakGroupId: string): Promise<Department | undefined>;
  getDepartmentEmails(departmentId: number): Promise<DepartmentEmail[]>;
  createDepartmentEmail(data: InsertDepartmentEmail): Promise<DepartmentEmail>;
  
  // Archive operations (الحصاد)
  getAllArchivedEvents(options?: { 
    page?: number; 
    limit?: number; 
    year?: number; 
    categoryId?: number; 
    search?: string;
  }): Promise<{ events: ArchivedEvent[]; total: number; page: number; limit: number }>;
  getArchivedEvent(id: number): Promise<ArchivedEvent | undefined>;
  getArchivedEventByOriginalId(eventId: string): Promise<ArchivedEvent | undefined>;
  createArchivedEvent(data: InsertArchivedEvent): Promise<ArchivedEvent>;
  updateArchivedEvent(id: number, data: UpdateArchivedEvent): Promise<ArchivedEvent | undefined>;
  deleteArchivedEvent(id: number): Promise<boolean>;
  getArchivedEventsByYear(year: number): Promise<ArchivedEvent[]>;
  getArchivedEventsByCategory(categoryId: number): Promise<ArchivedEvent[]>;
  searchArchivedEvents(query: string): Promise<ArchivedEvent[]>;
  getArchiveStats(): Promise<{
    totalEvents: number;
    totalAttendees: number;
    yearsActive: number[];
    categoriesUsed: number;
    eventsWithPhotos: number;
    eventsWithVideos: number;
  }>;
  getArchiveTimeline(): Promise<Array<{ year: number; month: number; count: number }>>;
  getArchiveYears(): Promise<number[]>;
  archiveEvent(eventId: string, archivedByUserId: number, archiveData?: Partial<InsertArchivedEvent>): Promise<ArchivedEvent>;
  unarchiveEvent(archivedEventId: number): Promise<boolean>;
  
  // Archive Media operations
  getArchiveMedia(archivedEventId: number): Promise<ArchiveMedia[]>;
  createArchiveMedia(data: InsertArchiveMedia): Promise<ArchiveMedia>;
  updateArchiveMedia(id: number, data: Partial<InsertArchiveMedia>): Promise<ArchiveMedia | undefined>;
  deleteArchiveMedia(id: number): Promise<boolean>;
  reorderArchiveMedia(archivedEventId: number, mediaIds: number[]): Promise<void>;
  
  // Event Media operations
  getEventMedia(eventId: string): Promise<EventMedia[]>;
  createEventMedia(data: InsertEventMedia): Promise<EventMedia>;
  updateEventMedia(id: number, data: Partial<InsertEventMedia>): Promise<EventMedia | undefined>;
  deleteEventMedia(id: number): Promise<boolean>;
  reorderEventMedia(eventId: string, mediaIds: number[]): Promise<void>;

  // ==================== Contacts & Speakers Operations ====================
  
  // Organization operations
  getAllOrganizations(): Promise<Array<Organization & { country?: Country }>>;
  getOrganization(id: number): Promise<(Organization & { country?: Country }) | undefined>;
  createOrganization(data: InsertOrganization): Promise<Organization>;
  updateOrganization(id: number, data: Partial<InsertOrganization>): Promise<Organization | undefined>;
  deleteOrganization(id: number): Promise<boolean>;
  
  // Position operations
  getAllPositions(): Promise<Position[]>;
  getPosition(id: number): Promise<Position | undefined>;
  createPosition(data: InsertPosition): Promise<Position>;
  updatePosition(id: number, data: Partial<InsertPosition>): Promise<Position | undefined>;
  deletePosition(id: number): Promise<boolean>;
  
  // Partnership Type operations
  getAllPartnershipTypes(): Promise<PartnershipType[]>;
  getPartnershipType(id: number): Promise<PartnershipType | undefined>;
  createPartnershipType(data: InsertPartnershipType): Promise<PartnershipType>;
  updatePartnershipType(id: number, data: Partial<InsertPartnershipType>): Promise<PartnershipType | undefined>;
  deletePartnershipType(id: number): Promise<boolean>;
  
  // Agreement Type operations
  getAllAgreementTypes(): Promise<AgreementType[]>;
  getAgreementType(id: number): Promise<AgreementType | undefined>;
  createAgreementType(data: InsertAgreementType): Promise<AgreementType>;
  updateAgreementType(id: number, data: Partial<InsertAgreementType>): Promise<AgreementType | undefined>;
  deleteAgreementType(id: number): Promise<boolean>;
  
  // Country operations (read-only)
  getAllCountries(): Promise<Country[]>;
  getCountry(id: number): Promise<Country | undefined>;
  
  // Contact operations
  getAllContacts(options?: {
    page?: number;
    limit?: number;
    search?: string;
    organizationId?: number;
    positionId?: number;
    countryId?: number;
    isEligibleSpeaker?: boolean;
  }): Promise<{ contacts: Array<Contact & { organization?: Organization; position?: Position; country?: Country }>; total: number; page: number; limit: number }>;
  getGroupedContacts(options: {
    groupBy: 'organization' | 'position' | 'country';
    groupId?: number;
    page?: number;
    limit?: number;
    search?: string;
    isEligibleSpeaker?: boolean;
  }): Promise<{
    groups: Array<{
      id: number;
      nameEn: string;
      nameAr: string | null;
      totalContacts: number;
      contacts: Array<Contact & { organization?: Organization; position?: Position; country?: Country }>;
    }>;
    totalGroups: number;
  }>;
  getContact(id: number): Promise<(Contact & { organization?: Organization; position?: Position; country?: Country }) | undefined>;
  getContactByEmail(email: string): Promise<Contact | undefined>;
  getContactByName(nameEn: string, organizationId?: number | null): Promise<Contact | undefined>;
  getEligibleSpeakers(): Promise<Array<Contact & { organization?: Organization; position?: Position; country?: Country }>>;
  createContact(data: InsertContact): Promise<Contact>;
  updateContact(id: number, data: UpdateContact): Promise<Contact | undefined>;
  deleteContact(id: number): Promise<boolean>;
  
  // Organization helper operations
  getOrganizationByName(nameEn: string): Promise<Organization | undefined>;
  
  // Position helper operations
  getPositionByName(nameEn: string): Promise<Position | undefined>;
  
  // Country helper operations
  getCountryByCode(code: string): Promise<Country | undefined>;
  
  // Event Speaker operations
  getEventSpeakers(eventId: string): Promise<Array<EventSpeaker & { contact: Contact & { organization?: Organization; position?: Position; country?: Country } }>>;
  addEventSpeaker(data: InsertEventSpeaker): Promise<EventSpeaker>;
  updateEventSpeaker(id: number, data: UpdateEventSpeaker): Promise<EventSpeaker | undefined>;
  removeEventSpeaker(id: number): Promise<boolean>;
  deleteEventSpeakers(eventId: string): Promise<boolean>;
  getContactEvents(leadId: number): Promise<{ events: Event[]; archivedEvents: ArchivedEvent[] }>;
  
  // Contact statistics operations
  getContactsStatistics(limit: number): Promise<{
    totalContacts: number;
    contactsWithEvents: number;
    contactsWithoutEvents: number;
    totalEventAttendances: number;
    averageAttendancePerContact: number;
    totalInvitations: number;
    totalRSVPs: number;
    totalRegistrations: number;
    overallConversionRate: number;
    overallRegistrationRate: number;
    topAttendees: Array<{
      leadId: number;
      nameEn: string;
      nameAr: string;
      organization: string | null;
      eventsAttended: number;
      speakerAppearances: number;
      invitationsReceived: number;
      rsvpConfirmed: number;
      registrations: number;
    }>;
  }>;
  
  getOrganizationStatistics(options: {
    limit: number;
    sortBy: string;
    sortOrder: string;
  }): Promise<{
    totalOrganizations: number;
    organizationsWithAttendance: number;
    organizationStatistics: Array<{
      organizationId: number;
      organizationNameEn: string;
      organizationNameAr: string | null;
      totalContacts: number;
      activeContacts: number;
      totalEventAttendances: number;
      uniqueEventsAttended: number;
      averageAttendancePerContact: number;
      attendanceRate: number;
      speakerAppearances: number;
      topAttendee: {
        leadId: number;
        nameEn: string;
        eventsAttended: number;
      } | null;
    }>;
    overallAverageAttendanceRate: number;
  }>;
  
  // Engagement analytics
  getEngagementAnalytics(): Promise<{
    engagementByCategory: Array<{
      categoryId: number;
      categoryNameEn: string;
      categoryNameAr: string | null;
      totalEvents: number;
      totalInvitees: number;
      totalRegistrations: number;
      totalRSVPs: number;
      totalAttendees: number;
      totalSpeakers: number;
      registrationRate: number;
      rsvpRate: number;
      attendanceRate: number;
      conversionRate: number;
    }>;
    engagementByMonth: Array<{
      month: number;
      year: number;
      totalEvents: number;
      totalInvitees: number;
      totalRegistrations: number;
      totalRSVPs: number;
      totalAttendees: number;
    }>;
    conversionFunnel: {
      invited: number;
      emailsSent: number;
      registered: number;
      rsvped: number;
      attended: number;
      emailSentRate: number;
      registrationRate: number;
      rsvpRate: number;
      attendanceRate: number;
      overallConversion: number;
    };
    topPerformingEvents: Array<{
      eventId: string;
      eventName: string;
      eventNameAr: string | null;
      eventDate: string;
      categoryName: string | null;
      categoryNameAr: string | null;
      totalInvitees: number;
      totalAttendees: number;
      attendanceRate: number;
    }>;
    engagementTiers: {
      highly_engaged: number;
      moderately_engaged: number;
      low_engaged: number;
      not_engaged: number;
    };
    geographicEngagement: Array<{
      countryCode: string;
      countryNameEn: string;
      countryNameAr: string | null;
      uniqueContacts: number;
      totalInvitations: number;
      totalAttendances: number;
    }>;
    eventTypeEngagement: Array<{
      eventType: string;
      eventScope: string;
      totalEvents: number;
      totalInvitees: number;
      totalAttendees: number;
      averageAttendance: number;
      attendanceRate: number;
    }>;
  }>;
  
  // Event Attendee operations
  getEventAttendees(eventId: string): Promise<Array<EventAttendee & { contact: Contact & { organization?: Organization; position?: Position; country?: Country } }>>;
  addEventAttendee(data: InsertEventAttendee): Promise<EventAttendee>;
  removeEventAttendee(eventId: string, leadId: number): Promise<boolean>;
  getContactAttendedEvents(leadId: number): Promise<Event[]>;
  
  // Event Invitee operations
  getEventInvitees(eventId: string): Promise<Array<EventInvitee & { contact: Contact & { organization?: Organization; position?: Position; country?: Country } }>>;
  addEventInvitee(data: InsertEventInvitee): Promise<EventInvitee>;
  updateEventInvitee(eventId: string, leadId: number, data: UpdateEventInvitee): Promise<EventInvitee>;
  removeEventInvitee(eventId: string, leadId: number): Promise<boolean>;
  getContactInvitedEvents(leadId: number): Promise<Event[]>;
  
  // Email template operations
  getEmailTemplate(type: string, language: string): Promise<EmailTemplate | undefined>;
  
  // Event custom email operations
  getEventCustomEmail(eventId: string): Promise<EventCustomEmail | undefined>;
  createEventCustomEmail(data: InsertEventCustomEmail): Promise<EventCustomEmail>;
  updateEventCustomEmail(id: number, data: UpdateEventCustomEmail): Promise<EventCustomEmail | undefined>;
  deleteEventCustomEmail(id: number): Promise<boolean>;
  
  // Archived Event Speaker operations
  getArchivedEventSpeakers(archivedEventId: number): Promise<ArchivedEventSpeaker[]>;
  addArchivedEventSpeaker(data: InsertArchivedEventSpeaker): Promise<ArchivedEventSpeaker>;
  removeArchivedEventSpeaker(id: number): Promise<boolean>;
  
  // ==================== Task Workflow Operations ====================
  
  // Task Template Prerequisite operations
  getTaskTemplatePrerequisites(taskTemplateId: number): Promise<TaskTemplatePrerequisite[]>;
  getAllPrerequisitesForTemplate(taskTemplateId: number): Promise<DepartmentRequirement[]>;
  getTaskTemplatesWithPrerequisites(departmentId: number): Promise<Array<DepartmentRequirement & { prerequisites: DepartmentRequirement[] }>>;
  createTaskTemplatePrerequisite(data: InsertTaskTemplatePrerequisite): Promise<TaskTemplatePrerequisite>;
  deleteTaskTemplatePrerequisite(taskTemplateId: number, prerequisiteTemplateId: number): Promise<boolean>;
  getAvailablePrerequisites(taskTemplateId: number): Promise<DepartmentRequirement[]>;
  
  // Event Workflow operations
  getEventWorkflows(eventId: string): Promise<EventWorkflow[]>;
  getWorkflow(workflowId: number): Promise<EventWorkflow | undefined>;
  getWorkflowWithTasks(workflowId: number): Promise<(EventWorkflow & { 
    tasks: Array<WorkflowTask & { task: Task & { department: Department; event: Event } }> 
  }) | undefined>;
  createEventWorkflow(data: InsertEventWorkflow): Promise<EventWorkflow>;
  deleteEventWorkflow(workflowId: number): Promise<boolean>;
  
  // Workflow Task operations
  getWorkflowTasks(workflowId: number): Promise<WorkflowTask[]>;
  addTaskToWorkflow(data: InsertWorkflowTask): Promise<WorkflowTask>;
  removeTaskFromWorkflow(workflowId: number, taskId: number): Promise<boolean>;
  getTaskWorkflow(taskId: number): Promise<(EventWorkflow & { tasks: WorkflowTask[] }) | undefined>;
  
  // Workflow Status Management
  getWaitingTasksForPrerequisite(prerequisiteTaskId: number): Promise<Task[]>;
  activateWaitingTasks(prerequisiteTaskId: number): Promise<Task[]>;
  
  // Department Workflow Visibility  
  getWorkflowsForDepartment(departmentId: number): Promise<Array<EventWorkflow & { 
    tasks: Array<WorkflowTask & { task: Task & { department: Department; event: Event } }>;
    event: Event;
  }>>;
  canDepartmentViewWorkflow(departmentId: number, workflowId: number): Promise<boolean>;
  
  // Task dependency checks
  isTaskPrerequisiteForOthers(taskId: number): Promise<boolean>;
  getDependentTasks(taskId: number): Promise<Task[]>;
  
  // ==================== Partnership Management Operations ====================
  
  // Partner Organization operations
  getAllPartners(options?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    search?: string;
    sortBy?: string;
  }): Promise<{ partners: (Organization & { latestActivityDate?: string | null })[]; total: number; page: number; limit: number }>;
  updatePartnership(id: number, data: Partial<InsertOrganization>): Promise<Organization | undefined>;
  getPartnerStats(): Promise<{
    totalPartners: number;
    activePartnerships: number;
    pendingAgreements: number;
    expiringSoon: number;
  }>;
  
  // Partnership Agreement operations
  getPartnershipAgreements(organizationId: number): Promise<any[]>;
  getPartnershipAgreement(id: number): Promise<PartnershipAgreement | undefined>;
  createPartnershipAgreement(data: InsertPartnershipAgreement): Promise<PartnershipAgreement>;
  updatePartnershipAgreement(id: number, data: UpdatePartnershipAgreement): Promise<PartnershipAgreement | undefined>;
  deletePartnershipAgreement(id: number): Promise<boolean>;
  
  // Partnership Activity operations
  getPartnershipActivities(organizationId: number): Promise<any[]>;
  getPartnershipActivity(id: number): Promise<PartnershipActivity | undefined>;
  getActivitiesByEventId(eventId: string): Promise<any[]>;
  createPartnershipActivity(data: InsertPartnershipActivity): Promise<PartnershipActivity>;
  updatePartnershipActivity(id: number, data: UpdatePartnershipActivity): Promise<PartnershipActivity | undefined>;
  deletePartnershipActivity(id: number): Promise<boolean>;
  getPartnerEvents(organizationId: number): Promise<Event[]>;
  
  // Partnership Contact operations
  getPartnershipContacts(organizationId: number): Promise<Array<PartnershipContact & { contact: Contact }>>;
  addPartnershipContact(data: InsertPartnershipContact): Promise<PartnershipContact>;
  updatePartnershipContact(id: number, data: UpdatePartnershipContact): Promise<PartnershipContact | undefined>;
  removePartnershipContact(id: number): Promise<boolean>;
  
  // Partnership Comment operations
  getPartnershipComments(organizationId: number): Promise<Array<PartnershipComment & { authorUsername: string | null }>>;
  getPartnershipComment(id: number): Promise<PartnershipComment | undefined>;
  createPartnershipComment(data: InsertPartnershipComment): Promise<PartnershipComment>;
  updatePartnershipComment(id: number, data: UpdatePartnershipComment): Promise<PartnershipComment | undefined>;
  deletePartnershipComment(id: number): Promise<boolean>;
  
  // Agreement Attachment operations
  getAgreementAttachments(agreementId: number): Promise<AgreementAttachment[]>;
  getAgreementAttachment(id: number): Promise<AgreementAttachment | undefined>;
  getAgreementAttachmentByObjectKey(objectKey: string): Promise<AgreementAttachment | undefined>;
  createAgreementAttachment(data: InsertAgreementAttachment): Promise<AgreementAttachment>;
  deleteAgreementAttachment(id: number): Promise<boolean>;
  
  // Partnership Inactivity Monitoring operations
  getInactivePartnerships(thresholdDate: Date): Promise<Array<Organization & { daysSinceLastActivity: number }>>;
  updatePartnershipLastActivity(organizationId: number, activityDate?: Date): Promise<void>;
  updatePartnershipInactivitySettings(organizationId: number, settings: { inactivityThresholdMonths?: number; notifyOnInactivity?: boolean }): Promise<Organization | undefined>;
  markInactivityNotificationSent(organizationId: number): Promise<void>;
  
  // ==================== Lead Management Operations ====================
  
  // Lead operations
  getAllLeads(options?: {
    search?: string;
    type?: string;
    status?: string;
  }): Promise<(Lead & { interactionsCount?: number; tasksCount?: number; pendingTasksCount?: number })[]>;
  getLead(id: number): Promise<Lead | undefined>;
  getLeadWithDetails(id: number): Promise<(Lead & { 
    organization?: Organization;
    interactionCount?: number;
    taskCount?: number;
  }) | undefined>;
  createLead(data: InsertLead): Promise<Lead>;
  updateLead(id: number, data: UpdateLead): Promise<Lead | undefined>;
  deleteLead(id: number): Promise<boolean>;
  
  // Contact Interaction operations
  getLeadInteractions(leadId: number): Promise<LeadInteraction[]>;
  getLeadInteraction(id: number): Promise<LeadInteraction | undefined>;
  createLeadInteraction(data: InsertLeadInteraction): Promise<LeadInteraction>;
  updateLeadInteraction(id: number, data: UpdateLeadInteraction): Promise<LeadInteraction | undefined>;
  deleteLeadInteraction(id: number): Promise<boolean>;
  
  // Partnership Interaction operations
  getPartnershipInteractions(organizationId: number): Promise<PartnershipInteraction[]>;
  getPartnershipInteraction(id: number): Promise<PartnershipInteraction | undefined>;
  createPartnershipInteraction(data: InsertPartnershipInteraction): Promise<PartnershipInteraction>;
  updatePartnershipInteraction(id: number, data: UpdatePartnershipInteraction): Promise<PartnershipInteraction | undefined>;
  deletePartnershipInteraction(id: number): Promise<boolean>;
  
  // Partnership Task operations
  getPartnershipTasks(partnershipId: number): Promise<Task[]>;
  createPartnershipTask(data: InsertTask): Promise<Task>;
  getPartnershipTasksForDashboard(departmentId: number): Promise<any[]>;
  getPartnershipTaskWithDetails(id: number): Promise<any>;
  
  // Contact Task operations
  getContactTasks(leadId: number): Promise<ContactTask[]>;
  getContactTask(id: number): Promise<ContactTask | undefined>;
  getContactTaskWithDepartment(id: number): Promise<(ContactTask & { department?: Department }) | undefined>;
  getContactTasksByDepartment(departmentId: number): Promise<(ContactTask & { contact?: { id: number; name: string; status: string } })[]>;
  getContactTasksForDashboard(departmentId: number): Promise<any[]>;
  getContactTaskWithDetails(id: number): Promise<any>;
  createContactTask(data: InsertContactTask): Promise<ContactTask>;
  updateContactTask(id: number, data: UpdateContactTask): Promise<ContactTask | undefined>;
  deleteContactTask(id: number): Promise<boolean>;
  
  // Contact Task Comment operations
  getContactTaskComments(contactTaskId: number): Promise<any[]>;
  createContactTaskComment(data: { contactTaskId: number; authorUserId?: number; body: string }): Promise<any>;
  deleteContactTaskComment(id: number): Promise<boolean>;
  
  // Contact Task Comment Attachment operations
  createContactTaskCommentAttachment(data: { commentId: number; fileName: string; storedFileName: string; fileSize: number; mimeType: string; uploadedByUserId?: number }): Promise<any>;
  getContactTaskCommentAttachment(id: number): Promise<any>;
  deleteContactTaskCommentAttachment(id: number): Promise<boolean>;
  
  // Interaction Attachment operations
  getInteractionAttachments(interactionId: number, entityType: 'lead' | 'partnership'): Promise<InteractionAttachment[]>;
  getInteractionAttachment(id: number): Promise<InteractionAttachment | undefined>;
  createInteractionAttachment(data: InsertInteractionAttachment): Promise<InteractionAttachment>;
  deleteInteractionAttachment(id: number): Promise<{ objectKey: string } | null>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false, // Sessions table is managed by Drizzle ORM
      tableName: 'sessions', // Match the table name from our schema
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.createdAt);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserPassword(id: number, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, id));
  }

  async updateUserRole(id: number, role: 'admin' | 'superadmin' | 'department' | 'department_admin'): Promise<void> {
    await db
      .update(users)
      .set({ role })
      .where(eq(users.id, id));
  }

  // Event operations
  async getAllEvents(): Promise<Event[]> {
    const eventsWithCategories = await db
      .select({
        event: events,
        category: categories,
      })
      .from(events)
      .leftJoin(categories, eq(events.categoryId, categories.id))
      .orderBy(events.startDate);

    // Map the results to include category names
    return eventsWithCategories.map(({ event, category }) => ({
      ...event,
      category: category?.nameEn || event.category,
      categoryAr: category?.nameAr || event.categoryAr,
    }));
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const result = await db
      .select({
        event: events,
        category: categories,
      })
      .from(events)
      .leftJoin(categories, eq(events.categoryId, categories.id))
      .where(eq(events.id, id))
      .offset(1);

    if (result.length === 0) return undefined;

    const { event, category } = result[0];
    return {
      ...event,
      category: category?.nameEn || event.category,
      categoryAr: category?.nameAr || event.categoryAr,
    };
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const [event] = await db
      .insert(events)
      .values(insertEvent)
      .returning();
    return event;
  }

  async updateEvent(id: string, updateData: Partial<InsertEvent>): Promise<Event | undefined> {
    const [event] = await db
      .update(events)
      .set(updateData)
      .where(eq(events.id, id))
      .returning();
    return event || undefined;
  }

  async deleteEvent(id: string): Promise<boolean> {
    const result = await db
      .delete(events)
      .where(eq(events.id, id))
      .returning();
    return result.length > 0;
  }

  async deleteAllEvents(): Promise<void> {
    await db.delete(events);
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.nameEn);
  }

  async getCategoryById(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category || undefined;
  }

  async getCategoryByName(nameEn: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.nameEn, nameEn));
    return category || undefined;
  }

  async createCategory(data: InsertCategory): Promise<Category> {
    const [category] = await db.insert(categories).values(data).returning();
    return category;
  }

  async updateCategory(id: number, data: Partial<InsertCategory>): Promise<Category | undefined> {
    const [category] = await db
      .update(categories)
      .set(data)
      .where(eq(categories.id, id))
      .returning();
    return category || undefined;
  }

  async deleteCategory(id: number): Promise<boolean> {
    const result = await db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning();
    return result.length > 0;
  }

  // Settings operations
  async getSettings(): Promise<any> {
    // Load the aggregated settings payload from the normalized tables
    return await buildSettingsPayload();
  }

  async updateSettings(data: SettingsUpdate): Promise<any> {
    // Delegate to config service to update the normalized config tables
    return await updateSettingsPayload(data as any);
  }

  // Reminder queue operations
  async enqueueReminder(insertReminder: InsertReminderQueue): Promise<ReminderQueue> {
    // Use onConflictDoNothing to handle duplicate reminders gracefully
    const [reminder] = await db
      .insert(reminderQueue)
      .values(insertReminder)
      .onConflictDoNothing()
      .returning();
    
    // If no reminder was inserted (due to conflict), query for the existing one
    if (!reminder) {
      const [existing] = await db
        .select()
        .from(reminderQueue)
        .where(
          and(
            eq(reminderQueue.eventId, insertReminder.eventId),
            eq(reminderQueue.scheduledFor, insertReminder.scheduledFor),
            eq(reminderQueue.reminderType, insertReminder.reminderType)
          )
        )
        .offset(1);
      return existing;
    }
    
    return reminder;
  }

  async getPendingReminders(beforeTime: Date): Promise<ReminderQueue[]> {
    // Mark reminders older than 24 hours as expired to avoid sending stale reminders
    const oneDayAgo = new Date(beforeTime.getTime() - 24 * 60 * 60 * 1000);
    
    await db
      .update(reminderQueue)
      .set({ 
        status: 'expired',
        errorMessage: 'Reminder expired - more than 24 hours old'
      })
      .where(
        and(
          eq(reminderQueue.status, 'pending'),
          lte(reminderQueue.scheduledFor, oneDayAgo)
        )
      );
    
    // Return only pending reminders that are due but not expired
    return await db
      .select()
      .from(reminderQueue)
      .where(
        and(
          eq(reminderQueue.status, 'pending'),
          lte(reminderQueue.scheduledFor, beforeTime)
        )
      );
  }

  async markReminderSent(id: number): Promise<void> {
    await db
      .update(reminderQueue)
      .set({ 
        status: 'sent', 
        sentAt: new Date(),
        attempts: sql`${reminderQueue.attempts} + 1`
      })
      .where(eq(reminderQueue.id, id));
  }

  async markReminderError(id: number, errorMessage: string, isFinal: boolean = false): Promise<void> {
    await db
      .update(reminderQueue)
      .set({ 
        status: isFinal ? 'error' : 'pending', // Keep pending for retry unless max attempts exceeded
        errorMessage,
        lastAttempt: new Date(),
        attempts: sql`${reminderQueue.attempts} + 1`
      })
      .where(eq(reminderQueue.id, id));
  }

  async deleteRemindersForEvent(eventId: string): Promise<void> {
    await db
      .delete(reminderQueue)
      .where(eq(reminderQueue.eventId, eventId));
  }

  async getAllRemindersWithEvents(): Promise<Array<ReminderQueue & { event: Event }>> {
    const results = await db
      .select()
      .from(reminderQueue)
      .leftJoin(events, eq(reminderQueue.eventId, events.id))
      .orderBy(reminderQueue.scheduledFor);
    
    return results.map(row => ({
      ...row.reminder_queue,
      event: row.events!
    }));
  }

  async getReminder(id: number): Promise<ReminderQueue | undefined> {
    const [reminder] = await db
      .select()
      .from(reminderQueue)
      .where(eq(reminderQueue.id, id));
    return reminder || undefined;
  }

  async resetReminderForResend(id: number, scheduledFor: Date): Promise<ReminderQueue | undefined> {
    const [reminder] = await db
      .update(reminderQueue)
      .set({
        status: 'pending',
        scheduledFor,
        attempts: 0,
        lastAttempt: null,
        sentAt: null,
        errorMessage: null,
      })
      .where(eq(reminderQueue.id, id))
      .returning();

    return reminder || undefined;
  }

  async deleteReminder(id: number): Promise<boolean> {
    const result = await db
      .delete(reminderQueue)
      .where(eq(reminderQueue.id, id))
      .returning();
    return result.length > 0;
  }

  // Stakeholder operations
  async getAllDepartments(): Promise<Array<Department & { emails: DepartmentEmail[], requirements: DepartmentRequirement[] }>> {
    const allStakeholders = await db.select().from(departments).orderBy(departments.name);
    
    const result = await Promise.all(
      allStakeholders.map(async (stakeholder) => {
        const emails = await this.getDepartmentEmails(stakeholder.id);
        const requirements = await this.getDepartmentRequirements(stakeholder.id);
        return { ...stakeholder, emails, requirements };
      })
    );
    
    return result;
  }

  async getDepartment(id: number): Promise<(Department & { emails: DepartmentEmail[], requirements: DepartmentRequirement[] }) | undefined> {
    const [stakeholder] = await db.select().from(departments).where(eq(departments.id, id));
    if (!stakeholder) return undefined;
    
    const emails = await this.getDepartmentEmails(id);
    const requirements = await this.getDepartmentRequirements(id);
    
    return { ...stakeholder, emails, requirements };
  }

  async getDepartmentsWithoutAccounts(): Promise<Array<Department & { emails: DepartmentEmail[], requirements: DepartmentRequirement[] }>> {
    const allStakeholdersWithDetails = await this.getAllDepartments();
    const accountsData = await db.select().from(departmentAccounts);
    const departmentIdsWithAccounts = new Set(accountsData.map(acc => acc.departmentId));
    
    return allStakeholdersWithDetails.filter(
      stakeholder => !departmentIdsWithAccounts.has(stakeholder.id)
    );
  }

  async createDepartment(data: InsertDepartment): Promise<Department> {
    const [stakeholder] = await db
      .insert(departments)
      .values(data)
      .returning();
    return stakeholder;
  }

  async updateDepartment(id: number, data: Partial<InsertDepartment>): Promise<Department | undefined> {
    const [stakeholder] = await db
      .update(departments)
      .set(data)
      .where(eq(departments.id, id))
      .returning();
    return stakeholder || undefined;
  }

  async deleteDepartment(id: number): Promise<boolean> {
    const result = await db
      .delete(departments)
      .where(eq(departments.id, id))
      .returning();
    return result.length > 0;
  }

  // Department email operations
  async getDepartmentEmails(departmentId: number): Promise<DepartmentEmail[]> {
    return await db
      .select()
      .from(departmentEmails)
      .where(eq(departmentEmails.departmentId, departmentId))
      .orderBy(departmentEmails.isPrimary);
  }

  async createDepartmentEmail(data: InsertDepartmentEmail): Promise<DepartmentEmail> {
    const [email] = await db
      .insert(departmentEmails)
      .values(data)
      .returning();
    return email;
  }

  async updateDepartmentEmail(id: number, data: Partial<InsertDepartmentEmail>): Promise<DepartmentEmail | undefined> {
    const [email] = await db
      .update(departmentEmails)
      .set(data)
      .where(eq(departmentEmails.id, id))
      .returning();
    return email || undefined;
  }

  async deleteDepartmentEmail(id: number): Promise<boolean> {
    const result = await db
      .delete(departmentEmails)
      .where(eq(departmentEmails.id, id))
      .returning();
    return result.length > 0;
  }

  // Stakeholder requirement operations
  async getDepartmentRequirements(departmentId: number): Promise<DepartmentRequirement[]> {
    return await db
      .select()
      .from(departmentRequirements)
      .where(eq(departmentRequirements.departmentId, departmentId))
      .orderBy(departmentRequirements.isDefault);
  }

  async getRequirementById(id: number): Promise<DepartmentRequirement | undefined> {
    const [requirement] = await db
      .select()
      .from(departmentRequirements)
      .where(eq(departmentRequirements.id, id));
    return requirement || undefined;
  }

  async getAllRequirements(): Promise<DepartmentRequirement[]> {
    return await db
      .select()
      .from(departmentRequirements)
      .orderBy(departmentRequirements.departmentId, departmentRequirements.title);
  }

  async createDepartmentRequirement(data: InsertDepartmentRequirement): Promise<DepartmentRequirement> {
    const [requirement] = await db
      .insert(departmentRequirements)
      .values(data)
      .returning();
    return requirement;
  }

  async updateDepartmentRequirement(id: number, data: Partial<InsertDepartmentRequirement>): Promise<DepartmentRequirement | undefined> {
    const [requirement] = await db
      .update(departmentRequirements)
      .set(data)
      .where(eq(departmentRequirements.id, id))
      .returning();
    return requirement || undefined;
  }

  async deleteDepartmentRequirement(id: number): Promise<boolean> {
    const result = await db
      .delete(departmentRequirements)
      .where(eq(departmentRequirements.id, id))
      .returning();
    return result.length > 0;
  }

  // Event stakeholder operations
  async getEventDepartments(eventId: string): Promise<EventDepartment[]> {
    return await db
      .select()
      .from(eventDepartments)
      .where(eq(eventDepartments.eventId, eventId));
  }

  async getAllEventDepartmentsForAdmin(): Promise<Array<EventDepartment & { event: Event, department: Department }>> {
    const allEventDepartments = await db
      .select()
      .from(eventDepartments);
    
    const result = await Promise.all(
      allEventDepartments.map(async (es) => {
        const event = await this.getEvent(es.eventId);
        const stakeholder = await this.getDepartment(es.departmentId);
        
        if (!event || !stakeholder) {
          throw new Error(`Event or stakeholder not found for event-stakeholder ${es.id}`);
        }
        
        return {
          ...es,
          event,
          department: {
            id: stakeholder.id,
            name: stakeholder.name,
            nameAr: stakeholder.nameAr,
            keycloakGroupId: stakeholder.keycloakGroupId,
            active: stakeholder.active,
            ccList: stakeholder.ccList,
            createdAt: stakeholder.createdAt,
          },
        };
      })
    );
    
    return result;
  }

  async getEventDepartmentByEventAndDepartment(eventId: string, departmentId: number): Promise<EventDepartment | undefined> {
    const [existing] = await db
      .select()
      .from(eventDepartments)
      .where(and(eq(eventDepartments.eventId, eventId), eq(eventDepartments.departmentId, departmentId)))
      .offset(1);

    return existing;
  }

  async createEventDepartment(data: InsertEventDepartment): Promise<EventDepartment> {
    const [eventStakeholder] = await db
      .insert(eventDepartments)
      .values(data)
      .returning();
    return eventStakeholder;
  }

  async deleteEventDepartments(eventId: string): Promise<void> {
    await db
      .delete(eventDepartments)
      .where(eq(eventDepartments.eventId, eventId));
  }

  async getEventDepartmentsWithDetails(eventId: string): Promise<Array<EventDepartment & { stakeholder: Department, emails: DepartmentEmail[], requirements: DepartmentRequirement[], tasks: Task[] }>> {
    const eventStakeholderRecords = await this.getEventDepartments(eventId);
    
    const result = await Promise.all(
      eventStakeholderRecords.map(async (es) => {
        const stakeholder = await this.getDepartment(es.departmentId);
        if (!stakeholder) {
          throw new Error(`Stakeholder ${es.departmentId} not found`);
        }
        
        // Fetch tasks for this event stakeholder
        const tasks = await this.getTasksByEventDepartment(es.id);
        
        return {
          ...es,
          stakeholder: {
            id: stakeholder.id,
            name: stakeholder.name,
            nameAr: stakeholder.nameAr,
            keycloakGroupId: stakeholder.keycloakGroupId,
            active: stakeholder.active,
            ccList: stakeholder.ccList,
            createdAt: stakeholder.createdAt,
          },
          emails: stakeholder.emails,
          requirements: stakeholder.requirements,
          tasks,
        };
      })
    );
    
    return result;
  }

  async getEventsByDepartment(departmentId: number): Promise<Event[]> {
    const eventStakeholderRecords = await db
      .select()
      .from(eventDepartments)
      .where(eq(eventDepartments.departmentId, departmentId));
    
    const eventIds = eventStakeholderRecords.map(es => es.eventId);
    if (eventIds.length === 0) {
      return [];
    }
    
    const eventRecords = await db
      .select()
      .from(events)
      .where(inArray(events.id, eventIds))
      .orderBy(events.startDate);
    
    return eventRecords;
  }

  async isDepartmentAssignedToEvent(departmentId: number, eventId: string): Promise<boolean> {
    const [assignment] = await db
      .select()
      .from(eventDepartments)
      .where(
        and(
          eq(eventDepartments.departmentId, departmentId),
          eq(eventDepartments.eventId, eventId)
        )
      );
    return !!assignment;
  }

  async getEventDepartmentsByDepartmentId(eventId: string, departmentId: number): Promise<Array<EventDepartment & { stakeholder: Department, emails: DepartmentEmail[], requirements: DepartmentRequirement[] }>> {
    const eventStakeholderRecords = await db
      .select()
      .from(eventDepartments)
      .where(
        and(
          eq(eventDepartments.eventId, eventId),
          eq(eventDepartments.departmentId, departmentId)
        )
      );
    
    const result = await Promise.all(
      eventStakeholderRecords.map(async (es) => {
        const stakeholder = await this.getDepartment(es.departmentId);
        if (!stakeholder) {
          throw new Error(`Stakeholder ${es.departmentId} not found`);
        }
        return {
          ...es,
          stakeholder: {
            id: stakeholder.id,
            name: stakeholder.name,
            nameAr: stakeholder.nameAr,
            keycloakGroupId: stakeholder.keycloakGroupId,
            active: stakeholder.active,
            ccList: stakeholder.ccList,
            createdAt: stakeholder.createdAt,
          },
          emails: stakeholder.emails,
          requirements: stakeholder.requirements,
        };
      })
    );
    
    return result;
  }

  // Stakeholder account operations
  async getDepartmentAccountByUserId(userId: number): Promise<DepartmentAccount | undefined> {
    const [account] = await db
      .select()
      .from(departmentAccounts)
      .where(eq(departmentAccounts.userId, userId));
    return account || undefined;
  }

  async updateDepartmentAccountLastLogin(userId: number): Promise<void> {
    await db
      .update(departmentAccounts)
      .set({ lastLoginAt: new Date() })
      .where(eq(departmentAccounts.userId, userId));
  }

  async getAllDepartmentAccounts(): Promise<Array<DepartmentAccount & { departmentName: string, username: string, primaryEmail: string }>> {
    const results = await db
      .select({
        id: departmentAccounts.id,
        userId: departmentAccounts.userId,
        departmentId: departmentAccounts.departmentId,
        primaryEmailId: departmentAccounts.primaryEmailId,
        lastLoginAt: departmentAccounts.lastLoginAt,
        createdAt: departmentAccounts.createdAt,
        departmentName: departments.name,
        username: users.username,
        primaryEmail: departmentEmails.email,
      })
      .from(departmentAccounts)
      .innerJoin(departments, eq(departmentAccounts.departmentId, departments.id))
      .innerJoin(users, eq(departmentAccounts.userId, users.id))
      .innerJoin(departmentEmails, eq(departmentAccounts.primaryEmailId, departmentEmails.id))
      .orderBy(departments.name);
    
    return results;
  }

  async getDepartmentAccountByDepartmentId(departmentId: number): Promise<DepartmentAccount | undefined> {
    const [account] = await db
      .select()
      .from(departmentAccounts)
      .where(eq(departmentAccounts.departmentId, departmentId));
    return account || undefined;
  }

  async createDepartmentAccount(data: InsertDepartmentAccount): Promise<DepartmentAccount> {
    const [account] = await db
      .insert(departmentAccounts)
      .values(data)
      .returning();
    return account;
  }

  async deleteDepartmentAccount(id: number): Promise<boolean> {
    const result = await db
      .delete(departmentAccounts)
      .where(eq(departmentAccounts.id, id))
      .returning();
    return result.length > 0;
  }

  async createAuthIdentity(data: InsertAuthIdentity): Promise<AuthIdentity> {
    const [identity] = await db
      .insert(authIdentities)
      .values(data)
      .returning();
    return identity;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning();
    return result.length > 0;
  }

  async getEventDepartment(eventDepartmentId: number): Promise<EventDepartment | undefined> {
    const [eventStakeholder] = await db
      .select()
      .from(eventDepartments)
      .where(eq(eventDepartments.id, eventDepartmentId));
    return eventStakeholder || undefined;
  }

  async getTasksByEventDepartment(eventDepartmentId: number): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.eventDepartmentId, eventDepartmentId))
      .orderBy(tasks.createdAt);
  }

  async createTask(data: InsertTask): Promise<Task> {
    const [task] = await db
      .insert(tasks)
      .values(data)
      .returning();
    return task;
  }

  async updateTask(taskId: number, data: UpdateTask): Promise<Task | undefined> {
    const updateData: any = {
      ...data,
      updatedAt: new Date(),
    };

    if (data.status === 'completed' && !data.completedAt) {
      updateData.completedAt = new Date();
    } else if (data.status && data.status !== 'completed') {
      updateData.completedAt = undefined;
    }

    const [task] = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, taskId))
      .returning();
    return task || undefined;
  }

  async deleteTask(taskId: number): Promise<boolean> {
    const result = await db
      .delete(tasks)
      .where(eq(tasks.id, taskId))
      .returning();
    return result.length > 0;
  }

  async getTask(taskId: number): Promise<Task | undefined> {
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId));
    return task || undefined;
  }

  async getTaskWithEventDepartment(taskId: number): Promise<(Task & { eventDepartment: EventDepartment }) | undefined> {
    const results = await db
      .select()
      .from(tasks)
      .leftJoin(eventDepartments, eq(tasks.eventDepartmentId, eventDepartments.id))
      .where(eq(tasks.id, taskId));
    
    if (results.length === 0 || !results[0].event_departments) {
      return undefined;
    }

    return {
      ...results[0].tasks,
      eventDepartment: results[0].event_departments!,
    };
  }

  async getTaskComments(taskId: number): Promise<Array<TaskComment & { authorUsername: string | null }>> {
    const results = await db
      .select({
        id: taskComments.id,
        taskId: taskComments.taskId,
        authorUserId: taskComments.authorUserId,
        body: taskComments.body,
        createdAt: taskComments.createdAt,
        authorUsername: users.username,
      })
      .from(taskComments)
      .leftJoin(users, eq(taskComments.authorUserId, users.id))
      .where(eq(taskComments.taskId, taskId))
      .orderBy(taskComments.createdAt);
    
    return results.map(row => ({
      id: row.id,
      taskId: row.taskId,
      authorUserId: row.authorUserId,
      body: row.body,
      createdAt: row.createdAt,
      authorUsername: row.authorUsername,
    }));
  }

  async createTaskComment(data: InsertTaskComment): Promise<TaskComment> {
    const [comment] = await db
      .insert(taskComments)
      .values(data)
      .returning();
    return comment;
  }

  async deleteTaskComment(id: number): Promise<boolean> {
    await db
      .delete(taskComments)
      .where(eq(taskComments.id, id));
    return true;
  }

  // File attachment operations
  async getTaskCommentAttachments(commentId: number): Promise<TaskCommentAttachment[]> {
    return await db
      .select()
      .from(taskCommentAttachments)
      .where(eq(taskCommentAttachments.commentId, commentId))
      .orderBy(taskCommentAttachments.uploadedAt);
  }

  async createTaskCommentAttachment(attachment: InsertTaskCommentAttachment): Promise<TaskCommentAttachment> {
    const [result] = await db
      .insert(taskCommentAttachments)
      .values(attachment)
      .returning();
    return result;
  }

  async deleteTaskCommentAttachment(id: number): Promise<void> {
    await db
      .delete(taskCommentAttachments)
      .where(eq(taskCommentAttachments.id, id));
  }

  async getAllTaskCommentAttachments(): Promise<Array<TaskCommentAttachment & { comment: TaskComment; task: Task }>> {
    const results = await db
      .select({
        attachment: taskCommentAttachments,
        comment: taskComments,
        task: tasks,
        eventStakeholder: eventDepartments,
        event: events,
      })
      .from(taskCommentAttachments)
      .leftJoin(taskComments, eq(taskCommentAttachments.commentId, taskComments.id))
      .leftJoin(tasks, eq(taskComments.taskId, tasks.id))
      .leftJoin(eventDepartments, eq(tasks.eventDepartmentId, eventDepartments.id))
      .leftJoin(events, eq(eventDepartments.eventId, events.id))
      .orderBy(desc(taskCommentAttachments.uploadedAt));
    
    return results.map(row => ({
      ...row.attachment,
      comment: row.comment!,
      task: row.task!,
      eventStakeholder: row.eventStakeholder,
      event: row.event,
    })) as any;
  }

  async getStakeholderDashboardData(departmentId: number): Promise<{
    stakeholder: Department;
    events: Array<{
      eventDepartment: EventDepartment;
      event: Event;
      tasks: Array<Task & { commentCount: number }>;
    }>;
  }> {
    // First fetch the stakeholder record
    const stakeholderData = await this.getDepartment(departmentId);
    if (!stakeholderData) {
      throw new Error(`Stakeholder ${departmentId} not found`);
    }

    // Then fetch the events array
    const eventStakeholderRecords = await db
      .select()
      .from(eventDepartments)
      .where(eq(eventDepartments.departmentId, departmentId));

    const eventsArray = await Promise.all(
      eventStakeholderRecords.map(async (es) => {
        const event = await this.getEvent(es.eventId);
        if (!event) {
          throw new Error(`Event ${es.eventId} not found`);
        }
        const tasksList = await this.getTasksByEventDepartment(es.id);
        const taskIds = tasksList.map((task) => task.id);

        const commentCounts = taskIds.length === 0
          ? []
          : await db
              .select({
                taskId: taskComments.taskId,
                count: sql<number>`count(${taskComments.id})`,
              })
              .from(taskComments)
              .where(inArray(taskComments.taskId, taskIds))
              .groupBy(taskComments.taskId);

        const commentCountMap = commentCounts.reduce<Record<number, number>>((acc, { taskId, count }) => {
          acc[taskId] = Number(count);
          return acc;
        }, {});

        const tasksWithCounts = tasksList.map((task) => ({
          ...task,
          commentCount: commentCountMap[task.id] ?? 0,
        }));
        return {
          eventDepartment: es,
          event,
          tasks: tasksWithCounts,
        };
      })
    );

    // Return object with stakeholder and events
    return {
      stakeholder: {
        id: stakeholderData.id,
        name: stakeholderData.name,
        nameAr: stakeholderData.nameAr,
        keycloakGroupId: stakeholderData.keycloakGroupId,
        active: stakeholderData.active,
        ccList: stakeholderData.ccList,
        createdAt: stakeholderData.createdAt,
      },
      events: eventsArray,
    };
  }

  async getEventDepartmentsWithPendingTasks(): Promise<Array<{
    eventDepartment: EventDepartment;
    stakeholder: Department;
    event: Event;
    tasks: Task[];
    primaryEmail: string;
  }>> {
    // Get all event-stakeholder assignments
    const allEventDepartments = await db
      .select()
      .from(eventDepartments);

    const result: Array<{
      eventDepartment: EventDepartment;
      stakeholder: Department;
      event: Event;
      tasks: Task[];
      primaryEmail: string;
    }> = [];

    for (const es of allEventDepartments) {
      // Get tasks for this event-stakeholder
      const tasksList = await this.getTasksByEventDepartment(es.id);
      
      // Filter for incomplete tasks
      const incompleteTasks = tasksList.filter(
        t => t.status === 'pending' || t.status === 'in_progress'
      );

      // Skip if no incomplete tasks
      if (incompleteTasks.length === 0) {
        continue;
      }

      // Get stakeholder details
      const stakeholderData = await this.getDepartment(es.departmentId);
      if (!stakeholderData) {
        continue;
      }

      // Get event details
      const event = await this.getEvent(es.eventId);
      if (!event) {
        continue;
      }

      // Get primary email
      const primaryEmailRecord = stakeholderData.emails.find(e => e.isPrimary);
      const primaryEmail = primaryEmailRecord?.email || stakeholderData.emails[0]?.email || '';

      if (!primaryEmail) {
        continue;
      }

      result.push({
        eventDepartment: es,
        stakeholder: {
          id: stakeholderData.id,
          name: stakeholderData.name,
          nameAr: stakeholderData.nameAr,
          keycloakGroupId: stakeholderData.keycloakGroupId,
          active: stakeholderData.active,
          ccList: stakeholderData.ccList,
          createdAt: stakeholderData.createdAt,
        },
        event,
        tasks: incompleteTasks,
        primaryEmail,
      });
    }

    return result;
  }

  async updateEventDepartmentLastReminder(id: number): Promise<void> {
    await db
      .update(eventDepartments)
      .set({ lastReminderSentAt: new Date() })
      .where(eq(eventDepartments.id, id));
  }

  async getAllTasksForAdminDashboard(): Promise<Array<{
    task: Task;
    eventDepartment?: EventDepartment;
    department: Department;
    event?: Event;
    contact?: { id: number; name: string; nameAr: string | null; status: string };
    partnership?: { id: number; nameEn: string; nameAr: string | null };
    taskType: 'event' | 'contact' | 'partnership';
  }>> {
    // Get all tasks
    const allTasks = await db
      .select()
      .from(tasks)
      .orderBy(desc(tasks.createdAt));

    const result: Array<{
      task: Task;
      eventDepartment?: EventDepartment;
      department: Department;
      event?: Event;
      contact?: { id: number; name: string; nameAr: string | null; status: string };
      partnership?: { id: number; nameEn: string; nameAr: string | null };
      taskType: 'event' | 'contact' | 'partnership';
    }> = [];

    for (const task of allTasks) {
      // Check if this is an event-based task
      if (task.eventDepartmentId) {
        // Get event stakeholder
        const eventStakeholder = await this.getEventDepartment(task.eventDepartmentId);
        if (!eventStakeholder) {
          continue;
        }

        // Get stakeholder details
        const stakeholderData = await this.getDepartment(eventStakeholder.departmentId);
        if (!stakeholderData) {
          continue;
        }

        // Get event details
        const event = await this.getEvent(eventStakeholder.eventId);
        if (!event) {
          continue;
        }

        result.push({
          task,
          taskType: 'event',
          eventDepartment: eventStakeholder,
          department: {
            id: stakeholderData.id,
            name: stakeholderData.name,
            nameAr: stakeholderData.nameAr,
            keycloakGroupId: stakeholderData.keycloakGroupId,
            active: stakeholderData.active,
            ccList: stakeholderData.ccList,
            createdAt: stakeholderData.createdAt,
          },
          event,
        });
      } 
      // Check if this is a contact-based task
      else if (task.leadId) {
        // Get contact details
        const [contactData] = await db
          .select()
          .from(leads)
          .where(eq(leads.id, task.leadId))
          .offset(1);
        
        if (!contactData) {
          continue;
        }

        // Get department details (contact tasks have direct department assignment)
        let departmentData: Department | undefined;
        if (task.departmentId) {
          departmentData = await this.getDepartment(task.departmentId);
        }
        
        if (!departmentData) {
          // Create a placeholder for unassigned tasks
          departmentData = {
            id: 0,
            name: 'Unassigned',
            nameAr: 'غير معين',
            keycloakGroupId: null,
            active: true,
            ccList: null,
            createdAt: new Date(),
          };
        }

        result.push({
          task,
          taskType: 'contact',
          department: departmentData,
          contact: {
            id: contactData.id,
            name: contactData.name,
            nameAr: contactData.nameAr,
            status: contactData.status,
          },
        });
      }
      // Check if this is a partnership-based task
      else if (task.partnershipId) {
        // Get organization details
        const [orgData] = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, task.partnershipId))
          .offset(1);
        
        if (!orgData) {
          continue;
        }

        // Get department details (partnership tasks have direct department assignment)
        let departmentData: Department | undefined;
        if (task.departmentId) {
          departmentData = await this.getDepartment(task.departmentId);
        }
        
        if (!departmentData) {
          // Create a placeholder for unassigned tasks
          departmentData = {
            id: 0,
            name: 'Unassigned',
            nameAr: 'غير معين',
            keycloakGroupId: null,
            active: true,
            ccList: null,
            createdAt: new Date(),
          };
        }

        result.push({
          task,
          taskType: 'partnership',
          department: departmentData,
          partnership: {
            id: orgData.id,
            nameEn: orgData.nameEn,
            nameAr: orgData.nameAr,
          },
        });
      }
    }

    return result;
  }

  async getPendingTasksByRange(
    rangeStart: Date,
    rangeEnd: Date,
    departmentIds?: number[],
  ): Promise<Array<{
    department: Department;
    events: Array<{
      event: Event;
      eventDepartment: EventDepartment;
      tasks: Array<Task & { effectiveDate: string }>;
    }>;
  }>> {
    const departmentFilter = departmentIds && departmentIds.length > 0
      ? inArray(eventDepartments.departmentId, departmentIds)
      : undefined;

    const pendingTasks = await db
      .select({ task: tasks, eventDepartment: eventDepartments, event: events, department: departments })
      .from(tasks)
      .innerJoin(eventDepartments, eq(tasks.eventDepartmentId, eventDepartments.id))
      .innerJoin(events, eq(eventDepartments.eventId, events.id))
      .innerJoin(departments, eq(eventDepartments.departmentId, departments.id))
      .where(and(eq(tasks.status, 'pending'), departmentFilter ?? sql`TRUE`))
      .orderBy(desc(tasks.dueDate), desc(tasks.createdAt));

    const startMs = rangeStart.getTime();
    const endMs = rangeEnd.getTime();

    const grouped = new Map<number, { department: Department; events: Map<string, { event: Event; eventDepartment: EventDepartment; tasks: Array<Task & { effectiveDate: string }>; }>; }>();

    for (const record of pendingTasks) {
      const taskDate = parseDateOnly(record.task.dueDate) ?? parseDateOnly(record.event.startDate);
      const eventStart = parseDateOnly(record.event.startDate);
      const eventEnd = parseDateOnly(record.event.endDate) ?? eventStart;

      if (!taskDate || !eventStart || !eventEnd) {
        continue;
      }

      const overlapsEventSpan = eventStart.getTime() <= endMs && eventEnd.getTime() >= startMs;
      const effectiveDate = record.task.dueDate
        ? taskDate
        : overlapsEventSpan && eventStart.getTime() < startMs
          ? new Date(startMs)
          : eventStart;

      const effectiveMs = effectiveDate.getTime();
      if (effectiveMs < startMs || effectiveMs > endMs) {
        continue;
      }

      if (!grouped.has(record.department.id)) {
        grouped.set(record.department.id, { department: record.department, events: new Map() });
      }

      const departmentEntry = grouped.get(record.department.id)!;
      if (!departmentEntry.events.has(record.event.id)) {
        departmentEntry.events.set(record.event.id, {
          event: record.event,
          eventDepartment: record.eventDepartment,
          tasks: [],
        });
      }

      departmentEntry.events.get(record.event.id)!.tasks.push({
        ...record.task,
        effectiveDate: effectiveDate.toISOString(),
      });
    }

    return Array.from(grouped.values()).map((departmentEntry) => ({
      department: departmentEntry.department,
      events: Array.from(departmentEntry.events.values()).map((eventEntry) => ({
        ...eventEntry,
        tasks: eventEntry.tasks.sort((a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime()),
      })),
    }));
  }
  
  // Updates operations
  async getUpdate(type: 'weekly' | 'monthly', periodStart: string): Promise<Update | undefined> {
    const [update] = await db
      .select()
      .from(updates)
      .where(and(eq(updates.type, type), eq(updates.periodStart, periodStart), isNull(updates.departmentId)));
    return update || undefined;
  }
  
  async getUpdateForDepartment(type: 'weekly' | 'monthly', periodStart: string, departmentId: number): Promise<Update | undefined> {
    const [update] = await db
      .select()
      .from(updates)
      .where(and(eq(updates.type, type), eq(updates.periodStart, periodStart), eq(updates.departmentId, departmentId)));
    return update || undefined;
  }
  
  async getLatestUpdate(type: 'weekly' | 'monthly'): Promise<Update | undefined> {
    const [update] = await db
      .select()
      .from(updates)
      .where(and(eq(updates.type, type), isNull(updates.departmentId)))
      .orderBy(desc(updates.periodStart))
      .offset(1);
    return update || undefined;
  }
  
  async getAllUpdates(type: 'weekly' | 'monthly'): Promise<Update[]> {
    return await db
      .select()
      .from(updates)
      .where(and(eq(updates.type, type), isNull(updates.departmentId)))
      .orderBy(desc(updates.periodStart));
  }
  
  async getLatestUpdateForDepartment(type: 'weekly' | 'monthly', departmentId: number): Promise<Update | undefined> {
    const [update] = await db
      .select()
      .from(updates)
      .where(and(eq(updates.type, type), eq(updates.departmentId, departmentId)))
      .orderBy(desc(updates.periodStart))
      .offset(1);
    return update || undefined;
  }
  
  async getAllUpdatesForDepartment(type: 'weekly' | 'monthly', departmentId: number): Promise<Update[]> {
    return await db
      .select()
      .from(updates)
      .where(and(eq(updates.type, type), eq(updates.departmentId, departmentId)))
      .orderBy(desc(updates.periodStart));
  }

  async getUpdatesForPeriodWithDepartments(type: 'weekly' | 'monthly', periodStart: string): Promise<UpdateWithDepartment[]> {
    const results = await db
      .select({
        update: updates,
        departmentName: departments.name,
        departmentNameAr: departments.nameAr,
      })
      .from(updates)
      .leftJoin(departments, eq(updates.departmentId, departments.id))
      .where(and(eq(updates.type, type), eq(updates.periodStart, periodStart)))
      .orderBy(departments.name, updates.departmentId);

    return results.map((row) => ({
      ...row.update,
      departmentName: row.departmentName,
      departmentNameAr: row.departmentNameAr,
    }));
  }

  async createOrUpdateUpdate(data: InsertUpdate): Promise<Update> {
    // Check if an update already exists for this type, period, and departmentId combination
    let existing: Update | undefined;
    if (data.departmentId) {
      existing = await this.getUpdateForDepartment(data.type, data.periodStart, data.departmentId);
    } else {
      existing = await this.getUpdate(data.type, data.periodStart);
    }
    
    if (existing) {
      // Update existing
      const [updated] = await db
        .update(updates)
        .set({ 
          content: data.content, 
          updatedAt: new Date(),
          updatedByUserId: data.updatedByUserId 
        })
        .where(eq(updates.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new
      const [created] = await db
        .insert(updates)
        .values(data)
        .returning();
      return created;
    }
  }

  // ==================== Keycloak Integration Methods ====================
  
  /**
   * Get user by Keycloak ID
   */
  async getUserByKeycloakId(keycloakId: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.keycloakId, keycloakId))
      .offset(1);
    return user;
  }

  /**
   * Create user from Keycloak authentication
   */
  async createUserFromKeycloak(data: {
    username: string;
    email: string;
    keycloakId: string;
    role: 'superadmin' | 'admin' | 'department' | 'department_admin';
  }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        username: data.username,
        email: data.email,
        keycloakId: data.keycloakId,
        role: data.role,
        password: null, // Keycloak-only users don't need local password
      })
      .returning();
    return user;
  }

  /**
   * Update user from Keycloak (sync role, email, and Keycloak ID changes)
   */
  async updateUserFromKeycloak(
    userId: number,
    data: { role?: 'superadmin' | 'admin' | 'department' | 'department_admin'; email?: string; keycloakId?: string }
  ): Promise<User> {
    const [updated] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  /**
   * Get all users belonging to a specific department (by department name/Keycloak group)
   * 
   * IMPORTANT: This method returns users who are part of a department/Keycloak group.
   * It's used to retrieve email addresses for department mailing lists.
   * 
   * The implementation fetches users from department_accounts table.
   * For Keycloak-only users, this requires them to have logged in at least once
   * so their group membership is recorded in the database.
   * 
   * Future Enhancement: Could be extended to fetch directly from Keycloak Admin API
   * to include users who haven't logged in yet.
   */
  async getUsersByDepartmentName(departmentName: string): Promise<User[]> {
    const result = await db
      .select({ user: users })
      .from(users)
      .innerJoin(departmentAccounts, eq(users.id, departmentAccounts.userId))
      .innerJoin(departments, eq(departmentAccounts.departmentId, departments.id))
      .where(eq(departments.name, departmentName));
    
    return result.map(r => r.user);
  }

  /**
   * Get all departments for a user
   */
  async getUserDepartments(userId: number): Promise<Department[]> {
    const result = await db
      .select({ department: departments })
      .from(departments)
      .innerJoin(departmentAccounts, eq(departments.id, departmentAccounts.departmentId))
      .where(eq(departmentAccounts.userId, userId));
    
    return result.map(r => r.department);
  }

  /**
   * Link user to department (create department account)
   * Used when a Keycloak user logs in and we need to sync their group membership
   */
  async linkUserToDepartment(userId: number, departmentId: number, primaryEmailId: number): Promise<DepartmentAccount> {
    const [account] = await db
      .insert(departmentAccounts)
      .values({ userId, departmentId, primaryEmailId })
      .returning();
    return account;
  }

  /**
   * Get or create department by name (for Keycloak group sync)
   * 
   * This method maps Keycloak group IDs (e.g., "dept_1") to department records.
   * If a department doesn't exist, it creates a placeholder that admins can update
   * with proper English and Arabic names later.
   */
  async getOrCreateDepartmentByName(name: string, keycloakGroupId?: string): Promise<Department> {
    // First, try to find by Keycloak group ID if provided
    if (keycloakGroupId) {
      const [existingByGroupId] = await db
        .select()
        .from(departments)
        .where(eq(departments.keycloakGroupId, keycloakGroupId))
        .offset(1);
      
      if (existingByGroupId) {
        return existingByGroupId;
      }
    }
    
    // Try to find by name
    const [existingByName] = await db
      .select()
      .from(departments)
      .where(eq(departments.name, name))
      .offset(1);
    
    if (existingByName) {
      // Update Keycloak group ID if provided and not set
      if (keycloakGroupId && !existingByName.keycloakGroupId) {
        const [updated] = await db
          .update(departments)
          .set({ keycloakGroupId })
          .where(eq(departments.id, existingByName.id))
          .returning();
        return updated;
      }
      return existingByName;
    }

    // Create new department with placeholder name
    // Admins can update the English/Arabic names later via UI
    const [created] = await db
      .insert(departments)
      .values({ 
        name: name, // Use Keycloak group ID as initial name
        keycloakGroupId,
        nameAr: null, // To be set by admin
      })
      .returning();
    
    console.log(`[Storage] Created department placeholder: ${name} (Keycloak group: ${keycloakGroupId})`);
    return created;
  }

  /**
   * Get department by Keycloak group ID
   */
  async getDepartmentByKeycloakGroupId(keycloakGroupId: string): Promise<Department | undefined> {
    const [department] = await db
      .select()
      .from(departments)
      .where(eq(departments.keycloakGroupId, keycloakGroupId))
      .offset(1);
    return department;
  }

  // ==================== Archive Operations (الحصاد) ====================

  async getAllArchivedEvents(options?: {
    page?: number;
    limit?: number;
    year?: number;
    categoryId?: number;
    search?: string;
    speakerId?: number;
  }): Promise<{ events: ArchivedEvent[]; total: number; page: number; limit: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 12;
    const offset = (page - 1) * limit;

    // Build condition for filtering
    const buildWhereCondition = () => {
      const conditions = [];
      
      if (options?.year) {
        const yearStart = `${options.year}-01-01`;
        const yearEnd = `${options.year}-12-31`;
        conditions.push(and(
          gte(archivedEvents.startDate, yearStart),
          lte(archivedEvents.startDate, yearEnd)
        ));
      }

      if (options?.categoryId) {
        conditions.push(eq(archivedEvents.categoryId, options.categoryId));
      }

      if (options?.speakerId) {
        conditions.push(sql`${archivedEvents.id} IN (
          SELECT ${archivedEventSpeakers.archivedEventId}
          FROM ${archivedEventSpeakers}
          WHERE ${archivedEventSpeakers.contactId} = ${options.speakerId}
        )`);
      }

      if (options?.search) {
        const searchPattern = `%${options.search}%`;
        conditions.push(or(
          like(archivedEvents.name, searchPattern),
          like(archivedEvents.nameAr, searchPattern),
          like(archivedEvents.description, searchPattern),
          like(archivedEvents.descriptionAr, searchPattern),
          like(archivedEvents.highlights, searchPattern),
          like(archivedEvents.highlightsAr, searchPattern)
        ));
      }

      if (conditions.length === 0) return undefined;
      if (conditions.length === 1) return conditions[0];
      return and(...conditions);
    };

    const whereCondition = buildWhereCondition();

    // Execute queries with proper typing
    const eventsResult = whereCondition 
      ? await db.select().from(archivedEvents).where(whereCondition).orderBy(desc(archivedEvents.startDate)).offset(limit).offset(offset)
      : await db.select().from(archivedEvents).orderBy(desc(archivedEvents.startDate)).offset(limit).offset(offset);
    
    const countResult = whereCondition
      ? await db.select({ count: count() }).from(archivedEvents).where(whereCondition)
      : await db.select({ count: count() }).from(archivedEvents);

    // Fetch speakers for all archived events in this page
    const eventIds = eventsResult.map(e => e.id);
    const allSpeakers = eventIds.length > 0 
      ? await db.select().from(archivedEventSpeakers).where(inArray(archivedEventSpeakers.archivedEventId, eventIds))
      : [];

    // Group speakers by archived event ID
    const speakersByEventId = allSpeakers.reduce((acc, speaker) => {
      if (!acc[speaker.archivedEventId]) {
        acc[speaker.archivedEventId] = [];
      }
      acc[speaker.archivedEventId].push(speaker);
      return acc;
    }, {} as Record<number, typeof allSpeakers>);

    // Add speakers to each event
    const eventsWithSpeakers = eventsResult.map(event => ({
      ...event,
      speakers: speakersByEventId[event.id] || [],
    }));

    return {
      events: eventsWithSpeakers,
      total: countResult[0]?.count || 0,
      page,
      limit,
    };
  }

  async getArchivedEvent(id: number): Promise<ArchivedEvent | undefined> {
    const [event] = await db
      .select()
      .from(archivedEvents)
      .where(eq(archivedEvents.id, id));
    return event || undefined;
  }

  async getArchivedEventByOriginalId(eventId: string): Promise<ArchivedEvent | undefined> {
    const [event] = await db
      .select()
      .from(archivedEvents)
      .where(eq(archivedEvents.originalEventId, eventId));
    return event || undefined;
  }

  async createArchivedEvent(data: InsertArchivedEvent): Promise<ArchivedEvent> {
    const [event] = await db
      .insert(archivedEvents)
      .values(data)
      .returning();
    return event;
  }

  async updateArchivedEvent(id: number, data: UpdateArchivedEvent): Promise<ArchivedEvent | undefined> {
    const [event] = await db
      .update(archivedEvents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(archivedEvents.id, id))
      .returning();
    return event || undefined;
  }

  async deleteArchivedEvent(id: number): Promise<boolean> {
    // First, get the archived event to find the original event ID
    const archivedEvent = await db
      .select()
      .from(archivedEvents)
      .where(eq(archivedEvents.id, id))
      .offset(1);
    
    if (archivedEvent.length === 0) {
      console.log(`[Archive] Delete: No archived event found with id ${id}`);
      return false;
    }

    console.log(`[Archive] Delete: Found archived event`, {
      id: archivedEvent[0].id,
      originalEventId: archivedEvent[0].originalEventId,
      name: archivedEvent[0].name
    });

    // If there was an original event, reset its isArchived flag
    if (archivedEvent[0].originalEventId) {
      console.log(`[Archive] Delete: Resetting isArchived=false for event ${archivedEvent[0].originalEventId}`);
      const updateResult = await db
        .update(events)
        .set({ isArchived: false })
        .where(eq(events.id, archivedEvent[0].originalEventId))
        .returning();
      console.log(`[Archive] Delete: Updated ${updateResult.length} events`);
    } else {
      console.log(`[Archive] Delete: No originalEventId, skipping event update`);
    }

    // Delete the archived event
    const result = await db
      .delete(archivedEvents)
      .where(eq(archivedEvents.id, id))
      .returning();
    console.log(`[Archive] Delete: Deleted ${result.length} archived events`);
    return result.length > 0;
  }

  async getArchivedEventsByYear(year: number): Promise<ArchivedEvent[]> {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    return await db
      .select()
      .from(archivedEvents)
      .where(and(
        gte(archivedEvents.startDate, yearStart),
        lte(archivedEvents.startDate, yearEnd)
      ))
      .orderBy(desc(archivedEvents.startDate));
  }

  async getArchivedEventsByCategory(categoryId: number): Promise<ArchivedEvent[]> {
    return await db
      .select()
      .from(archivedEvents)
      .where(eq(archivedEvents.categoryId, categoryId))
      .orderBy(desc(archivedEvents.startDate));
  }

  async searchArchivedEvents(query: string): Promise<ArchivedEvent[]> {
    const searchPattern = `%${query}%`;
    return await db
      .select()
      .from(archivedEvents)
      .where(or(
        like(archivedEvents.name, searchPattern),
        like(archivedEvents.nameAr, searchPattern),
        like(archivedEvents.description, searchPattern),
        like(archivedEvents.descriptionAr, searchPattern),
        like(archivedEvents.highlights, searchPattern),
        like(archivedEvents.highlightsAr, searchPattern)
      ))
      .orderBy(desc(archivedEvents.startDate))
      .offset(50);
  }

  async getArchiveStats(): Promise<{
    totalEvents: number;
    totalAttendees: number;
    yearsActive: number[];
    categoriesUsed: number;
    eventsWithPhotos: number;
    eventsWithVideos: number;
  }> {
    const allEvents = await db.select().from(archivedEvents);
    
    const totalEvents = allEvents.length;
    const totalAttendees = allEvents.reduce((sum, e) => sum + (e.actualAttendees || 0), 0);
    
    // Get unique years
    const yearsSet = new Set<number>();
    allEvents.forEach(e => {
      const year = new Date(e.startDate).getFullYear();
      yearsSet.add(year);
    });
    const yearsActive = Array.from(yearsSet).sort((a, b) => b - a);
    
    // Count unique categories
    const categoriesSet = new Set<number>();
    allEvents.forEach(e => {
      if (e.categoryId) categoriesSet.add(e.categoryId);
    });
    const categoriesUsed = categoriesSet.size;
    
    // Count events with photos/videos
    const eventsWithPhotos = allEvents.filter(e => e.photoKeys && e.photoKeys.length > 0).length;
    const eventsWithVideos = allEvents.filter(e => e.youtubeVideoIds && e.youtubeVideoIds.length > 0).length;
    
    return {
      totalEvents,
      totalAttendees,
      yearsActive,
      categoriesUsed,
      eventsWithPhotos,
      eventsWithVideos,
    };
  }

  async getArchiveTimeline(): Promise<Array<{ year: number; month: number; count: number }>> {
    const allEvents = await db.select().from(archivedEvents);
    
    const timeline = new Map<string, number>();
    allEvents.forEach(e => {
      const date = new Date(e.startDate);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      timeline.set(key, (timeline.get(key) || 0) + 1);
    });
    
    return Array.from(timeline.entries())
      .map(([key, count]) => {
        const [year, month] = key.split('-').map(Number);
        return { year, month, count };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
  }

  async getArchiveYears(): Promise<number[]> {
    const allEvents = await db.select().from(archivedEvents);
    const yearsSet = new Set<number>();
    allEvents.forEach(e => {
      const year = new Date(e.startDate).getFullYear();
      yearsSet.add(year);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }

  async archiveEvent(eventId: string, archivedByUserId: number, archiveData?: Partial<InsertArchivedEvent>): Promise<ArchivedEvent> {
    // Get the original event
    const event = await this.getEvent(eventId);
    if (!event) {
      throw new Error('Event not found');
    }
    
    // Check if already archived
    const existing = await this.getArchivedEventByOriginalId(eventId);
    if (existing) {
      throw new Error('Event is already archived');
    }

    // Get speakers from the original event
    const eventSpeakersList = await this.getEventSpeakers(eventId);
    
    // PRIVACY: Get attendee count only (not individual attendee data)
    // This prevents leaking contact information to public archives
    const attendees = await this.getEventAttendees(eventId);
    const attendeeCount = attendees.length;
    
    // Create archived event from original event data
    const archivedEvent = await this.createArchivedEvent({
      name: event.name,
      nameAr: event.nameAr,
      description: event.description,
      descriptionAr: event.descriptionAr,
      startDate: event.startDate,
      endDate: event.endDate,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      locationAr: event.locationAr,
      organizers: event.organizers,
      organizersAr: event.organizersAr,
      url: event.url,
      category: event.category,
      categoryAr: event.categoryAr,
      categoryId: event.categoryId,
      eventType: event.eventType,
      eventScope: event.eventScope,
      originalEventId: eventId,
      archivedByUserId,
      createdDirectly: false,
      // PRIVACY: Only store count, not individual attendee details
      actualAttendees: archiveData?.actualAttendees ?? (attendeeCount > 0 ? attendeeCount : event.expectedAttendance),
      highlights: archiveData?.highlights,
      highlightsAr: archiveData?.highlightsAr,
      impact: archiveData?.impact,
      impactAr: archiveData?.impactAr,
      keyTakeaways: archiveData?.keyTakeaways,
      keyTakeawaysAr: archiveData?.keyTakeawaysAr,
      photoKeys: archiveData?.photoKeys,
      thumbnailKeys: archiveData?.thumbnailKeys,
      youtubeVideoIds: archiveData?.youtubeVideoIds,
    });

    // Copy speakers to archived event with snapshot data
    for (const speaker of eventSpeakersList) {
      const contact = speaker.contact;
      await this.addArchivedEventSpeaker({
        archivedEventId: archivedEvent.id,
        contactId: contact.id,
        role: speaker.role ?? undefined,
        roleAr: speaker.roleAr ?? undefined,
        displayOrder: speaker.displayOrder ?? 0,
        // Snapshot data in case contact is deleted later
        speakerNameEn: contact.nameEn ?? undefined,
        speakerNameAr: contact.nameAr ?? undefined,
        speakerTitle: contact.title ?? undefined,
        speakerTitleAr: contact.titleAr ?? undefined,
        speakerPosition: contact.position?.nameEn ?? undefined,
        speakerPositionAr: contact.position?.nameAr ?? undefined,
        speakerOrganization: contact.organization?.nameEn ?? undefined,
        speakerOrganizationAr: contact.organization?.nameAr ?? undefined,
        speakerProfilePictureKey: contact.profilePictureKey ?? undefined,
        speakerProfilePictureThumbnailKey: contact.profilePictureThumbnailKey ?? undefined,
      });
    }
    
    // Copy event media to archive media (reusing same MinIO objects - no duplication)
    const eventMediaList = await this.getEventMedia(eventId);
    for (const media of eventMediaList) {
      await this.createArchiveMedia({
        archivedEventId: archivedEvent.id,
        objectKey: media.objectKey,
        thumbnailKey: media.thumbnailKey ?? undefined,
        originalFileName: media.originalFileName,
        mimeType: media.mimeType,
        fileSize: media.fileSize,
        width: media.width ?? undefined,
        height: media.height ?? undefined,
        caption: media.caption ?? undefined,
        captionAr: media.captionAr ?? undefined,
        displayOrder: media.displayOrder,
        uploadedByUserId: media.uploadedByUserId ?? undefined,
        originalEventMediaId: media.id, // Track which event media this came from
      });
    }
    
    // NOTE: Attendee data is NOT copied to archive for privacy reasons
    // Only the count (actualAttendees) is stored above
    // Individual attendee contact information remains in the contacts database
    
    // Mark original event as archived
    await db
      .update(events)
      .set({ isArchived: true, archivedAt: new Date() })
      .where(eq(events.id, eventId));
    
    return archivedEvent;
  }

  async unarchiveEvent(archivedEventId: number): Promise<boolean> {
    const archivedEvent = await this.getArchivedEvent(archivedEventId);
    if (!archivedEvent) {
      return false;
    }
    
    // If there's an original event, remove the archived flag
    if (archivedEvent.originalEventId) {
      await db
        .update(events)
        .set({ isArchived: false, archivedAt: null })
        .where(eq(events.id, archivedEvent.originalEventId));
    }
    
    // Delete the archived event
    return await this.deleteArchivedEvent(archivedEventId);
  }

  // ==================== Archive Media Operations ====================

  async getArchiveMedia(archivedEventId: number): Promise<ArchiveMedia[]> {
    return await db
      .select()
      .from(archiveMedia)
      .where(eq(archiveMedia.archivedEventId, archivedEventId))
      .orderBy(asc(archiveMedia.displayOrder));
  }

  async createArchiveMedia(data: InsertArchiveMedia): Promise<ArchiveMedia> {
    const [media] = await db
      .insert(archiveMedia)
      .values(data)
      .returning();
    return media;
  }

  async updateArchiveMedia(id: number, data: Partial<InsertArchiveMedia>): Promise<ArchiveMedia | undefined> {
    const [media] = await db
      .update(archiveMedia)
      .set(data)
      .where(eq(archiveMedia.id, id))
      .returning();
    return media || undefined;
  }

  async deleteArchiveMedia(id: number): Promise<boolean> {
    const result = await db
      .delete(archiveMedia)
      .where(eq(archiveMedia.id, id))
      .returning();
    return result.length > 0;
  }

  async reorderArchiveMedia(archivedEventId: number, mediaIds: number[]): Promise<void> {
    for (let i = 0; i < mediaIds.length; i++) {
      await db
        .update(archiveMedia)
        .set({ displayOrder: i })
        .where(and(
          eq(archiveMedia.id, mediaIds[i]),
          eq(archiveMedia.archivedEventId, archivedEventId)
        ));
    }
  }

  // ==================== Event Media Operations ====================

  async getEventMedia(eventId: string): Promise<EventMedia[]> {
    return await db
      .select()
      .from(eventMedia)
      .where(eq(eventMedia.eventId, eventId))
      .orderBy(asc(eventMedia.displayOrder));
  }

  async createEventMedia(data: InsertEventMedia): Promise<EventMedia> {
    const [media] = await db
      .insert(eventMedia)
      .values(data)
      .returning();
    return media;
  }

  async updateEventMedia(id: number, data: Partial<InsertEventMedia>): Promise<EventMedia | undefined> {
    const [media] = await db
      .update(eventMedia)
      .set(data)
      .where(eq(eventMedia.id, id))
      .returning();
    return media || undefined;
  }

  async deleteEventMedia(id: number): Promise<boolean> {
    const result = await db
      .delete(eventMedia)
      .where(eq(eventMedia.id, id))
      .returning();
    return result.length > 0;
  }

  async reorderEventMedia(eventId: string, mediaIds: number[]): Promise<void> {
    for (let i = 0; i < mediaIds.length; i++) {
      await db
        .update(eventMedia)
        .set({ displayOrder: i })
        .where(and(
          eq(eventMedia.id, mediaIds[i]),
          eq(eventMedia.eventId, eventId)
        ));
    }
  }

  // ==================== Contacts & Speakers Operations ====================

  // Organization operations
  async getAllOrganizations(): Promise<Array<Organization & { country?: Country }>> {
    const results = await db
      .select({
        organization: organizations,
        country: countries,
      })
      .from(organizations)
      .leftJoin(countries, eq(organizations.countryId, countries.id))
      .orderBy(organizations.nameEn);
    
    return results.map(({ organization, country }) => ({
      ...organization,
      country: country || undefined,
    }));
  }

  async getOrganization(id: number): Promise<(Organization & { country?: Country }) | undefined> {
    const results = await db
      .select({
        organization: organizations,
        country: countries,
      })
      .from(organizations)
      .leftJoin(countries, eq(organizations.countryId, countries.id))
      .where(eq(organizations.id, id));
    
    if (results.length === 0) {
      return undefined;
    }
    
    const { organization, country } = results[0];
    return {
      ...organization,
      country: country || undefined,
    };
  }

  async createOrganization(data: InsertOrganization): Promise<Organization> {
    const [organization] = await db.insert(organizations).values(data).returning();
    return organization;
  }

  async updateOrganization(id: number, data: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const [organization] = await db
      .update(organizations)
      .set(data)
      .where(eq(organizations.id, id))
      .returning();
    return organization || undefined;
  }

  async deleteOrganization(id: number): Promise<boolean> {
    const result = await db
      .delete(organizations)
      .where(eq(organizations.id, id))
      .returning();
    return result.length > 0;
  }

  // Position operations
  async getAllPositions(): Promise<Position[]> {
    return await db.select().from(positions).orderBy(positions.nameEn);
  }

  async getPosition(id: number): Promise<Position | undefined> {
    const [position] = await db.select().from(positions).where(eq(positions.id, id));
    return position || undefined;
  }

  async createPosition(data: InsertPosition): Promise<Position> {
    const [position] = await db.insert(positions).values(data).returning();
    return position;
  }

  async updatePosition(id: number, data: Partial<InsertPosition>): Promise<Position | undefined> {
    const [position] = await db
      .update(positions)
      .set(data)
      .where(eq(positions.id, id))
      .returning();
    return position || undefined;
  }

  async deletePosition(id: number): Promise<boolean> {
    const result = await db
      .delete(positions)
      .where(eq(positions.id, id))
      .returning();
    return result.length > 0;
  }

  // Partnership Type operations
  async getAllPartnershipTypes(): Promise<PartnershipType[]> {
    return await db.select().from(partnershipTypes).orderBy(partnershipTypes.nameEn);
  }

  async getPartnershipType(id: number): Promise<PartnershipType | undefined> {
    const [partnershipType] = await db.select().from(partnershipTypes).where(eq(partnershipTypes.id, id));
    return partnershipType || undefined;
  }

  async createPartnershipType(data: InsertPartnershipType): Promise<PartnershipType> {
    const [partnershipType] = await db.insert(partnershipTypes).values(data).returning();
    return partnershipType;
  }

  async updatePartnershipType(id: number, data: Partial<InsertPartnershipType>): Promise<PartnershipType | undefined> {
    const [partnershipType] = await db
      .update(partnershipTypes)
      .set(data)
      .where(eq(partnershipTypes.id, id))
      .returning();
    return partnershipType || undefined;
  }

  async deletePartnershipType(id: number): Promise<boolean> {
    const result = await db
      .delete(partnershipTypes)
      .where(eq(partnershipTypes.id, id))
      .returning();
    return result.length > 0;
  }

  // Agreement Type operations
  async getAllAgreementTypes(): Promise<AgreementType[]> {
    return await db.select().from(agreementTypes).orderBy(agreementTypes.nameEn);
  }

  async getAgreementType(id: number): Promise<AgreementType | undefined> {
    const [agreementType] = await db.select().from(agreementTypes).where(eq(agreementTypes.id, id));
    return agreementType || undefined;
  }

  async createAgreementType(data: InsertAgreementType): Promise<AgreementType> {
    const [agreementType] = await db.insert(agreementTypes).values(data).returning();
    return agreementType;
  }

  async updateAgreementType(id: number, data: Partial<InsertAgreementType>): Promise<AgreementType | undefined> {
    const [agreementType] = await db
      .update(agreementTypes)
      .set(data)
      .where(eq(agreementTypes.id, id))
      .returning();
    return agreementType || undefined;
  }

  async deleteAgreementType(id: number): Promise<boolean> {
    const result = await db
      .delete(agreementTypes)
      .where(eq(agreementTypes.id, id))
      .returning();
    return result.length > 0;
  }

  // Country operations (read-only)
  async getAllCountries(): Promise<Country[]> {
    return await db.select().from(countries).orderBy(countries.nameEn);
  }

  async getCountry(id: number): Promise<Country | undefined> {
    const [country] = await db.select().from(countries).where(eq(countries.id, id));
    return country || undefined;
  }

  // Contact operations
  async getAllContacts(options?: {
    page?: number;
    limit?: number;
    search?: string;
    organizationId?: number;
    positionId?: number;
    countryId?: number;
    isEligibleSpeaker?: boolean;
  }): Promise<{ contacts: Array<Contact & { organization?: Organization; position?: Position; country?: Country }>; total: number; page: number; limit: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];
    
    if (options?.search) {
      const searchPattern = `%${options.search}%`;
      conditions.push(
        or(
          like(contacts.nameEn, searchPattern),
          like(contacts.nameAr, searchPattern),
          like(contacts.email, searchPattern)
        )
      );
    }
    
    if (options?.organizationId) {
      conditions.push(eq(contacts.organizationId, options.organizationId));
    }
    
    if (options?.positionId) {
      conditions.push(eq(contacts.positionId, options.positionId));
    }
    
    if (options?.countryId) {
      conditions.push(eq(contacts.countryId, options.countryId));
    }
    
    if (options?.isEligibleSpeaker !== undefined) {
      conditions.push(eq(contacts.isEligibleSpeaker, options.isEligibleSpeaker));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ totalCount }] = await db
      .select({ totalCount: count() })
      .from(contacts)
      .where(whereClause);

    // Get paginated results with joins
    const results = await db
      .select({
        contact: contacts,
        organization: organizations,
        position: positions,
        country: countries,
      })
      .from(contacts)
      .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
      .leftJoin(positions, eq(contacts.positionId, positions.id))
      .leftJoin(countries, eq(contacts.countryId, countries.id))
      .where(whereClause)
      .orderBy(desc(contacts.createdAt))
      .offset(limit)
      .offset(offset);

    const contactsList = results.map(({ contact, organization, position, country }) => ({
      ...contact,
      organization: organization || undefined,
      position: position || undefined,
      country: country || undefined,
    }));

    return {
      contacts: contactsList,
      total: Number(totalCount),
      page,
      limit,
    };
  }

  async getGroupedContacts(options: {
    groupBy: 'organization' | 'position' | 'country';
    groupId?: number;
    page?: number;
    limit?: number;
    search?: string;
    isEligibleSpeaker?: boolean;
  }): Promise<{
    groups: Array<{
      id: number;
      nameEn: string;
      nameAr: string | null;
      totalContacts: number;
      contacts: Array<Contact & { organization?: Organization; position?: Position; country?: Country }>;
    }>;
    totalGroups: number;
  }> {
    const contactsPerGroup = options.limit || 5;
    const groupPage = options.page || 1;
    
    // Build base contact conditions
    const contactConditions: any[] = [];
    
    if (options.search) {
      const searchPattern = `%${options.search}%`;
      contactConditions.push(
        or(
          like(contacts.nameEn, searchPattern),
          like(contacts.nameAr, searchPattern),
          like(contacts.email, searchPattern)
        )
      );
    }
    
    if (options.isEligibleSpeaker !== undefined) {
      contactConditions.push(eq(contacts.isEligibleSpeaker, options.isEligibleSpeaker));
    }

    // Determine which table to group by
    let groupTable: typeof organizations | typeof positions | typeof countries;
    let groupForeignKey: typeof contacts.organizationId | typeof contacts.positionId | typeof contacts.countryId;
    
    switch (options.groupBy) {
      case 'organization':
        groupTable = organizations;
        groupForeignKey = contacts.organizationId;
        break;
      case 'position':
        groupTable = positions;
        groupForeignKey = contacts.positionId;
        break;
      case 'country':
        groupTable = countries;
        groupForeignKey = contacts.countryId;
        break;
    }

    // If a specific group is requested, just get that group's paginated contacts
    if (options.groupId) {
      const groupConditions = [...contactConditions, eq(groupForeignKey, options.groupId)];
      const whereClause = groupConditions.length > 0 ? and(...groupConditions) : undefined;
      
      // Get the group info
      const [groupInfo] = await db
        .select()
        .from(groupTable)
        .where(eq(groupTable.id, options.groupId))
        .offset(1);
      
      if (!groupInfo) {
        return { groups: [], totalGroups: 0 };
      }
      
      // Get total count for this group
      const [{ totalCount }] = await db
        .select({ totalCount: count() })
        .from(contacts)
        .where(whereClause);
      
      // Get paginated contacts for this group
      const offset = (groupPage - 1) * contactsPerGroup;
      const contactResults = await db
        .select({
          contact: contacts,
          organization: organizations,
          position: positions,
          country: countries,
        })
        .from(contacts)
        .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
        .leftJoin(positions, eq(contacts.positionId, positions.id))
        .leftJoin(countries, eq(contacts.countryId, countries.id))
        .where(whereClause)
        .orderBy(contacts.nameEn)
        .offset(contactsPerGroup)
        .offset(offset);
      
      const contactsList = contactResults.map(({ contact, organization, position, country }) => ({
        ...contact,
        organization: organization || undefined,
        position: position || undefined,
        country: country || undefined,
      }));
      
      return {
        groups: [{
          id: groupInfo.id,
          nameEn: groupInfo.nameEn,
          nameAr: groupInfo.nameAr,
          totalContacts: Number(totalCount),
          contacts: contactsList,
        }],
        totalGroups: 1,
      };
    }

    // Get all groups with their contact counts (only groups that have contacts matching filters)
    const baseWhereClause = contactConditions.length > 0 ? and(...contactConditions) : undefined;
    
    // Get groups with contact counts
    const groupsWithCounts = await db
      .select({
        groupId: groupForeignKey,
        contactCount: count(),
      })
      .from(contacts)
      .where(baseWhereClause)
      .groupBy(groupForeignKey)
      .orderBy(desc(count()));

    // Filter out null group IDs and get group details
    const validGroupIds = groupsWithCounts
      .filter(g => g.groupId !== null)
      .map(g => ({ id: g.groupId!, count: Number(g.contactCount) }));
    
    if (validGroupIds.length === 0) {
      return { groups: [], totalGroups: 0 };
    }

    // Get group details
    const groupDetails = await db
      .select()
      .from(groupTable)
      .where(inArray(groupTable.id, validGroupIds.map(g => g.id)));

    // Create a map of group details
    const groupDetailsMap = new Map(groupDetails.map(g => [g.id, g]));

    // Build result with top N contacts per group
    const result: Array<{
      id: number;
      nameEn: string;
      nameAr: string | null;
      totalContacts: number;
      contacts: Array<Contact & { organization?: Organization; position?: Position; country?: Country }>;
    }> = [];

    for (const { id: groupId, count: totalContacts } of validGroupIds) {
      const groupDetail = groupDetailsMap.get(groupId);
      if (!groupDetail) continue;

      // Get top N contacts for this group
      const groupContactConditions = [...contactConditions, eq(groupForeignKey, groupId)];
      const groupWhereClause = and(...groupContactConditions);

      const contactResults = await db
        .select({
          contact: contacts,
          organization: organizations,
          position: positions,
          country: countries,
        })
        .from(contacts)
        .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
        .leftJoin(positions, eq(contacts.positionId, positions.id))
        .leftJoin(countries, eq(contacts.countryId, countries.id))
        .where(groupWhereClause)
        .orderBy(contacts.nameEn)
        .offset(contactsPerGroup);

      const contactsList = contactResults.map(({ contact, organization, position, country }) => ({
        ...contact,
        organization: organization || undefined,
        position: position || undefined,
        country: country || undefined,
      }));

      result.push({
        id: groupDetail.id,
        nameEn: groupDetail.nameEn,
        nameAr: groupDetail.nameAr,
        totalContacts,
        contacts: contactsList,
      });
    }

    return {
      groups: result,
      totalGroups: validGroupIds.length,
    };
  }

  async getContact(id: number): Promise<(Contact & { organization?: Organization; position?: Position; country?: Country }) | undefined> {
    const results = await db
      .select({
        contact: contacts,
        organization: organizations,
        position: positions,
        country: countries,
      })
      .from(contacts)
      .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
      .leftJoin(positions, eq(contacts.positionId, positions.id))
      .leftJoin(countries, eq(contacts.countryId, countries.id))
      .where(eq(contacts.id, id))
      .offset(1);

    if (results.length === 0) return undefined;

    const { contact, organization, position, country } = results[0];
    return {
      ...contact,
      organization: organization || undefined,
      position: position || undefined,
      country: country || undefined,
    };
  }

  async getEligibleSpeakers(): Promise<Array<Contact & { organization?: Organization; position?: Position; country?: Country }>> {
    const results = await db
      .select({
        contact: contacts,
        organization: organizations,
        position: positions,
        country: countries,
      })
      .from(contacts)
      .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
      .leftJoin(positions, eq(contacts.positionId, positions.id))
      .leftJoin(countries, eq(contacts.countryId, countries.id))
      .where(eq(contacts.isEligibleSpeaker, true))
      .orderBy(contacts.nameEn);

    return results.map(({ contact, organization, position, country }) => ({
      ...contact,
      organization: organization || undefined,
      position: position || undefined,
      country: country || undefined,
    }));
  }

  async createContact(data: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(data).returning();
    return contact;
  }

  async updateContact(id: number, data: UpdateContact): Promise<Contact | undefined> {
    const [contact] = await db
      .update(contacts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();
    return contact || undefined;
  }

  async deleteContact(id: number): Promise<boolean> {
    const result = await db
      .delete(contacts)
      .where(eq(contacts.id, id))
      .returning();
    return result.length > 0;
  }

  // Helper functions for CSV import
  async getContactByEmail(email: string): Promise<Contact | undefined> {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.email, email))
      .offset(1);
    return contact || undefined;
  }

  async getContactByName(nameEn: string, organizationId?: number | null): Promise<Contact | undefined> {
    const conditions = [eq(contacts.nameEn, nameEn)];
    if (organizationId) {
      conditions.push(eq(contacts.organizationId, organizationId));
    }
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(...conditions))
      .offset(1);
    return contact || undefined;
  }

  async getOrganizationByName(nameEn: string): Promise<Organization | undefined> {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.nameEn, nameEn))
      .offset(1);
    return org || undefined;
  }

  async getPositionByName(nameEn: string): Promise<Position | undefined> {
    const [pos] = await db
      .select()
      .from(positions)
      .where(eq(positions.nameEn, nameEn))
      .offset(1);
    return pos || undefined;
  }

  async getCountryByCode(code: string): Promise<Country | undefined> {
    const [country] = await db
      .select()
      .from(countries)
      .where(eq(countries.code, code.toUpperCase()))
      .offset(1);
    return country || undefined;
  }

  // Event Speaker operations
  async getEventSpeakers(eventId: string): Promise<Array<EventSpeaker & { contact: Contact & { organization?: Organization; position?: Position; country?: Country } }>> {
    const results = await db
      .select({
        eventSpeaker: eventSpeakers,
        contact: contacts,
        organization: organizations,
        position: positions,
        country: countries,
      })
      .from(eventSpeakers)
      .innerJoin(contacts, eq(eventSpeakers.contactId, contacts.id))
      .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
      .leftJoin(positions, eq(contacts.positionId, positions.id))
      .leftJoin(countries, eq(contacts.countryId, countries.id))
      .where(eq(eventSpeakers.eventId, eventId))
      .orderBy(asc(eventSpeakers.displayOrder));

    return results.map(({ eventSpeaker, contact, organization, position, country }) => ({
      ...eventSpeaker,
      contact: {
        ...contact,
        organization: organization || undefined,
        position: position || undefined,
        country: country || undefined,
      },
    }));
  }

  async addEventSpeaker(data: InsertEventSpeaker): Promise<EventSpeaker> {
    const [speaker] = await db.insert(eventSpeakers).values(data).returning();
    return speaker;
  }

  async updateEventSpeaker(id: number, data: UpdateEventSpeaker): Promise<EventSpeaker | undefined> {
    const [speaker] = await db
      .update(eventSpeakers)
      .set(data)
      .where(eq(eventSpeakers.id, id))
      .returning();
    return speaker || undefined;
  }

  async removeEventSpeaker(id: number): Promise<boolean> {
    const result = await db
      .delete(eventSpeakers)
      .where(eq(eventSpeakers.id, id))
      .returning();
    return result.length > 0;
  }

  async deleteEventSpeakers(eventId: string): Promise<boolean> {
    await db
      .delete(eventSpeakers)
      .where(eq(eventSpeakers.eventId, eventId));
    return true;
  }

  async getContactEvents(leadId: number): Promise<{ events: Event[]; archivedEvents: ArchivedEvent[] }> {
    // Get active events where the contact is a speaker
    const activeEventResults = await db
      .select({ event: events })
      .from(eventSpeakers)
      .innerJoin(events, eq(eventSpeakers.eventId, events.id))
      .where(eq(eventSpeakers.contactId, leadId))
      .orderBy(desc(events.startDate));

    // Get archived events where the contact is a speaker
    const archivedEventResults = await db
      .select({ archivedEvent: archivedEvents })
      .from(archivedEventSpeakers)
      .innerJoin(archivedEvents, eq(archivedEventSpeakers.archivedEventId, archivedEvents.id))
      .where(eq(archivedEventSpeakers.contactId, leadId))
      .orderBy(desc(archivedEvents.startDate));

    return {
      events: activeEventResults.map(r => r.event),
      archivedEvents: archivedEventResults.map(r => r.archivedEvent),
    };
  }

  // Contact statistics operations
  async getContactsStatistics(limit: number): Promise<{
    totalContacts: number;
    contactsWithEvents: number;
    contactsWithoutEvents: number;
    totalEventAttendances: number;
    averageAttendancePerContact: number;
    totalInvitations: number;
    totalRSVPs: number;
    totalRegistrations: number;
    overallConversionRate: number;
    overallRegistrationRate: number;
    topAttendees: Array<{
      leadId: number;
      nameEn: string;
      nameAr: string;
      organization: string | null;
      eventsAttended: number;
      speakerAppearances: number;
      invitationsReceived: number;
      rsvpConfirmed: number;
      registrations: number;
    }>;
  }> {
    // Get total contacts
    const totalContactsResult = await db.select({ count: sql<number>`count(*)::int` }).from(contacts);
    const totalContacts = totalContactsResult[0]?.count || 0;

    // Get contacts with events (either as attendee, speaker, or invitee)
    const contactsWithEventsResult = await db
      .select({ count: sql<number>`count(distinct ${contacts.id})::int` })
      .from(contacts)
      .leftJoin(eventAttendees, eq(contacts.id, eventAttendees.contactId))
      .leftJoin(eventSpeakers, eq(contacts.id, eventSpeakers.contactId))
      .leftJoin(eventInvitees, eq(contacts.id, eventInvitees.contactId))
      .where(or(
        isNotNull(eventAttendees.id), 
        isNotNull(eventSpeakers.id),
        isNotNull(eventInvitees.id)
      ));
    
    const contactsWithEvents = contactsWithEventsResult[0]?.count || 0;
    const contactsWithoutEvents = totalContacts - contactsWithEvents;

    // Get total event attendances
    const totalAttendancesResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(eventAttendees);
    const totalEventAttendances = totalAttendancesResult[0]?.count || 0;

    // Get total invitations, RSVPs, and registrations
    const invitationStatsResult = await db
      .select({ 
        totalInvitations: sql<number>`count(*)::int`,
        totalRSVPs: sql<number>`count(*) filter (where ${eventInvitees.rsvp} = true)::int`,
        totalRegistrations: sql<number>`count(*) filter (where ${eventInvitees.registered} = true)::int`
      })
      .from(eventInvitees);
    
    const totalInvitations = invitationStatsResult[0]?.totalInvitations || 0;
    const totalRSVPs = invitationStatsResult[0]?.totalRSVPs || 0;
    const totalRegistrations = invitationStatsResult[0]?.totalRegistrations || 0;
    const overallConversionRate = totalInvitations > 0 
      ? (totalRSVPs / totalInvitations) * 100 
      : 0;
    const overallRegistrationRate = totalInvitations > 0 
      ? (totalRegistrations / totalInvitations) * 100 
      : 0;

    // Calculate average attendance per contact (only for contacts with events)
    const averageAttendancePerContact = contactsWithEvents > 0 
      ? totalEventAttendances / contactsWithEvents 
      : 0;

    // Get top attendees with their statistics including invitations and registrations
    const topAttendeesQuery = await db
      .select({
        leadId: contacts.id,
        nameEn: contacts.nameEn,
        nameAr: contacts.nameAr,
        organizationNameEn: organizations.nameEn,
        eventsAttended: sql<number>`count(distinct ${eventAttendees.id})::int`,
        speakerAppearances: sql<number>`count(distinct ${eventSpeakers.id})::int`,
        invitationsReceived: sql<number>`count(distinct ${eventInvitees.id})::int`,
        rsvpConfirmed: sql<number>`count(distinct ${eventInvitees.id}) filter (where ${eventInvitees.rsvp} = true)::int`,
        registrations: sql<number>`count(distinct ${eventInvitees.id}) filter (where ${eventInvitees.registered} = true)::int`,
      })
      .from(contacts)
      .leftJoin(eventAttendees, eq(contacts.id, eventAttendees.contactId))
      .leftJoin(eventSpeakers, eq(contacts.id, eventSpeakers.contactId))
      .leftJoin(eventInvitees, eq(contacts.id, eventInvitees.contactId))
      .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
      .groupBy(contacts.id, organizations.nameEn)
      .having(sql`count(distinct ${eventAttendees.id}) > 0`)
      .orderBy(desc(sql`count(distinct ${eventAttendees.id})`))
      .offset(limit);

    const topAttendees = topAttendeesQuery.map(row => ({
      leadId: row.leadId,
      nameEn: row.nameEn,
      nameAr: row.nameAr || '',
      organization: row.organizationNameEn || null,
      eventsAttended: row.eventsAttended,
      speakerAppearances: row.speakerAppearances,
      invitationsReceived: row.invitationsReceived,
      rsvpConfirmed: row.rsvpConfirmed,
      registrations: row.registrations,
    }));

    return {
      totalContacts,
      contactsWithEvents,
      contactsWithoutEvents,
      totalEventAttendances,
      averageAttendancePerContact,
      totalInvitations,
      totalRSVPs,
      totalRegistrations,
      overallConversionRate,
      overallRegistrationRate,
      topAttendees,
    };
  }

  async getOrganizationStatistics(options: {
    limit: number;
    sortBy: string;
    sortOrder: string;
  }): Promise<{
    totalOrganizations: number;
    organizationsWithAttendance: number;
    organizationStatistics: Array<{
      organizationId: number;
      organizationNameEn: string;
      organizationNameAr: string | null;
      totalContacts: number;
      activeContacts: number;
      totalEventAttendances: number;
      uniqueEventsAttended: number;
      averageAttendancePerContact: number;
      attendanceRate: number;
      speakerAppearances: number;
      topAttendee: {
        leadId: number;
        nameEn: string;
        eventsAttended: number;
      } | null;
    }>;
    overallAverageAttendanceRate: number;
  }> {
    const { limit, sortBy, sortOrder } = options;

    // Get total organizations
    const totalOrgsResult = await db.select({ count: sql<number>`count(*)::int` }).from(organizations);
    const totalOrganizations = totalOrgsResult[0]?.count || 0;

    // Get organization statistics
    const orgStatsQuery = await db
      .select({
        organizationId: organizations.id,
        organizationNameEn: organizations.nameEn,
        organizationNameAr: organizations.nameAr,
        totalContacts: sql<number>`count(distinct ${contacts.id})::int`,
        activeContacts: sql<number>`count(distinct case when ${eventAttendees.id} is not null then ${contacts.id} end)::int`,
        totalEventAttendances: sql<number>`count(distinct ${eventAttendees.id})::int`,
        uniqueEventsAttended: sql<number>`count(distinct ${eventAttendees.eventId})::int`,
        speakerAppearances: sql<number>`count(distinct ${eventSpeakers.id})::int`,
      })
      .from(organizations)
      .leftJoin(contacts, eq(organizations.id, contacts.organizationId))
      .leftJoin(eventAttendees, eq(contacts.id, eventAttendees.contactId))
      .leftJoin(eventSpeakers, eq(contacts.id, eventSpeakers.contactId))
      .groupBy(organizations.id);

    // Process and enrich statistics
    const organizationStatistics = await Promise.all(
      orgStatsQuery.map(async (org) => {
        const attendanceRate = org.totalContacts > 0 
          ? (org.activeContacts / org.totalContacts) * 100 
          : 0;
        
        const averageAttendancePerContact = org.activeContacts > 0
          ? org.totalEventAttendances / org.activeContacts
          : 0;

        // Get top attendee for this organization
        let topAttendee = null;
        if (org.activeContacts > 0) {
          const topAttendeeQuery = await db
            .select({
              leadId: contacts.id,
              nameEn: contacts.nameEn,
              nameAr: contacts.nameAr,
              eventsAttended: sql<number>`count(distinct ${eventAttendees.id})::int`,
            })
            .from(contacts)
            .innerJoin(eventAttendees, eq(contacts.id, eventAttendees.contactId))
            .where(eq(contacts.organizationId, org.organizationId))
            .groupBy(contacts.id)
            .orderBy(desc(sql`count(distinct ${eventAttendees.id})`))
            .offset(1);

          if (topAttendeeQuery.length > 0) {
            topAttendee = {
              leadId: topAttendeeQuery[0].leadId,
              nameEn: topAttendeeQuery[0].nameEn,
              nameAr: topAttendeeQuery[0].nameAr,
              eventsAttended: topAttendeeQuery[0].eventsAttended,
            };
          }
        }

        return {
          organizationId: org.organizationId,
          organizationNameEn: org.organizationNameEn,
          organizationNameAr: org.organizationNameAr,
          totalContacts: org.totalContacts,
          activeContacts: org.activeContacts,
          totalEventAttendances: org.totalEventAttendances,
          uniqueEventsAttended: org.uniqueEventsAttended,
          averageAttendancePerContact,
          attendanceRate,
          speakerAppearances: org.speakerAppearances,
          topAttendee,
        };
      })
    );

    // Filter organizations with attendance and sort
    const orgsWithAttendance = organizationStatistics.filter(org => org.activeContacts > 0);
    const organizationsWithAttendance = orgsWithAttendance.length;

    // Sort based on provided options
    const sortedStats = [...orgsWithAttendance].sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortBy) {
        case 'attendanceRate':
          aVal = a.attendanceRate;
          bVal = b.attendanceRate;
          break;
        case 'uniqueContacts':
        case 'activeContacts':
          aVal = a.activeContacts;
          bVal = b.activeContacts;
          break;
        case 'averagePerContact':
          aVal = a.averageAttendancePerContact;
          bVal = b.averageAttendancePerContact;
          break;
        case 'totalAttendances':
        default:
          aVal = a.totalEventAttendances;
          bVal = b.totalEventAttendances;
          break;
      }
      
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    }).slice(0, limit);

    // Calculate overall average attendance rate
    const totalActiveOrgs = orgsWithAttendance.length;
    const overallAverageAttendanceRate = totalActiveOrgs > 0
      ? orgsWithAttendance.reduce((sum, org) => sum + org.attendanceRate, 0) / totalActiveOrgs
      : 0;

    return {
      totalOrganizations,
      organizationsWithAttendance,
      organizationStatistics: sortedStats,
      overallAverageAttendanceRate,
    };
  }

  // Comprehensive Engagement Analytics
  async getEngagementAnalytics(): Promise<any> {
    // 1. Engagement by Category
    const engagementByCategory = await db
      .select({
        categoryId: categories.id,
        categoryNameEn: categories.nameEn,
        categoryNameAr: categories.nameAr,
        totalEvents: sql<number>`count(distinct ${events.id})::int`,
        totalInvitees: sql<number>`count(distinct ${eventInvitees.id})::int`,
        totalRegistrations: sql<number>`count(distinct ${eventInvitees.id}) filter (where ${eventInvitees.registered} = true)::int`,
        totalRSVPs: sql<number>`count(distinct ${eventInvitees.id}) filter (where ${eventInvitees.rsvp} = true)::int`,
        totalAttendees: sql<number>`count(distinct ${eventAttendees.id})::int`,
        totalSpeakers: sql<number>`count(distinct ${eventSpeakers.id})::int`,
      })
      .from(categories)
      .leftJoin(events, eq(categories.id, events.categoryId))
      .leftJoin(eventInvitees, eq(events.id, eventInvitees.eventId))
      .leftJoin(eventAttendees, eq(events.id, eventAttendees.eventId))
      .leftJoin(eventSpeakers, eq(events.id, eventSpeakers.eventId))
      .groupBy(categories.id, categories.nameEn, categories.nameAr)
      .having(sql`count(distinct ${events.id}) > 0`)
      .orderBy(desc(sql`count(distinct ${eventAttendees.id})`));

    const categoryMetrics = engagementByCategory.map(cat => ({
      ...cat,
      registrationRate: cat.totalInvitees > 0 ? (cat.totalRegistrations / cat.totalInvitees) * 100 : 0,
      rsvpRate: cat.totalInvitees > 0 ? (cat.totalRSVPs / cat.totalInvitees) * 100 : 0,
      attendanceRate: cat.totalInvitees > 0 ? (cat.totalAttendees / cat.totalInvitees) * 100 : 0,
      conversionRate: cat.totalRegistrations > 0 ? (cat.totalAttendees / cat.totalRegistrations) * 100 : 0,
    }));

    // 2. Engagement by Month (Seasonal Trends)
    const engagementByMonth = await db
      .select({
        month: sql<number>`extract(month from ${events.startDate})::int`,
        year: sql<number>`extract(year from ${events.startDate})::int`,
        totalEvents: sql<number>`count(distinct ${events.id})::int`,
        totalInvitees: sql<number>`count(distinct ${eventInvitees.id})::int`,
        totalRegistrations: sql<number>`count(distinct ${eventInvitees.id}) filter (where ${eventInvitees.registered} = true)::int`,
        totalRSVPs: sql<number>`count(distinct ${eventInvitees.id}) filter (where ${eventInvitees.rsvp} = true)::int`,
        totalAttendees: sql<number>`count(distinct ${eventAttendees.id})::int`,
      })
      .from(events)
      .leftJoin(eventInvitees, eq(events.id, eventInvitees.eventId))
      .leftJoin(eventAttendees, eq(events.id, eventAttendees.eventId))
      .where(sql`${events.startDate} >= current_date - interval '12 months'`)
      .groupBy(sql`extract(month from ${events.startDate})`, sql`extract(year from ${events.startDate})`)
      .orderBy(sql`extract(year from ${events.startDate})`, sql`extract(month from ${events.startDate})`);

    // 3. Conversion Funnel (Overall)
    const conversionFunnel = await db
      .select({
        totalInvited: sql<number>`count(distinct ${eventInvitees.id})::int`,
        totalEmailsSent: sql<number>`count(distinct ${eventInvitees.id}) filter (where ${eventInvitees.inviteEmailSent} = true)::int`,
        totalRegistered: sql<number>`count(distinct ${eventInvitees.id}) filter (where ${eventInvitees.registered} = true)::int`,
        totalRSVPed: sql<number>`count(distinct ${eventInvitees.id}) filter (where ${eventInvitees.rsvp} = true)::int`,
      })
      .from(eventInvitees);

    const totalAttendedResult = await db
      .select({
        totalAttended: sql<number>`count(distinct ${eventAttendees.id})::int`,
      })
      .from(eventAttendees);

    const funnel = {
      invited: conversionFunnel[0]?.totalInvited ?? 0,
      emailsSent: conversionFunnel[0]?.totalEmailsSent ?? 0,
      registered: conversionFunnel[0]?.totalRegistered ?? 0,
      rsvped: conversionFunnel[0]?.totalRSVPed ?? 0,
      attended: totalAttendedResult[0]?.totalAttended ?? 0,
      emailSentRate: 0,
      registrationRate: 0,
      rsvpRate: 0,
      attendanceRate: 0,
      overallConversion: 0,
    };

    const invited = funnel.invited ?? 0;
    const emailsSent = funnel.emailsSent ?? 0;
    const registered = funnel.registered ?? 0;
    funnel.emailSentRate = (invited ?? 0) > 0 ? ((emailsSent ?? 0) / (invited ?? 0)) * 100 : 0;
    funnel.registrationRate = (invited ?? 0) > 0 ? ((registered ?? 0) / (invited ?? 0)) * 100 : 0;
    funnel.rsvpRate = (invited ?? 0) > 0 ? ((funnel.rsvped ?? 0) / (invited ?? 0)) * 100 : 0;
    funnel.attendanceRate = (registered ?? 0) > 0 ? ((funnel.attended ?? 0) / (registered ?? 0)) * 100 : 0;
    funnel.overallConversion = (invited ?? 0) > 0 ? ((funnel.attended ?? 0) / (invited ?? 0)) * 100 : 0;

    // 4. Top Performing Events
    const topEvents = await db
      .select({
        eventId: events.id,
        eventName: events.name,
        eventNameAr: events.nameAr,
        eventDate: events.startDate,
        categoryName: categories.nameEn,
        categoryNameAr: categories.nameAr,
        totalInvitees: sql<number>`count(distinct ${eventInvitees.id})::int`,
        totalAttendees: sql<number>`count(distinct ${eventAttendees.id})::int`,
      })
      .from(events)
      .leftJoin(categories, eq(events.categoryId, categories.id))
      .leftJoin(eventInvitees, eq(events.id, eventInvitees.eventId))
      .leftJoin(eventAttendees, eq(events.id, eventAttendees.eventId))
      .groupBy(events.id, events.name, events.nameAr, events.startDate, categories.nameEn, categories.nameAr)
      .having(sql`count(distinct ${eventAttendees.id}) > 0`)
      .orderBy(desc(sql`count(distinct ${eventAttendees.id})`))
      .offset(10);

    const topPerformingEvents = topEvents.map(evt => ({
      ...evt,
      attendanceRate: evt.totalInvitees > 0 ? (evt.totalAttendees / evt.totalInvitees) * 100 : 0,
    }));

    // 5. Contact Engagement Tiers
    const contactEngagementQuery = await db
      .select({
        leadId: contacts.id,
        eventsAttended: sql<number>`count(distinct ${eventAttendees.id})::int`,
      })
      .from(contacts)
      .leftJoin(eventAttendees, eq(contacts.id, eventAttendees.contactId))
      .groupBy(contacts.id);

    const engagementTiers = {
      highly_engaged: contactEngagementQuery.filter(c => c.eventsAttended >= 5).length,
      moderately_engaged: contactEngagementQuery.filter(c => c.eventsAttended >= 2 && c.eventsAttended < 5).length,
      low_engaged: contactEngagementQuery.filter(c => c.eventsAttended === 1).length,
      not_engaged: contactEngagementQuery.filter(c => c.eventsAttended === 0).length,
    };

    // 6. Geographic Distribution
    const geographicEngagement = await db
      .select({
        countryCode: countries.code,
        countryNameEn: countries.nameEn,
        countryNameAr: countries.nameAr,
        uniqueContacts: sql<number>`count(distinct ${contacts.id})::int`,
        totalInvitations: sql<number>`count(distinct ${eventInvitees.id})::int`,
        totalAttendances: sql<number>`count(distinct ${eventAttendees.id})::int`,
      })
      .from(countries)
      .leftJoin(contacts, eq(countries.id, contacts.countryId))
      .leftJoin(eventInvitees, eq(contacts.id, eventInvitees.contactId))
      .leftJoin(eventAttendees, eq(contacts.id, eventAttendees.contactId))
      .groupBy(countries.code, countries.nameEn, countries.nameAr)
      .having(sql`count(distinct ${contacts.id}) > 0`)
      .orderBy(desc(sql`count(distinct ${eventAttendees.id})`))
      .offset(15);

    // 7. Event Type Performance
    const eventTypeEngagement = await db
      .select({
        eventType: events.eventType,
        eventScope: events.eventScope,
        totalEvents: sql<number>`count(distinct ${events.id})::int`,
        totalInvitees: sql<number>`count(distinct ${eventInvitees.id})::int`,
        totalAttendees: sql<number>`count(distinct ${eventAttendees.id})::int`,
        averageAttendance: sql<number>`avg(${events.expectedAttendance})::int`,
      })
      .from(events)
      .leftJoin(eventInvitees, eq(events.id, eventInvitees.eventId))
      .leftJoin(eventAttendees, eq(events.id, eventAttendees.eventId))
      .groupBy(events.eventType, events.eventScope)
      .orderBy(desc(sql`count(distinct ${eventAttendees.id})`));

    const eventTypeMetrics = eventTypeEngagement.map(evt => ({
      ...evt,
      attendanceRate: evt.totalInvitees > 0 ? (evt.totalAttendees / evt.totalInvitees) * 100 : 0,
    }));

    return {
      engagementByCategory: categoryMetrics,
      engagementByMonth,
      conversionFunnel: funnel,
      topPerformingEvents,
      engagementTiers,
      geographicEngagement,
      eventTypeEngagement: eventTypeMetrics,
    };
  }

  // Event Attendee operations
  async getEventAttendees(eventId: string): Promise<Array<EventAttendee & { contact: Contact & { organization?: Organization; position?: Position; country?: Country } }>> {
    const results = await db
      .select({
        eventAttendee: eventAttendees,
        contact: contacts,
        organization: organizations,
        position: positions,
        country: countries,
      })
      .from(eventAttendees)
      .innerJoin(contacts, eq(eventAttendees.contactId, contacts.id))
      .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
      .leftJoin(positions, eq(contacts.positionId, positions.id))
      .leftJoin(countries, eq(contacts.countryId, countries.id))
      .where(eq(eventAttendees.eventId, eventId))
      .orderBy(desc(eventAttendees.attendedAt));

    return results.map(({ eventAttendee, contact, organization, position, country }) => ({
      ...eventAttendee,
      contact: {
        ...contact,
        organization: organization || undefined,
        position: position || undefined,
        country: country || undefined,
      },
    }));
  }

  async addEventAttendee(data: InsertEventAttendee): Promise<EventAttendee> {
    const [attendee] = await db.insert(eventAttendees).values(data).returning();
    return attendee;
  }

  async removeEventAttendee(eventId: string, leadId: number): Promise<boolean> {
    const result = await db
      .delete(eventAttendees)
      .where(and(eq(eventAttendees.eventId, eventId), eq(eventAttendees.contactId, leadId)))
      .returning();
    return result.length > 0;
  }

  async getContactAttendedEvents(leadId: number): Promise<Event[]> {
    const results = await db
      .select({ event: events })
      .from(eventAttendees)
      .innerJoin(events, eq(eventAttendees.eventId, events.id))
      .where(eq(eventAttendees.contactId, leadId))
      .orderBy(desc(events.startDate));

    return results.map(r => r.event);
  }

  // Event Invitee operations
  async getEventInvitees(eventId: string): Promise<Array<EventInvitee & { contact: Contact & { organization?: Organization; position?: Position; country?: Country } }>> {
    const results = await db
      .select({
        eventInvitee: eventInvitees,
        contact: contacts,
        organization: organizations,
        position: positions,
        country: countries,
      })
      .from(eventInvitees)
      .innerJoin(contacts, eq(eventInvitees.contactId, contacts.id))
      .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
      .leftJoin(positions, eq(contacts.positionId, positions.id))
      .leftJoin(countries, eq(contacts.countryId, countries.id))
      .where(eq(eventInvitees.eventId, eventId))
      .orderBy(desc(eventInvitees.invitedAt));

    return results.map(({ eventInvitee, contact, organization, position, country }) => ({
      ...eventInvitee,
      contact: {
        ...contact,
        organization: organization || undefined,
        position: position || undefined,
        country: country || undefined,
      },
    }));
  }

  async addEventInvitee(data: InsertEventInvitee): Promise<EventInvitee> {
    const [invitee] = await db.insert(eventInvitees).values(data).returning();
    return invitee;
  }

  async updateEventInvitee(eventId: string, leadId: number, data: UpdateEventInvitee): Promise<EventInvitee> {
    const [invitee] = await db
      .update(eventInvitees)
      .set(data)
      .where(and(eq(eventInvitees.eventId, eventId), eq(eventInvitees.contactId, leadId)))
      .returning();
    return invitee;
  }

  async removeEventInvitee(eventId: string, leadId: number): Promise<boolean> {
    const result = await db
      .delete(eventInvitees)
      .where(and(eq(eventInvitees.eventId, eventId), eq(eventInvitees.contactId, leadId)))
      .returning();
    return result.length > 0;
  }

  async getContactInvitedEvents(leadId: number): Promise<Event[]> {
    const results = await db
      .select({ event: events })
      .from(eventInvitees)
      .innerJoin(events, eq(eventInvitees.eventId, events.id))
      .where(eq(eventInvitees.contactId, leadId))
      .orderBy(desc(events.startDate));

    return results.map(r => r.event);
  }

  // Email template operations
  async getEmailTemplate(type: string, language: string): Promise<EmailTemplate | undefined> {
    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(and(eq(emailTemplates.type, type), eq(emailTemplates.language, language)))
      .offset(1);

    return template;
  }

  // Event custom email operations
  async getEventCustomEmail(eventId: string): Promise<EventCustomEmail | undefined> {
    const [customEmail] = await db
      .select()
      .from(eventCustomEmails)
      .where(and(eq(eventCustomEmails.eventId, eventId), eq(eventCustomEmails.isActive, true)))
      .offset(1);

    return customEmail;
  }

  async createEventCustomEmail(data: InsertEventCustomEmail): Promise<EventCustomEmail> {
    // Deactivate any existing active custom emails for this event
    await db
      .update(eventCustomEmails)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(eventCustomEmails.eventId, data.eventId), eq(eventCustomEmails.isActive, true)));

    // Insert new custom email
    const [customEmail] = await db.insert(eventCustomEmails).values(data).returning();
    return customEmail;
  }

  async updateEventCustomEmail(id: number, data: UpdateEventCustomEmail): Promise<EventCustomEmail | undefined> {
    const [customEmail] = await db
      .update(eventCustomEmails)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(eventCustomEmails.id, id))
      .returning();

    return customEmail;
  }

  async deleteEventCustomEmail(id: number): Promise<boolean> {
    const result = await db
      .delete(eventCustomEmails)
      .where(eq(eventCustomEmails.id, id))
      .returning();

    return result.length > 0;
  }

  // Archived Event Speaker operations
  async getArchivedEventSpeakers(archivedEventId: number): Promise<ArchivedEventSpeaker[]> {
    return await db
      .select()
      .from(archivedEventSpeakers)
      .where(eq(archivedEventSpeakers.archivedEventId, archivedEventId))
      .orderBy(asc(archivedEventSpeakers.displayOrder));
  }

  async addArchivedEventSpeaker(data: InsertArchivedEventSpeaker): Promise<ArchivedEventSpeaker> {
    const [speaker] = await db.insert(archivedEventSpeakers).values(data).returning();
    return speaker;
  }

  async removeArchivedEventSpeaker(id: number): Promise<boolean> {
    const result = await db
      .delete(archivedEventSpeakers)
      .where(eq(archivedEventSpeakers.id, id))
      .returning();
    return result.length > 0;
  }

  // ==================== Task Workflow Operations ====================

  // Task Template Prerequisite operations
  async getTaskTemplatePrerequisites(taskTemplateId: number): Promise<TaskTemplatePrerequisite[]> {
    return await db
      .select()
      .from(taskTemplatePrerequisites)
      .where(eq(taskTemplatePrerequisites.taskTemplateId, taskTemplateId));
  }

  async getAllPrerequisitesForTemplate(taskTemplateId: number): Promise<DepartmentRequirement[]> {
    // Recursively get all prerequisites (including transitive ones)
    const visited = new Set<number>();
    const prerequisites: DepartmentRequirement[] = [];
    
    const collectPrerequisites = async (templateId: number) => {
      if (visited.has(templateId)) return;
      visited.add(templateId);
      
      const directPrereqs = await db
        .select({ requirement: departmentRequirements })
        .from(taskTemplatePrerequisites)
        .innerJoin(departmentRequirements, eq(taskTemplatePrerequisites.prerequisiteTemplateId, departmentRequirements.id))
        .where(eq(taskTemplatePrerequisites.taskTemplateId, templateId));
      
      for (const { requirement } of directPrereqs) {
        if (!prerequisites.find(p => p.id === requirement.id)) {
          prerequisites.push(requirement);
          await collectPrerequisites(requirement.id);
        }
      }
    };
    
    await collectPrerequisites(taskTemplateId);
    return prerequisites;
  }

  async getTaskTemplatesWithPrerequisites(departmentId: number): Promise<Array<DepartmentRequirement & { prerequisites: DepartmentRequirement[] }>> {
    const templates = await this.getDepartmentRequirements(departmentId);
    
    const templatesWithPrereqs = await Promise.all(
      templates.map(async (template) => {
        const prereqs = await db
          .select({ requirement: departmentRequirements })
          .from(taskTemplatePrerequisites)
          .innerJoin(departmentRequirements, eq(taskTemplatePrerequisites.prerequisiteTemplateId, departmentRequirements.id))
          .where(eq(taskTemplatePrerequisites.taskTemplateId, template.id));
        
        return {
          ...template,
          prerequisites: prereqs.map(p => p.requirement),
        };
      })
    );
    
    return templatesWithPrereqs;
  }

  async createTaskTemplatePrerequisite(data: InsertTaskTemplatePrerequisite): Promise<TaskTemplatePrerequisite> {
    const [prereq] = await db.insert(taskTemplatePrerequisites).values(data).returning();
    return prereq;
  }

  async deleteTaskTemplatePrerequisite(taskTemplateId: number, prerequisiteTemplateId: number): Promise<boolean> {
    const result = await db
      .delete(taskTemplatePrerequisites)
      .where(and(
        eq(taskTemplatePrerequisites.taskTemplateId, taskTemplateId),
        eq(taskTemplatePrerequisites.prerequisiteTemplateId, prerequisiteTemplateId)
      ))
      .returning();
    return result.length > 0;
  }

  async getAvailablePrerequisites(taskTemplateId: number): Promise<DepartmentRequirement[]> {
    // Get all templates except the current one and any that would create a cycle
    const allTemplates = await db.select().from(departmentRequirements);
    
    // Get templates that depend on this template (directly or indirectly)
    const dependentTemplates = new Set<number>();
    const findDependents = async (templateId: number) => {
      const dependents = await db
        .select()
        .from(taskTemplatePrerequisites)
        .where(eq(taskTemplatePrerequisites.prerequisiteTemplateId, templateId));
      
      for (const dep of dependents) {
        if (!dependentTemplates.has(dep.taskTemplateId)) {
          dependentTemplates.add(dep.taskTemplateId);
          await findDependents(dep.taskTemplateId);
        }
      }
    };
    
    await findDependents(taskTemplateId);
    
    // Exclude the current template and any templates that depend on it
    return allTemplates.filter(
      t => t.id !== taskTemplateId && !dependentTemplates.has(t.id)
    );
  }

  // Event Workflow operations
  async getEventWorkflows(eventId: string): Promise<EventWorkflow[]> {
    return await db
      .select()
      .from(eventWorkflows)
      .where(eq(eventWorkflows.eventId, eventId))
      .orderBy(desc(eventWorkflows.createdAt));
  }

  async getWorkflow(workflowId: number): Promise<EventWorkflow | undefined> {
    const [workflow] = await db
      .select()
      .from(eventWorkflows)
      .where(eq(eventWorkflows.id, workflowId))
      .offset(1);
    return workflow;
  }

  async getWorkflowWithTasks(workflowId: number): Promise<(EventWorkflow & { 
    tasks: Array<WorkflowTask & { task: Task & { department: Department; event: Event } }> 
  }) | undefined> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) return undefined;

    const workflowTasksData = await db
      .select({
        workflowTask: workflowTasks,
        task: tasks,
        eventDepartment: eventDepartments,
        department: departments,
        event: events,
      })
      .from(workflowTasks)
      .innerJoin(tasks, eq(workflowTasks.taskId, tasks.id))
      .innerJoin(eventDepartments, eq(tasks.eventDepartmentId, eventDepartments.id))
      .innerJoin(departments, eq(eventDepartments.departmentId, departments.id))
      .innerJoin(events, eq(eventDepartments.eventId, events.id))
      .where(eq(workflowTasks.workflowId, workflowId))
      .orderBy(asc(workflowTasks.orderIndex));

    return {
      ...workflow,
      tasks: workflowTasksData.map(wt => ({
        ...wt.workflowTask,
        task: {
          ...wt.task,
          department: wt.department,
          event: wt.event,
        },
      })),
    };
  }

  async createEventWorkflow(data: InsertEventWorkflow): Promise<EventWorkflow> {
    const [workflow] = await db.insert(eventWorkflows).values(data).returning();
    return workflow;
  }

  async deleteEventWorkflow(workflowId: number): Promise<boolean> {
    const result = await db
      .delete(eventWorkflows)
      .where(eq(eventWorkflows.id, workflowId))
      .returning();
    return result.length > 0;
  }

  // Workflow Task operations
  async getWorkflowTasks(workflowId: number): Promise<WorkflowTask[]> {
    return await db
      .select()
      .from(workflowTasks)
      .where(eq(workflowTasks.workflowId, workflowId))
      .orderBy(asc(workflowTasks.orderIndex));
  }

  async addTaskToWorkflow(data: InsertWorkflowTask): Promise<WorkflowTask> {
    const [workflowTask] = await db.insert(workflowTasks).values(data).returning();
    return workflowTask;
  }

  async removeTaskFromWorkflow(workflowId: number, taskId: number): Promise<boolean> {
    const result = await db
      .delete(workflowTasks)
      .where(and(
        eq(workflowTasks.workflowId, workflowId),
        eq(workflowTasks.taskId, taskId)
      ))
      .returning();
    return result.length > 0;
  }

  async getTaskWorkflow(taskId: number): Promise<(EventWorkflow & { tasks: WorkflowTask[] }) | undefined> {
    // Find the workflow that contains this task
    const [workflowTaskEntry] = await db
      .select()
      .from(workflowTasks)
      .where(eq(workflowTasks.taskId, taskId))
      .offset(1);

    if (!workflowTaskEntry) return undefined;

    const workflow = await this.getWorkflow(workflowTaskEntry.workflowId);
    if (!workflow) return undefined;

    const allTasks = await this.getWorkflowTasks(workflow.id);
    return { ...workflow, tasks: allTasks };
  }

  // Workflow Status Management
  async getWaitingTasksForPrerequisite(prerequisiteTaskId: number): Promise<Task[]> {
    // Find all tasks that are waiting on the given prerequisite task
    const waitingTasksData = await db
      .select({ task: tasks })
      .from(workflowTasks)
      .innerJoin(tasks, eq(workflowTasks.taskId, tasks.id))
      .where(and(
        eq(workflowTasks.prerequisiteTaskId, prerequisiteTaskId),
        eq(tasks.status, 'waiting')
      ));

    return waitingTasksData.map(wt => wt.task);
  }

  async activateWaitingTasks(prerequisiteTaskId: number): Promise<Task[]> {
    // Get all waiting tasks that depend on this prerequisite
    const waitingTasks = await this.getWaitingTasksForPrerequisite(prerequisiteTaskId);
    
    if (waitingTasks.length === 0) return [];

    // Update each waiting task to pending - ONLY direct dependents
    const activatedTasks: Task[] = [];
    for (const task of waitingTasks) {
      // Check if all prerequisites for this task are completed
      const taskWorkflowEntry = await db
        .select()
        .from(workflowTasks)
        .where(eq(workflowTasks.taskId, task.id))
        .offset(1);

      if (taskWorkflowEntry.length > 0 && taskWorkflowEntry[0].prerequisiteTaskId) {
        const [prereqTask] = await db
          .select()
          .from(tasks)
          .where(eq(tasks.id, taskWorkflowEntry[0].prerequisiteTaskId))
          .offset(1);

        // Only activate if prerequisite is completed
        if (prereqTask && prereqTask.status === 'completed') {
          const [updated] = await db
            .update(tasks)
            .set({ status: 'pending', updatedAt: new Date() })
            .where(eq(tasks.id, task.id))
            .returning();
          
          if (updated) {
            activatedTasks.push(updated);
          }
        }
      }
    }

    return activatedTasks;
  }

  // Department Workflow Visibility
  async getWorkflowsForDepartment(departmentId: number): Promise<Array<EventWorkflow & { 
    tasks: Array<WorkflowTask & { task: Task & { department: Department; event: Event } }>;
    event: Event;
  }>> {
    // Find all workflows that contain tasks belonging to this department
    const workflowIds = await db
      .selectDistinct({ workflowId: workflowTasks.workflowId })
      .from(workflowTasks)
      .innerJoin(tasks, eq(workflowTasks.taskId, tasks.id))
      .innerJoin(eventDepartments, eq(tasks.eventDepartmentId, eventDepartments.id))
      .where(eq(eventDepartments.departmentId, departmentId));

    const workflows: Array<EventWorkflow & { 
      tasks: Array<WorkflowTask & { task: Task & { department: Department; event: Event } }>;
      event: Event;
    }> = [];

    for (const { workflowId } of workflowIds) {
      const workflow = await this.getWorkflowWithTasks(workflowId);
      if (workflow) {
        const [event] = await db
          .select()
          .from(events)
          .where(eq(events.id, workflow.eventId))
          .offset(1);

        if (event) {
          workflows.push({
            ...workflow,
            event,
          });
        }
      }
    }

    return workflows;
  }

  async canDepartmentViewWorkflow(departmentId: number, workflowId: number): Promise<boolean> {
    // Check if any task in the workflow belongs to this department
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(workflowTasks)
      .innerJoin(tasks, eq(workflowTasks.taskId, tasks.id))
      .innerJoin(eventDepartments, eq(tasks.eventDepartmentId, eventDepartments.id))
      .where(and(
        eq(workflowTasks.workflowId, workflowId),
        eq(eventDepartments.departmentId, departmentId)
      ));

    console.log(`[canDepartmentViewWorkflow] departmentId=${departmentId}, workflowId=${workflowId}, count=${result[0]?.count}`);
    return result[0]?.count > 0;
  }

  // Task dependency checks
  async isTaskPrerequisiteForOthers(taskId: number): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(workflowTasks)
      .where(eq(workflowTasks.prerequisiteTaskId, taskId));

    return result[0]?.count > 0;
  }

  async getDependentTasks(taskId: number): Promise<Task[]> {
    const dependentTasksData = await db
      .select({ task: tasks })
      .from(workflowTasks)
      .innerJoin(tasks, eq(workflowTasks.taskId, tasks.id))
      .where(eq(workflowTasks.prerequisiteTaskId, taskId));

    return dependentTasksData.map(dt => dt.task);
  }

  // ==================== Partnership Management Implementation ====================

  async getAllPartners(options?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    search?: string;
    sortBy?: string;
  }): Promise<{ partners: (Organization & { latestActivityDate?: string | null; daysSinceLastActivity?: number | null })[]; total: number; page: number; limit: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(organizations.isPartner, true)];
    
    if (options?.status) {
      conditions.push(eq(organizations.partnershipStatus, options.status));
    }
    if (options?.type) {
      const typeId = typeof options.type === 'string' ? parseInt(options.type, 10) : options.type;
      conditions.push(eq(organizations.partnershipTypeId, typeId));
    }
    if (options?.search) {
      const searchCondition = or(
        like(organizations.nameEn, `%${options.search}%`),
        like(organizations.nameAr, `%${options.search}%`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(organizations)
      .where(whereClause);

    // Determine sort order
    let orderByClause;
    switch (options?.sortBy) {
      case 'latestActivity':
        // Most recent activity first
        orderByClause = desc(organizations.lastActivityDate);
        break;
      case 'oldestActivity':
        // Oldest/stale partnerships first (for identifying inactive partnerships)
        orderByClause = asc(sql`COALESCE(${organizations.lastActivityDate}, '1970-01-01'::timestamp)`);
        break;
      case 'name':
        orderByClause = asc(organizations.nameEn);
        break;
      case 'status':
        orderByClause = asc(organizations.partnershipStatus);
        break;
      default:
        // Default: by start date
        orderByClause = desc(organizations.partnershipStartDate);
    }

    // Get latest activity date for each organization using a subquery
    const partners = await db
      .select({
        id: organizations.id,
        nameEn: organizations.nameEn,
        nameAr: organizations.nameAr,
        createdAt: organizations.createdAt,
        isPartner: organizations.isPartner,
        partnershipStatus: organizations.partnershipStatus,
        partnershipTypeId: organizations.partnershipTypeId,
        partnershipStartDate: organizations.partnershipStartDate,
        partnershipEndDate: organizations.partnershipEndDate,
        countryId: organizations.countryId,
        country: countries,
        agreementSignedBy: organizations.agreementSignedBy,
        agreementSignedByUs: organizations.agreementSignedByUs,
        partnershipNotes: organizations.partnershipNotes,
        logoKey: organizations.logoKey,
        website: organizations.website,
        primaryContactId: organizations.primaryContactId,
        // Inactivity monitoring fields
        inactivityThresholdMonths: organizations.inactivityThresholdMonths,
        lastActivityDate: organizations.lastActivityDate,
        notifyOnInactivity: organizations.notifyOnInactivity,
        lastInactivityNotificationSent: organizations.lastInactivityNotificationSent,
        // Also include the subquery for backwards compatibility
        latestActivityDate: sql<string | null>`(
          SELECT MAX(start_date)::text
          FROM partnership_activities
          WHERE partnership_activities.organization_id = ${organizations.id}
        )`,
      })
      .from(organizations)
      .leftJoin(countries, eq(organizations.countryId, countries.id))
      .where(whereClause)
      .orderBy(orderByClause)
      .offset(limit)
      .offset(offset);

    // Map partners to include computed fields
    const now = new Date();
    const partnersWithScope = partners.map(partner => {
      const lastActivity = partner.lastActivityDate;
      const daysSinceLastActivity = lastActivity 
        ? Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      
      return {
        ...partner,
        scope: classifyPartnershipScope(partner.country?.code || null),
        daysSinceLastActivity,
      };
    });

    return {
      partners: partnersWithScope,
      total: countResult.count,
      page,
      limit,
    };
  }

  async updatePartnership(id: number, data: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const [updated] = await db
      .update(organizations)
      .set(data)
      .where(eq(organizations.id, id))
      .returning();
    return updated;
  }

  async getPartnerStats(): Promise<{
    totalPartners: number;
    activePartnerships: number;
    pendingAgreements: number;
    expiringSoon: number;
  }> {
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(organizations)
      .where(eq(organizations.isPartner, true));

    const [activeResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(organizations)
      .where(and(
        eq(organizations.isPartner, true),
        eq(organizations.partnershipStatus, 'active')
      ));

    const [pendingResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(partnershipAgreements)
      .where(eq(partnershipAgreements.status, 'pending_approval'));

    // Expiring within 90 days
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
    const [expiringResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(partnershipAgreements)
      .where(and(
        eq(partnershipAgreements.status, 'active'),
        lte(partnershipAgreements.expiryDate, ninetyDaysFromNow.toISOString().split('T')[0])
      ));

    return {
      totalPartners: totalResult.count,
      activePartnerships: activeResult.count,
      pendingAgreements: pendingResult.count,
      expiringSoon: expiringResult.count,
    };
  }

  async getPartnershipAgreements(organizationId: number): Promise<any[]> {
    return db
      .select({
        id: partnershipAgreements.id,
        organizationId: partnershipAgreements.organizationId,
        title: partnershipAgreements.title,
        titleAr: partnershipAgreements.titleAr,
        description: partnershipAgreements.description,
        descriptionAr: partnershipAgreements.descriptionAr,
        agreementTypeId: partnershipAgreements.agreementTypeId,
        agreementType: {
          id: agreementTypes.id,
          nameEn: agreementTypes.nameEn,
          nameAr: agreementTypes.nameAr,
        },
        signedDate: partnershipAgreements.signedDate,
        effectiveDate: partnershipAgreements.effectiveDate,
        expiryDate: partnershipAgreements.expiryDate,
        partnerSignatory: partnershipAgreements.partnerSignatory,
        partnerSignatoryTitle: partnershipAgreements.partnerSignatoryTitle,
        ourSignatory: partnershipAgreements.ourSignatory,
        ourSignatoryTitle: partnershipAgreements.ourSignatoryTitle,
        documentKey: partnershipAgreements.documentKey,
        documentFileName: partnershipAgreements.documentFileName,
        status: partnershipAgreements.status,
        legalStatus: partnershipAgreements.legalStatus,
        languages: partnershipAgreements.languages,
        terminationClause: partnershipAgreements.terminationClause,
        terminationClauseAr: partnershipAgreements.terminationClauseAr,
        createdByUserId: partnershipAgreements.createdByUserId,
        createdAt: partnershipAgreements.createdAt,
        updatedAt: partnershipAgreements.updatedAt,
      })
      .from(partnershipAgreements)
      .leftJoin(agreementTypes, eq(partnershipAgreements.agreementTypeId, agreementTypes.id))
      .where(eq(partnershipAgreements.organizationId, organizationId))
      .orderBy(desc(partnershipAgreements.signedDate));
  }

  async getPartnershipAgreement(id: number): Promise<PartnershipAgreement | undefined> {
    const [agreement] = await db
      .select()
      .from(partnershipAgreements)
      .where(eq(partnershipAgreements.id, id))
      .offset(1);
    return agreement;
  }

  async createPartnershipAgreement(data: InsertPartnershipAgreement): Promise<PartnershipAgreement> {
    const [agreement] = await db
      .insert(partnershipAgreements)
      .values(data)
      .returning();
    return agreement;
  }

  async updatePartnershipAgreement(id: number, data: UpdatePartnershipAgreement): Promise<PartnershipAgreement | undefined> {
    const [updated] = await db
      .update(partnershipAgreements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(partnershipAgreements.id, id))
      .returning();
    return updated;
  }

  async deletePartnershipAgreement(id: number): Promise<boolean> {
    const result = await db
      .delete(partnershipAgreements)
      .where(eq(partnershipAgreements.id, id));
    return true;
  }

  async getPartnershipActivities(organizationId: number): Promise<any[]> {
    const results = await db
      .select({
        activity: partnershipActivities,
        event: events,
      })
      .from(partnershipActivities)
      .leftJoin(events, eq(partnershipActivities.eventId, events.id))
      .where(eq(partnershipActivities.organizationId, organizationId))
      .orderBy(desc(partnershipActivities.startDate));
    
    return results.map(row => ({
      ...row.activity,
      linkedEventId: row.activity.eventId,
      linkedEvent: row.event ? {
        id: row.event.id,
        titleEn: row.event.name,
        titleAr: row.event.nameAr,
      } : null,
    }));
  }

  async getActivitiesByEventId(eventId: string): Promise<any[]> {
    const results = await db
      .select({
        activity: partnershipActivities,
        organization: organizations,
        createdBy: users,
      })
      .from(partnershipActivities)
      .leftJoin(organizations, eq(partnershipActivities.organizationId, organizations.id))
      .leftJoin(users, eq(partnershipActivities.createdByUserId, users.id))
      .where(eq(partnershipActivities.eventId, eventId))
      .orderBy(desc(partnershipActivities.startDate));
    
    return results.map(row => ({
      ...row.activity,
      organization: row.organization ? {
        id: row.organization.id,
        nameEn: row.organization.nameEn,
        nameAr: row.organization.nameAr,
      } : null,
      createdByUser: row.createdBy ? {
        id: row.createdBy.id,
        username: row.createdBy.username,
      } : null,
    }));
  }

  async getPartnershipActivity(id: number): Promise<PartnershipActivity | undefined> {
    const [activity] = await db
      .select()
      .from(partnershipActivities)
      .where(eq(partnershipActivities.id, id))
      .offset(1);
    return activity;
  }

  async createPartnershipActivity(data: InsertPartnershipActivity): Promise<PartnershipActivity> {
    // Note: startDate and endDate are 'date' columns (not timestamp), so they should remain as strings in 'YYYY-MM-DD' format
    const [activity] = await db
      .insert(partnershipActivities)
      .values(data)
      .returning();
    
    // Update the organization's lastActivityDate (convert string date to Date for comparison)
    const activityDate = data.startDate ? new Date(data.startDate) : new Date();
    await this.updatePartnershipLastActivity(data.organizationId, activityDate);
    
    return activity;
  }

  async updatePartnershipActivity(id: number, data: UpdatePartnershipActivity): Promise<PartnershipActivity | undefined> {
    // Note: startDate and endDate are 'date' columns (not timestamp), so they should remain as strings in 'YYYY-MM-DD' format
    const updateData: any = { ...data, updatedAt: new Date() };

    const [updated] = await db
      .update(partnershipActivities)
      .set(updateData)
      .where(eq(partnershipActivities.id, id))
      .returning();
    
    // If startDate was updated, recalculate organization's lastActivityDate
    if (updated && data.startDate) {
      await this.updatePartnershipLastActivity(updated.organizationId, new Date(data.startDate));
    }
    
    return updated;
  }

  async deletePartnershipActivity(id: number): Promise<boolean> {
    // First get the activity to know which organization to update
    const activity = await this.getPartnershipActivity(id);
    
    await db
      .delete(partnershipActivities)
      .where(eq(partnershipActivities.id, id));
    
    // Recalculate the organization's lastActivityDate after deletion
    if (activity) {
      await this.updatePartnershipLastActivity(activity.organizationId);
    }
    
    return true;
  }

  async getPartnerEvents(organizationId: number): Promise<Event[]> {
    // Get events linked through partnership activities
    const linkedEvents = await db
      .select({ event: events })
      .from(partnershipActivities)
      .innerJoin(events, eq(partnershipActivities.eventId, events.id))
      .where(eq(partnershipActivities.organizationId, organizationId));

    return linkedEvents.map(le => le.event);
  }

  async getPartnershipContacts(organizationId: number): Promise<Array<PartnershipContact & { contact: Contact }>> {
    const result = await db
      .select({
        partnershipContact: partnershipContacts,
        contact: contacts,
      })
      .from(partnershipContacts)
      .innerJoin(contacts, eq(partnershipContacts.contactId, contacts.id))
      .where(eq(partnershipContacts.organizationId, organizationId))
      .orderBy(desc(partnershipContacts.isPrimary));

    return result.map(r => ({
      ...r.partnershipContact,
      contact: r.contact,
    }));
  }

  async addPartnershipContact(data: InsertPartnershipContact): Promise<PartnershipContact> {
    const [contact] = await db
      .insert(partnershipContacts)
      .values(data)
      .returning();
    return contact;
  }

  async updatePartnershipContact(id: number, data: UpdatePartnershipContact): Promise<PartnershipContact | undefined> {
    const [updated] = await db
      .update(partnershipContacts)
      .set(data)
      .where(eq(partnershipContacts.id, id))
      .returning();
    return updated;
  }

  async removePartnershipContact(id: number): Promise<boolean> {
    await db
      .delete(partnershipContacts)
      .where(eq(partnershipContacts.id, id));
    return true;
  }

  // Partnership Comments
  async getPartnershipComments(organizationId: number): Promise<Array<PartnershipComment & { authorUsername: string | null }>> {
    const results = await db
      .select({
        id: partnershipComments.id,
        organizationId: partnershipComments.organizationId,
        body: partnershipComments.body,
        bodyAr: partnershipComments.bodyAr,
        authorUserId: partnershipComments.authorUserId,
        createdAt: partnershipComments.createdAt,
        updatedAt: partnershipComments.updatedAt,
        authorUsername: users.username,
      })
      .from(partnershipComments)
      .leftJoin(users, eq(partnershipComments.authorUserId, users.id))
      .where(eq(partnershipComments.organizationId, organizationId))
      .orderBy(desc(partnershipComments.createdAt));

    return results.map(row => ({
      id: row.id,
      organizationId: row.organizationId,
      body: row.body,
      bodyAr: row.bodyAr,
      authorUserId: row.authorUserId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      authorUsername: row.authorUsername,
    }));
  }

  async getPartnershipComment(id: number): Promise<PartnershipComment | undefined> {
    const [comment] = await db
      .select()
      .from(partnershipComments)
      .where(eq(partnershipComments.id, id));
    return comment;
  }

  async createPartnershipComment(data: InsertPartnershipComment): Promise<PartnershipComment> {
    const [comment] = await db
      .insert(partnershipComments)
      .values(data)
      .returning();
    return comment;
  }

  async updatePartnershipComment(id: number, data: UpdatePartnershipComment): Promise<PartnershipComment | undefined> {
    const [updated] = await db
      .update(partnershipComments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(partnershipComments.id, id))
      .returning();
    return updated;
  }

  async deletePartnershipComment(id: number): Promise<boolean> {
    await db
      .delete(partnershipComments)
      .where(eq(partnershipComments.id, id));
    return true;
  }

  // Agreement Attachments
  async getAgreementAttachments(agreementId: number): Promise<AgreementAttachment[]> {
    return db
      .select()
      .from(agreementAttachments)
      .where(eq(agreementAttachments.agreementId, agreementId))
      .orderBy(desc(agreementAttachments.uploadedAt));
  }

  async getAgreementAttachment(id: number): Promise<AgreementAttachment | undefined> {
    const [attachment] = await db
      .select()
      .from(agreementAttachments)
      .where(eq(agreementAttachments.id, id))
      .offset(1);
    return attachment;
  }

  async getAgreementAttachmentByObjectKey(objectKey: string): Promise<AgreementAttachment | undefined> {
    const [attachment] = await db
      .select()
      .from(agreementAttachments)
      .where(eq(agreementAttachments.objectKey, objectKey))
      .offset(1);
    return attachment;
  }

  async createAgreementAttachment(data: InsertAgreementAttachment): Promise<AgreementAttachment> {
    const [attachment] = await db
      .insert(agreementAttachments)
      .values(data)
      .returning();
    return attachment;
  }

  async deleteAgreementAttachment(id: number): Promise<boolean> {
    await db
      .delete(agreementAttachments)
      .where(eq(agreementAttachments.id, id));
    return true;
  }

  // ==================== Partnership Inactivity Monitoring Implementation ====================

  /**
   * Get partnerships that have been inactive for longer than their threshold
   * @param thresholdDate - Base date for comparison (typically calculated from default threshold)
   */
  async getInactivePartnerships(thresholdDate: Date): Promise<Array<Organization & { daysSinceLastActivity: number }>> {
    const now = new Date();
    
    // Get all partners that:
    // 1. Are marked as partners
    // 2. Have inactivity notifications enabled
    // 3. Have a lastActivityDate older than their individual threshold OR the provided thresholdDate
    const partners = await db
      .select()
      .from(organizations)
      .where(
        and(
          eq(organizations.isPartner, true),
          eq(organizations.notifyOnInactivity, true),
          isNotNull(organizations.lastActivityDate)
        )
      );
    
    // Filter based on each partner's individual threshold
    const inactivePartners = partners.filter(partner => {
      if (!partner.lastActivityDate) return false;
      
      const thresholdMonths = partner.inactivityThresholdMonths || 6;
      const partnerThresholdDate = new Date();
      partnerThresholdDate.setMonth(partnerThresholdDate.getMonth() - thresholdMonths);
      
      return partner.lastActivityDate < partnerThresholdDate;
    });
    
    // Calculate days since last activity and return
    return inactivePartners.map(partner => ({
      ...partner,
      daysSinceLastActivity: Math.floor((now.getTime() - (partner.lastActivityDate?.getTime() || now.getTime())) / (1000 * 60 * 60 * 24))
    }));
  }

  /**
   * Update the lastActivityDate for a partnership
   * If activityDate is provided, uses that; otherwise calculates from most recent activity
   */
  async updatePartnershipLastActivity(organizationId: number, activityDate?: Date): Promise<void> {
    if (activityDate) {
      // Use the provided date if it's newer than the current lastActivityDate
      const [org] = await db
        .select({ lastActivityDate: organizations.lastActivityDate })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .offset(1);
      
      const currentLastActivity = org?.lastActivityDate;
      const newLastActivity = activityDate > (currentLastActivity || new Date(0)) ? activityDate : currentLastActivity;
      
      await db
        .update(organizations)
        .set({ lastActivityDate: newLastActivity })
        .where(eq(organizations.id, organizationId));
    } else {
      // Calculate from most recent activity
      const [latestActivity] = await db
        .select({ maxDate: sql<Date>`MAX(start_date::timestamp)` })
        .from(partnershipActivities)
        .where(eq(partnershipActivities.organizationId, organizationId));
      
      const lastActivityDate = latestActivity?.maxDate || null;
      
      await db
        .update(organizations)
        .set({ lastActivityDate })
        .where(eq(organizations.id, organizationId));
    }
  }

  /**
   * Update inactivity monitoring settings for a partnership
   */
  async updatePartnershipInactivitySettings(
    organizationId: number, 
    settings: { inactivityThresholdMonths?: number; notifyOnInactivity?: boolean }
  ): Promise<Organization | undefined> {
    const [updated] = await db
      .update(organizations)
      .set(settings)
      .where(eq(organizations.id, organizationId))
      .returning();
    return updated;
  }

  /**
   * Mark that an inactivity notification was sent for this partnership
   */
  async markInactivityNotificationSent(organizationId: number): Promise<void> {
    await db
      .update(organizations)
      .set({ lastInactivityNotificationSent: new Date() })
      .where(eq(organizations.id, organizationId));
  }

  // ==================== Lead Management Implementation ====================

  // Leads
  async getAllLeads(options?: {
    search?: string;
    type?: string;
    status?: string;
  }): Promise<(Lead & { interactionsCount?: number; tasksCount?: number; pendingTasksCount?: number })[]> {
    const conditions = [];
    
    if (options?.type) {
      conditions.push(eq(leads.type, options.type));
    }
    if (options?.status) {
      conditions.push(eq(leads.status, options.status));
    }
    if (options?.search) {
      conditions.push(or(
        like(leads.name, `%${options.search}%`),
        like(leads.nameAr, `%${options.search}%`),
        like(leads.email, `%${options.search}%`),
        like(leads.phone, `%${options.search}%`)
      )!);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const contacts = await db
      .select()
      .from(leads)
      .where(whereClause)
      .orderBy(desc(leads.createdAt));

    // Get counts for each contact
    const contactsWithCounts = await Promise.all(
      contacts.map(async (contact) => {
        // Count interactions
        const [interactionResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(leadInteractions)
          .where(eq(leadInteractions.leadId, contact.id));

        // Count total tasks
        const [taskResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(contactTasks)
          .where(eq(contactTasks.leadId, contact.id));

        // Count pending tasks
        const [pendingTaskResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(contactTasks)
          .where(and(
            eq(contactTasks.leadId, contact.id),
            eq(contactTasks.status, 'pending')
          ));

        return {
          ...contact,
          interactionsCount: Number(interactionResult?.count || 0),
          tasksCount: Number(taskResult?.count || 0),
          pendingTasksCount: Number(pendingTaskResult?.count || 0),
        };
      })
    );

    return contactsWithCounts;
  }

  async getLead(id: number): Promise<Lead | undefined> {
    const [contact] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, id))
      .offset(1);
    return contact;
  }

  async getLeadWithDetails(id: number): Promise<(Lead & { 
    organization?: Organization;
    interactionCount?: number;
    taskCount?: number;
  }) | undefined> {
    const [contact] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, id))
      .offset(1);

    if (!contact) return undefined;

    let organization: Organization | undefined;

    if (contact.organizationId) {
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, contact.organizationId))
        .offset(1);
      organization = org;
    }

    // Count interactions
    const [interactionResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(leadInteractions)
      .where(eq(leadInteractions.leadId, id));

    // Count tasks
    const [taskResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(contactTasks)
      .where(eq(contactTasks.leadId, id));

    return {
      ...contact,
      organization,
      interactionCount: interactionResult.count,
      taskCount: taskResult.count,
    };
  }

  async createLead(data: InsertLead): Promise<Lead> {
    const [contact] = await db
      .insert(leads)
      .values(data)
      .returning();
    return contact;
  }

  async updateLead(id: number, data: UpdateLead): Promise<Lead | undefined> {
    const [updated] = await db
      .update(leads)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return updated;
  }

  async deleteLead(id: number): Promise<boolean> {
    await db.delete(leads).where(eq(leads.id, id));
    return true;
  }

  // Contact Interactions
  async getLeadInteractions(leadId: number): Promise<LeadInteraction[]> {
    return db
      .select()
      .from(leadInteractions)
      .where(eq(leadInteractions.leadId, leadId))
      .orderBy(desc(leadInteractions.interactionDate));
  }

  async getLeadInteraction(id: number): Promise<LeadInteraction | undefined> {
    const [interaction] = await db
      .select()
      .from(leadInteractions)
      .where(eq(leadInteractions.id, id))
      .offset(1);
    return interaction;
  }

  async createLeadInteraction(data: InsertLeadInteraction): Promise<LeadInteraction> {
    const [interaction] = await db
      .insert(leadInteractions)
      .values(data)
      .returning();

    // Update contact's updatedAt
    await db
      .update(leads)
      .set({ updatedAt: new Date() })
      .where(eq(leads.id, data.leadId));

    return interaction;
  }

  async updateLeadInteraction(id: number, data: UpdateLeadInteraction): Promise<LeadInteraction | undefined> {
    const [updated] = await db
      .update(leadInteractions)
      .set(data)
      .where(eq(leadInteractions.id, id))
      .returning();
    return updated;
  }

  async deleteLeadInteraction(id: number): Promise<boolean> {
    await db
      .delete(leadInteractions)
      .where(eq(leadInteractions.id, id));
    return true;
  }

  // Partnership Interactions
  async getPartnershipInteractions(organizationId: number): Promise<PartnershipInteraction[]> {
    return db
      .select()
      .from(partnershipInteractions)
      .where(eq(partnershipInteractions.organizationId, organizationId))
      .orderBy(desc(partnershipInteractions.interactionDate));
  }

  async getPartnershipInteraction(id: number): Promise<PartnershipInteraction | undefined> {
    const [interaction] = await db
      .select()
      .from(partnershipInteractions)
      .where(eq(partnershipInteractions.id, id))
      .offset(1);
    return interaction;
  }

  async createPartnershipInteraction(data: InsertPartnershipInteraction): Promise<PartnershipInteraction> {
    const [interaction] = await db
      .insert(partnershipInteractions)
      .values(data)
      .returning();

    // Update organization's updatedAt (if field exists) or just return
    // Partnership activities update the last_activity_date automatically via trigger or we can update it here
    return interaction;
  }

  async updatePartnershipInteraction(id: number, data: UpdatePartnershipInteraction): Promise<PartnershipInteraction | undefined> {
    const [updated] = await db
      .update(partnershipInteractions)
      .set(data)
      .where(eq(partnershipInteractions.id, id))
      .returning();
    return updated;
  }

  async deletePartnershipInteraction(id: number): Promise<boolean> {
    await db
      .delete(partnershipInteractions)
      .where(eq(partnershipInteractions.id, id));
    return true;
  }

  // Partnership Tasks
  async getPartnershipTasks(partnershipId: number): Promise<Task[]> {
    return db
      .select()
      .from(tasks)
      .where(eq(tasks.partnershipId, partnershipId))
      .orderBy(asc(tasks.dueDate));
  }

  async createPartnershipTask(data: InsertTask): Promise<Task> {
    const [task] = await db
      .insert(tasks)
      .values(data)
      .returning();
    return task;
  }

  // Partnership tasks for stakeholder dashboard
  async getPartnershipTasksForDashboard(departmentId: number): Promise<any[]> {
    const tasksWithDetails = await db
      .select({
        id: tasks.id,
        partnershipId: tasks.partnershipId,
        title: tasks.title,
        titleAr: tasks.titleAr,
        description: tasks.description,
        descriptionAr: tasks.descriptionAr,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        departmentId: tasks.departmentId,
        completedAt: tasks.completedAt,
        notificationEmails: tasks.notificationEmails,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        partnershipNameEn: organizations.nameEn,
        partnershipNameAr: organizations.nameAr,
      })
      .from(tasks)
      .innerJoin(organizations, eq(tasks.partnershipId, organizations.id))
      .where(
        and(
          eq(tasks.departmentId, departmentId),
          isNotNull(tasks.partnershipId)
        )
      )
      .orderBy(desc(tasks.createdAt));

    // Add comment count for each task
    const tasksWithComments = await Promise.all(
      tasksWithDetails.map(async (task) => {
        const [commentCountResult] = await db
          .select({ count: count() })
          .from(taskComments)
          .where(eq(taskComments.taskId, task.id));
        
        return {
          ...task,
          commentCount: Number(commentCountResult?.count || 0),
          partnership: task.partnershipNameEn ? {
            id: task.partnershipId,
            nameEn: task.partnershipNameEn,
            nameAr: task.partnershipNameAr,
          } : null,
        };
      })
    );

    return tasksWithComments;
  }

  async getPartnershipTaskWithDetails(id: number): Promise<any> {
    const [task] = await db
      .select({
        id: tasks.id,
        partnershipId: tasks.partnershipId,
        title: tasks.title,
        titleAr: tasks.titleAr,
        description: tasks.description,
        descriptionAr: tasks.descriptionAr,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        departmentId: tasks.departmentId,
        completedAt: tasks.completedAt,
        notificationEmails: tasks.notificationEmails,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        partnershipNameEn: organizations.nameEn,
        partnershipNameAr: organizations.nameAr,
        departmentName: departments.name,
      })
      .from(tasks)
      .innerJoin(organizations, eq(tasks.partnershipId, organizations.id))
      .leftJoin(departments, eq(tasks.departmentId, departments.id))
      .where(eq(tasks.id, id));

    if (!task) return undefined;

    // Get comment count
    const [commentCountResult] = await db
      .select({ count: count() })
      .from(taskComments)
      .where(eq(taskComments.taskId, id));

    return {
      ...task,
      commentCount: Number(commentCountResult?.count || 0),
      partnership: task.partnershipNameEn ? {
        id: task.partnershipId,
        nameEn: task.partnershipNameEn,
        nameAr: task.partnershipNameAr,
      } : null,
    };
  }

  // Contact Tasks
  async getContactTasks(leadId: number): Promise<ContactTask[]> {
    return db
      .select()
      .from(contactTasks)
      .where(eq(contactTasks.leadId, leadId))
      .orderBy(asc(contactTasks.dueDate));
  }

  async getContactTask(id: number): Promise<ContactTask | undefined> {
    const [task] = await db
      .select()
      .from(contactTasks)
      .where(eq(contactTasks.id, id))
      .offset(1);
    return task;
  }

  async getContactTaskWithDepartment(id: number): Promise<(ContactTask & { department?: Department }) | undefined> {
    const task = await this.getContactTask(id);
    if (!task) return undefined;

    let department: Department | undefined;
    if (task.departmentId) {
      department = await this.getDepartment(task.departmentId);
    }

    return { ...task, department };
  }

  async getContactTasksByDepartment(departmentId: number): Promise<(ContactTask & { contact?: { id: number; name: string; status: string } })[]> {
    const results = await db
      .select({
        id: contactTasks.id,
        leadId: contactTasks.leadId,
        title: contactTasks.title,
        titleAr: contactTasks.titleAr,
        description: contactTasks.description,
        descriptionAr: contactTasks.descriptionAr,
        status: contactTasks.status,
        priority: contactTasks.priority,
        departmentId: contactTasks.departmentId,
        dueDate: contactTasks.dueDate,
        completedAt: contactTasks.completedAt,
        eventDepartmentId: contactTasks.eventDepartmentId,
        notificationEmails: contactTasks.notificationEmails,
        createdByUserId: contactTasks.createdByUserId,
        createdAt: contactTasks.createdAt,
        updatedAt: contactTasks.updatedAt,
        contactName: leads.name,
        contactStatus: leads.status,
      })
      .from(contactTasks)
      .leftJoin(leads, eq(contactTasks.leadId, leads.id))
      .where(
        and(
          eq(contactTasks.departmentId, departmentId),
          sql`${contactTasks.status} != 'completed'`
        )
      )
      .orderBy(asc(contactTasks.dueDate));

    return results.map(r => ({
      id: r.id,
      leadId: r.leadId,
      partnershipId: null,  // Lead tasks don't have partnership associations
      title: r.title,
      titleAr: r.titleAr,
      description: r.description,
      descriptionAr: r.descriptionAr,
      status: r.status,
      priority: r.priority,
      departmentId: r.departmentId,
      dueDate: r.dueDate,
      completedAt: r.completedAt,
      eventDepartmentId: r.eventDepartmentId,
      notificationEmails: r.notificationEmails,
      createdByUserId: r.createdByUserId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      contact: r.contactName ? { id: r.leadId!, name: r.contactName, status: r.contactStatus || 'active' } : undefined,
    }));
  }

  async createContactTask(data: InsertContactTask): Promise<ContactTask> {
    const [task] = await db
      .insert(contactTasks)
      .values(data)
      .returning();
    return task;
  }

  async updateContactTask(id: number, data: UpdateContactTask): Promise<ContactTask | undefined> {
    // If marking as completed, set completedAt
    if (data.status === 'completed' && !data.completedAt) {
      data.completedAt = new Date();
    }
    
    const [updated] = await db
      .update(contactTasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contactTasks.id, id))
      .returning();
    return updated;
  }

  async deleteContactTask(id: number): Promise<boolean> {
    await db
      .delete(contactTasks)
      .where(eq(contactTasks.id, id));
    return true;
  }

  // Enhanced contact task methods for stakeholder dashboard integration
  async getContactTasksForDashboard(departmentId: number): Promise<any[]> {
    const tasksWithDetails = await db
      .select({
        id: contactTasks.id,
        leadId: contactTasks.leadId,
        title: contactTasks.title,
        titleAr: contactTasks.titleAr,
        description: contactTasks.description,
        descriptionAr: contactTasks.descriptionAr,
        status: contactTasks.status,
        priority: contactTasks.priority,
        dueDate: contactTasks.dueDate,
        departmentId: contactTasks.departmentId,
        completedAt: contactTasks.completedAt,
        notificationEmails: contactTasks.notificationEmails,
        createdAt: contactTasks.createdAt,
        updatedAt: contactTasks.updatedAt,
        contactName: leads.name,
        contactStatus: leads.status,
      })
      .from(contactTasks)
      .leftJoin(leads, eq(contactTasks.leadId, leads.id))
      .where(eq(contactTasks.departmentId, departmentId))
      .orderBy(desc(contactTasks.createdAt));

    // Add comment count for each task
    const tasksWithComments = await Promise.all(
      tasksWithDetails.map(async (task) => {
        const [commentCountResult] = await db
          .select({ count: count() })
          .from(contactTaskComments)
          .where(eq(contactTaskComments.taskId, task.id));
        
        return {
          ...task,
          commentCount: Number(commentCountResult?.count || 0),
          contact: task.contactName ? {
            id: task.leadId,
            name: task.contactName,
            status: task.contactStatus,
          } : null,
        };
      })
    );

    return tasksWithComments;
  }

  async getContactTaskWithDetails(id: number): Promise<any> {
    const [task] = await db
      .select({
        id: contactTasks.id,
        leadId: contactTasks.leadId,
        title: contactTasks.title,
        titleAr: contactTasks.titleAr,
        description: contactTasks.description,
        descriptionAr: contactTasks.descriptionAr,
        status: contactTasks.status,
        priority: contactTasks.priority,
        dueDate: contactTasks.dueDate,
        departmentId: contactTasks.departmentId,
        completedAt: contactTasks.completedAt,
        notificationEmails: contactTasks.notificationEmails,
        createdAt: contactTasks.createdAt,
        updatedAt: contactTasks.updatedAt,
        contactName: leads.name,
        contactStatus: leads.status,
        departmentName: departments.name,
      })
      .from(contactTasks)
      .leftJoin(leads, eq(contactTasks.leadId, leads.id))
      .leftJoin(departments, eq(contactTasks.departmentId, departments.id))
      .where(eq(contactTasks.id, id));

    if (!task) return undefined;

    // Get comment count
    const [commentCountResult] = await db
      .select({ count: count() })
      .from(contactTaskComments)
      .where(eq(contactTaskComments.taskId, id));

    return {
      ...task,
      commentCount: Number(commentCountResult?.count || 0),
      contact: task.contactName ? {
        id: task.leadId,
        name: task.contactName,
        status: task.contactStatus,
      } : null,
      department: task.departmentName ? {
        id: task.departmentId,
        name: task.departmentName,
      } : null,
    };
  }

  // Contact Task Comment operations
  async getContactTaskComments(contactTaskId: number): Promise<any[]> {
    const commentsRaw = await db
      .select({
        id: contactTaskComments.id,
        contactTaskId: contactTaskComments.taskId,
        authorUserId: contactTaskComments.authorUserId,
        body: contactTaskComments.body,
        createdAt: contactTaskComments.createdAt,
        authorUsername: users.username,
      })
      .from(contactTaskComments)
      .leftJoin(users, eq(contactTaskComments.authorUserId, users.id))
      .where(eq(contactTaskComments.taskId, contactTaskId))
      .orderBy(asc(contactTaskComments.createdAt));

    // Fetch attachments for each comment
    const commentsWithAttachments = await Promise.all(
      commentsRaw.map(async (comment) => {
        const attachments = await db
          .select()
          .from(contactTaskCommentAttachments)
          .where(eq(contactTaskCommentAttachments.commentId, comment.id));
        
        return {
          ...comment,
          attachments,
        };
      })
    );

    return commentsWithAttachments;
  }

  async createContactTaskComment(data: { contactTaskId: number; authorUserId?: number; body: string }): Promise<any> {
    const [comment] = await db
      .insert(contactTaskComments)
      .values({
        taskId: data.contactTaskId,
        authorUserId: data.authorUserId || null,
        body: data.body,
      })
      .returning();
    return comment;
  }

  async deleteContactTaskComment(id: number): Promise<boolean> {
    await db
      .delete(contactTaskComments)
      .where(eq(contactTaskComments.id, id));
    return true;
  }

  // Contact Task Comment Attachment operations
  async createContactTaskCommentAttachment(data: { 
    commentId: number; 
    fileName: string; 
    storedFileName: string; 
    fileSize: number; 
    mimeType: string; 
    uploadedByUserId?: number 
  }): Promise<any> {
    const [attachment] = await db
      .insert(contactTaskCommentAttachments)
      .values({
        commentId: data.commentId,
        fileName: data.fileName,
        storedFileName: data.storedFileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        uploadedByUserId: data.uploadedByUserId || null,
      })
      .returning();
    return attachment;
  }

  async getContactTaskCommentAttachment(id: number): Promise<any> {
    const [attachment] = await db
      .select()
      .from(contactTaskCommentAttachments)
      .where(eq(contactTaskCommentAttachments.id, id));
    return attachment;
  }

  async deleteContactTaskCommentAttachment(id: number): Promise<boolean> {
    await db
      .delete(contactTaskCommentAttachments)
      .where(eq(contactTaskCommentAttachments.id, id));
    return true;
  }

  // ==================== Interaction Attachment Operations ====================
  
  async getInteractionAttachments(interactionId: number, entityType: 'lead' | 'partnership'): Promise<InteractionAttachment[]> {
    const condition = entityType === 'lead' 
      ? eq(interactionAttachments.leadInteractionId, interactionId)
      : eq(interactionAttachments.partnershipInteractionId, interactionId);
    
    return db
      .select()
      .from(interactionAttachments)
      .where(condition)
      .orderBy(desc(interactionAttachments.uploadedAt));
  }

  async getInteractionAttachment(id: number): Promise<InteractionAttachment | undefined> {
    const [attachment] = await db
      .select()
      .from(interactionAttachments)
      .where(eq(interactionAttachments.id, id));
    return attachment;
  }

  async createInteractionAttachment(data: InsertInteractionAttachment): Promise<InteractionAttachment> {
    const [attachment] = await db
      .insert(interactionAttachments)
      .values(data)
      .returning();
    return attachment;
  }

  async deleteInteractionAttachment(id: number): Promise<{ objectKey: string } | null> {
    // First get the attachment to return the objectKey for MinIO deletion
    const [attachment] = await db
      .select({ objectKey: interactionAttachments.objectKey })
      .from(interactionAttachments)
      .where(eq(interactionAttachments.id, id));
    
    if (!attachment) return null;
    
    await db
      .delete(interactionAttachments)
      .where(eq(interactionAttachments.id, id));
    
    return { objectKey: attachment.objectKey };
  }
}

// Export storage instance
export const storage = new DatabaseStorage();
