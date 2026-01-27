/**
 * Shared Types for Repository Layer
 * Re-exports types from schema for convenience and adds repository-specific types
 */

// Re-export all types from schema
export type {
  User, InsertUser,
  Event, InsertEvent,
  Category, InsertCategory,
  Settings,
  ReminderQueue, InsertReminderQueue,
  Department, InsertDepartment,
  DepartmentEmail, InsertDepartmentEmail,
  DepartmentRequirement, InsertDepartmentRequirement,
  EventDepartment, InsertEventDepartment,
  DepartmentAccount, InsertDepartmentAccount,
  AuthIdentity, InsertAuthIdentity,
  Task, InsertTask, UpdateTask,
  TaskComment, InsertTaskComment,
  TaskCommentAttachment, InsertTaskCommentAttachment,
  Update, InsertUpdate,
  ArchivedEvent, InsertArchivedEvent, UpdateArchivedEvent,
  ArchiveMedia, InsertArchiveMedia,
  EventMedia, InsertEventMedia,
  Organization, InsertOrganization,
  Position, InsertPosition,
  PartnershipType, InsertPartnershipType,
  AgreementType, InsertAgreementType,
  Country,
  Contact, InsertContact, UpdateContact,
  EventSpeaker, InsertEventSpeaker, UpdateEventSpeaker,
  ArchivedEventSpeaker, InsertArchivedEventSpeaker,
  EventAttendee, InsertEventAttendee,
  EventInvitee, InsertEventInvitee, UpdateEventInvitee,
  EmailTemplate,
  EventCustomEmail, InsertEventCustomEmail, UpdateEventCustomEmail,
  InvitationEmailJob, InsertInvitationEmailJob,
  TaskTemplatePrerequisite, InsertTaskTemplatePrerequisite,
  EventWorkflow, InsertEventWorkflow,
  WorkflowTask, InsertWorkflowTask,
  PartnershipAgreement, InsertPartnershipAgreement, UpdatePartnershipAgreement,
  PartnershipActivity, InsertPartnershipActivity, UpdatePartnershipActivity,
  PartnershipContact, InsertPartnershipContact, UpdatePartnershipContact,
  PartnershipComment, InsertPartnershipComment, UpdatePartnershipComment,
  AgreementAttachment, InsertAgreementAttachment,
  Lead, InsertLead, UpdateLead,
  LeadInteraction, InsertLeadInteraction, UpdateLeadInteraction,
  ContactTask, InsertContactTask, UpdateContactTask,
  ContactTaskComment, InsertContactTaskComment,
  ContactTaskCommentAttachment, InsertContactTaskCommentAttachment,
  PartnershipInteraction, InsertPartnershipInteraction, UpdatePartnershipInteraction,
  InteractionAttachment, InsertInteractionAttachment,
} from '@shared/schema.mssql';

// Import for IStorage interface
import type { SettingsUpdate } from '../services/configService';
import type { UpdateWithDepartment } from '../updates-formatter';
import type session from 'express-session';

// Re-export for convenience
export type { SettingsUpdate, UpdateWithDepartment };

// Import types for IStorage interface
import type {
  User, Event, Category, ReminderQueue, Department, DepartmentEmail, DepartmentRequirement,
  EventDepartment, DepartmentAccount, AuthIdentity, Task, TaskComment, TaskCommentAttachment,
  Update, ArchivedEvent, ArchiveMedia, EventMedia, Organization, Position, PartnershipType,
  AgreementType, Country, Contact, EventSpeaker, ArchivedEventSpeaker, EventAttendee,
  EventInvitee, EmailTemplate, EventCustomEmail, TaskTemplatePrerequisite, EventWorkflow,
  WorkflowTask, PartnershipAgreement, PartnershipActivity, PartnershipContact, PartnershipComment,
  AgreementAttachment, Lead, LeadInteraction, ContactTask, PartnershipInteraction,
  InteractionAttachment,
  InsertUser, InsertEvent, InsertCategory, InsertReminderQueue, InsertDepartment, InsertDepartmentEmail,
  InsertDepartmentRequirement, InsertEventDepartment, InsertDepartmentAccount, InsertAuthIdentity,
  InsertTask, UpdateTask, InsertTaskComment, InsertTaskCommentAttachment, InsertUpdate,
  InsertArchivedEvent, UpdateArchivedEvent, InsertArchiveMedia, InsertEventMedia, InsertOrganization,
  InsertPosition, InsertPartnershipType, InsertAgreementType, InsertContact, UpdateContact,
  InsertEventSpeaker, UpdateEventSpeaker, InsertArchivedEventSpeaker, InsertEventAttendee,
  InsertEventInvitee, UpdateEventInvitee, InsertEventCustomEmail, UpdateEventCustomEmail,
  InsertTaskTemplatePrerequisite, InsertEventWorkflow, InsertWorkflowTask, InsertPartnershipAgreement,
  UpdatePartnershipAgreement, InsertPartnershipActivity, UpdatePartnershipActivity, InsertPartnershipContact,
  UpdatePartnershipContact, InsertPartnershipComment, UpdatePartnershipComment, InsertAgreementAttachment,
  InsertLead, UpdateLead, InsertLeadInteraction, UpdateLeadInteraction, InsertContactTask,
  UpdateContactTask, InsertPartnershipInteraction, UpdatePartnershipInteraction, InsertInteractionAttachment,
} from '@shared/schema.mssql';

/**
 * IStorage Interface
 * Complete interface defining all storage operations
 * Used by DatabaseStorage facade for backward compatibility
 */
export interface IStorage {
  // Session store for authentication
  sessionStore: session.Store;
  
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(id: number, hashedPassword: string): Promise<void>;
  updateUserRole(id: number, role: 'admin' | 'superadmin' | 'department' | 'department_admin' | 'staff' | 'event_lead' | 'viewer'): Promise<void>;
  deleteUser(id: number): Promise<boolean>;
  
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
  
  // Settings operations
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
  resetReminderForResend(id: number, scheduledFor: Date): Promise<ReminderQueue | undefined>;
  
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
  getEventDepartment(eventDepartmentId: number): Promise<EventDepartment | undefined>;
  
  // Department account operations
  getDepartmentAccountByUserId(userId: number): Promise<DepartmentAccount | undefined>;
  updateDepartmentAccountLastLogin(userId: number): Promise<void>;
  getAllDepartmentAccounts(): Promise<Array<DepartmentAccount & { departmentName: string, username: string, primaryEmail: string }>>;
  getDepartmentAccountByDepartmentId(departmentId: number): Promise<DepartmentAccount | undefined>;
  createDepartmentAccount(data: InsertDepartmentAccount): Promise<DepartmentAccount>;
  deleteDepartmentAccount(id: number): Promise<boolean>;
  createAuthIdentity(data: InsertAuthIdentity): Promise<AuthIdentity>;
  
  // Task operations
  getTasksByEventDepartment(eventDepartmentId: number): Promise<Task[]>;
  createTask(data: InsertTask): Promise<Task>;
  updateTask(taskId: number, data: UpdateTask): Promise<Task | undefined>;
  deleteTask(taskId: number): Promise<boolean>;
  getTask(taskId: number): Promise<Task | undefined>;
  getTaskWithEventDepartment(taskId: number): Promise<(Task & { eventDepartment: EventDepartment }) | undefined>;
  getTaskComments(taskId: number): Promise<Array<TaskComment & { authorUsername: string | null }>>;
  createTaskComment(data: InsertTaskComment): Promise<TaskComment>;
  deleteTaskComment(id: number): Promise<boolean>;
  getTaskCommentAttachments(commentId: number): Promise<TaskCommentAttachment[]>;
  createTaskCommentAttachment(attachment: InsertTaskCommentAttachment): Promise<TaskCommentAttachment>;
  deleteTaskCommentAttachment(id: number): Promise<void>;
  getAllTaskCommentAttachments(): Promise<Array<TaskCommentAttachment & { comment: TaskComment; task: Task }>>;
  getStakeholderDashboardData(departmentId: number): Promise<any>;
  getEventDepartmentsWithPendingTasks(): Promise<any[]>;
  updateEventDepartmentLastReminder(id: number): Promise<void>;
  getAllTasksForAdminDashboard(): Promise<any[]>;
  getPendingTasksByRange(rangeStart: Date, rangeEnd: Date, departmentIds?: number[]): Promise<any[]>;
  
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
  createUserFromKeycloak(data: { username: string; email: string; keycloakId: string; role: 'superadmin' | 'admin' | 'department' | 'department_admin' }): Promise<User>;
  updateUserFromKeycloak(userId: number, data: { role?: 'superadmin' | 'admin' | 'department' | 'department_admin'; email?: string; keycloakId?: string }): Promise<User>;
  getUsersByDepartmentName(departmentName: string): Promise<User[]>;
  getUserDepartments(userId: number): Promise<Department[]>;
  linkUserToDepartment(userId: number, departmentId: number, primaryEmailId: number): Promise<DepartmentAccount>;
  getOrCreateDepartmentByName(name: string, keycloakGroupId?: string): Promise<Department>;
  getDepartmentByKeycloakGroupId(keycloakGroupId: string): Promise<Department | undefined>;
  
  // Archive operations
  getAllArchivedEvents(options?: any): Promise<{ events: ArchivedEvent[]; total: number; page: number; limit: number }>;
  getArchivedEvent(id: number): Promise<ArchivedEvent | undefined>;
  getArchivedEventByOriginalId(eventId: string): Promise<ArchivedEvent | undefined>;
  createArchivedEvent(data: InsertArchivedEvent): Promise<ArchivedEvent>;
  updateArchivedEvent(id: number, data: UpdateArchivedEvent): Promise<ArchivedEvent | undefined>;
  deleteArchivedEvent(id: number): Promise<boolean>;
  getArchivedEventsByYear(year: number): Promise<ArchivedEvent[]>;
  getArchivedEventsByCategory(categoryId: number): Promise<ArchivedEvent[]>;
  searchArchivedEvents(query: string): Promise<ArchivedEvent[]>;
  getArchiveStats(): Promise<any>;
  getArchiveTimeline(): Promise<any[]>;
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

  // Organization operations
  getAllOrganizations(): Promise<Array<Organization & { country?: Country }>>;
  getOrganization(id: number): Promise<(Organization & { country?: Country }) | undefined>;
  createOrganization(data: InsertOrganization): Promise<Organization>;
  updateOrganization(id: number, data: Partial<InsertOrganization>): Promise<Organization | undefined>;
  deleteOrganization(id: number): Promise<boolean>;
  getOrganizationByName(nameEn: string): Promise<Organization | undefined>;
  
  // Position operations
  getAllPositions(): Promise<Position[]>;
  getPosition(id: number): Promise<Position | undefined>;
  createPosition(data: InsertPosition): Promise<Position>;
  updatePosition(id: number, data: Partial<InsertPosition>): Promise<Position | undefined>;
  deletePosition(id: number): Promise<boolean>;
  getPositionByName(nameEn: string): Promise<Position | undefined>;
  
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
  
  // Country operations
  getAllCountries(): Promise<Country[]>;
  getCountry(id: number): Promise<Country | undefined>;
  getCountryByCode(code: string): Promise<Country | undefined>;
  
  // Contact operations
  getAllContacts(options?: any): Promise<any>;
  getGroupedContacts(options: any): Promise<any>;
  getContact(id: number): Promise<any>;
  getContactByEmail(email: string): Promise<Contact | undefined>;
  getContactByName(nameEn: string, organizationId?: number | null): Promise<Contact | undefined>;
  getEligibleSpeakers(): Promise<any[]>;
  createContact(data: InsertContact): Promise<Contact>;
  updateContact(id: number, data: UpdateContact): Promise<Contact | undefined>;
  deleteContact(id: number): Promise<boolean>;
  
  // Event Speaker operations
  getEventSpeakers(eventId: string): Promise<any[]>;
  addEventSpeaker(data: InsertEventSpeaker): Promise<EventSpeaker>;
  updateEventSpeaker(id: number, data: UpdateEventSpeaker): Promise<EventSpeaker | undefined>;
  removeEventSpeaker(id: number): Promise<boolean>;
  deleteEventSpeakers(eventId: string): Promise<boolean>;
  getContactEvents(leadId: number): Promise<{ events: Event[]; archivedEvents: ArchivedEvent[] }>;
  
  // Contact statistics
  getContactsStatistics(limit: number): Promise<any>;
  getOrganizationStatistics(options: any): Promise<any>;
  getEngagementAnalytics(): Promise<any>;
  
  // Event Attendee operations
  getEventAttendees(eventId: string): Promise<any[]>;
  addEventAttendee(data: InsertEventAttendee): Promise<EventAttendee>;
  removeEventAttendee(eventId: string, leadId: number): Promise<boolean>;
  getContactAttendedEvents(leadId: number): Promise<Event[]>;
  
  // Event Invitee operations
  getEventInvitees(eventId: string): Promise<any[]>;
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
  
  // Task Workflow operations
  getTaskTemplatePrerequisites(taskTemplateId: number): Promise<TaskTemplatePrerequisite[]>;
  getAllPrerequisitesForTemplate(taskTemplateId: number): Promise<DepartmentRequirement[]>;
  getTaskTemplatesWithPrerequisites(departmentId: number): Promise<any[]>;
  createTaskTemplatePrerequisite(data: InsertTaskTemplatePrerequisite): Promise<TaskTemplatePrerequisite>;
  deleteTaskTemplatePrerequisite(taskTemplateId: number, prerequisiteTemplateId: number): Promise<boolean>;
  getAvailablePrerequisites(taskTemplateId: number): Promise<DepartmentRequirement[]>;
  getEventWorkflows(eventId: string): Promise<EventWorkflow[]>;
  getWorkflow(workflowId: number): Promise<EventWorkflow | undefined>;
  getWorkflowWithTasks(workflowId: number): Promise<any>;
  createEventWorkflow(data: InsertEventWorkflow): Promise<EventWorkflow>;
  deleteEventWorkflow(workflowId: number): Promise<boolean>;
  getWorkflowTasks(workflowId: number): Promise<WorkflowTask[]>;
  addTaskToWorkflow(data: InsertWorkflowTask): Promise<WorkflowTask>;
  removeTaskFromWorkflow(workflowId: number, taskId: number): Promise<boolean>;
  getTaskWorkflow(taskId: number): Promise<any>;
  getWaitingTasksForPrerequisite(prerequisiteTaskId: number): Promise<Task[]>;
  activateWaitingTasks(prerequisiteTaskId: number): Promise<Task[]>;
  getWorkflowsForDepartment(departmentId: number): Promise<any[]>;
  canDepartmentViewWorkflow(departmentId: number, workflowId: number): Promise<boolean>;
  isTaskPrerequisiteForOthers(taskId: number): Promise<boolean>;
  getDependentTasks(taskId: number): Promise<Task[]>;
  
  // Partnership Management operations
  getAllPartners(options?: any): Promise<any>;
  updatePartnership(id: number, data: Partial<InsertOrganization>): Promise<Organization | undefined>;
  getPartnerStats(): Promise<any>;
  getPartnershipAgreements(organizationId: number): Promise<any[]>;
  getPartnershipAgreement(id: number): Promise<PartnershipAgreement | undefined>;
  createPartnershipAgreement(data: InsertPartnershipAgreement): Promise<PartnershipAgreement>;
  updatePartnershipAgreement(id: number, data: UpdatePartnershipAgreement): Promise<PartnershipAgreement | undefined>;
  deletePartnershipAgreement(id: number): Promise<boolean>;
  getPartnershipActivities(organizationId: number): Promise<any[]>;
  getPartnershipActivity(id: number): Promise<PartnershipActivity | undefined>;
  getActivitiesByEventId(eventId: string): Promise<any[]>;
  createPartnershipActivity(data: InsertPartnershipActivity): Promise<PartnershipActivity>;
  updatePartnershipActivity(id: number, data: UpdatePartnershipActivity): Promise<PartnershipActivity | undefined>;
  deletePartnershipActivity(id: number): Promise<boolean>;
  getPartnerEvents(organizationId: number): Promise<Event[]>;
  getPartnershipContacts(organizationId: number): Promise<any[]>;
  addPartnershipContact(data: InsertPartnershipContact): Promise<PartnershipContact>;
  updatePartnershipContact(id: number, data: UpdatePartnershipContact): Promise<PartnershipContact | undefined>;
  removePartnershipContact(id: number): Promise<boolean>;
  getPartnershipComments(organizationId: number): Promise<any[]>;
  getPartnershipComment(id: number): Promise<PartnershipComment | undefined>;
  createPartnershipComment(data: InsertPartnershipComment): Promise<PartnershipComment>;
  updatePartnershipComment(id: number, data: UpdatePartnershipComment): Promise<PartnershipComment | undefined>;
  deletePartnershipComment(id: number): Promise<boolean>;
  getAgreementAttachments(agreementId: number): Promise<AgreementAttachment[]>;
  getAgreementAttachment(id: number): Promise<AgreementAttachment | undefined>;
  getAgreementAttachmentByObjectKey(objectKey: string): Promise<AgreementAttachment | undefined>;
  createAgreementAttachment(data: InsertAgreementAttachment): Promise<AgreementAttachment>;
  deleteAgreementAttachment(id: number): Promise<boolean>;
  getInactivePartnerships(thresholdDate: Date): Promise<any[]>;
  updatePartnershipLastActivity(organizationId: number, activityDate?: Date): Promise<void>;
  updatePartnershipInactivitySettings(organizationId: number, settings: any): Promise<Organization | undefined>;
  markInactivityNotificationSent(organizationId: number): Promise<void>;
  
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
  
  // Lead Management operations
  getAllLeads(options?: any): Promise<any[]>;
  getLead(id: number): Promise<Lead | undefined>;
  getLeadWithDetails(id: number): Promise<any>;
  createLead(data: InsertLead): Promise<Lead>;
  updateLead(id: number, data: UpdateLead): Promise<Lead | undefined>;
  deleteLead(id: number): Promise<boolean>;
  
  // Lead Interaction operations
  getLeadInteractions(leadId: number): Promise<LeadInteraction[]>;
  getLeadInteraction(id: number): Promise<LeadInteraction | undefined>;
  createLeadInteraction(data: InsertLeadInteraction): Promise<LeadInteraction>;
  updateLeadInteraction(id: number, data: UpdateLeadInteraction): Promise<LeadInteraction | undefined>;
  deleteLeadInteraction(id: number): Promise<boolean>;
  
  // Contact Task operations
  getContactTasks(leadId: number): Promise<ContactTask[]>;
  getContactTask(id: number): Promise<ContactTask | undefined>;
  getContactTaskWithDepartment(id: number): Promise<any>;
  getContactTasksByDepartment(departmentId: number): Promise<any[]>;
  getContactTasksForDashboard(departmentId: number): Promise<any[]>;
  getContactTaskWithDetails(id: number): Promise<any>;
  createContactTask(data: InsertContactTask): Promise<ContactTask>;
  updateContactTask(id: number, data: UpdateContactTask): Promise<ContactTask | undefined>;
  deleteContactTask(id: number): Promise<boolean>;
  
  // Contact Task Comment operations
  getContactTaskComments(contactTaskId: number): Promise<any[]>;
  createContactTaskComment(data: any): Promise<any>;
  deleteContactTaskComment(id: number): Promise<boolean>;
  
  // Contact Task Comment Attachment operations
  createContactTaskCommentAttachment(data: any): Promise<any>;
  getContactTaskCommentAttachment(id: number): Promise<any>;
  deleteContactTaskCommentAttachment(id: number): Promise<boolean>;
  
  // Interaction Attachment operations
  getInteractionAttachments(interactionId: number, entityType: 'lead' | 'partnership'): Promise<InteractionAttachment[]>;
  getInteractionAttachment(id: number): Promise<InteractionAttachment | undefined>;
  createInteractionAttachment(data: InsertInteractionAttachment): Promise<InteractionAttachment>;
  deleteInteractionAttachment(id: number): Promise<{ objectKey: string } | null>;
}
