/**
 * Lead Repository
 * Handles lead management and contact tasks
 */
import { BaseRepository } from './base';
import { 
  leads, leadInteractions, contactTasks, contactTaskComments, contactTaskCommentAttachments,
  interactionAttachments, organizations, departments, users,
  type Lead, type InsertLead, type UpdateLead,
  type LeadInteraction, type InsertLeadInteraction, type UpdateLeadInteraction,
  type ContactTask, type InsertContactTask, type UpdateContactTask,
  type Organization, type Department,
  type InteractionAttachment, type InsertInteractionAttachment
} from '@shared/schema';
import { eq, and, or, like, desc, asc, sql, count } from 'drizzle-orm';

export class LeadRepository extends BaseRepository {
  // Lead operations
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

    const leadsList = await this.db
      .select()
      .from(leads)
      .where(whereClause)
      .orderBy(desc(leads.createdAt));

    const leadsWithCounts = await Promise.all(
      leadsList.map(async (lead) => {
        const [interactionResult] = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(leadInteractions)
          .where(eq(leadInteractions.leadId, lead.id));

        const [taskResult] = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(contactTasks)
          .where(eq(contactTasks.leadId, lead.id));

        const [pendingTaskResult] = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(contactTasks)
          .where(and(
            eq(contactTasks.leadId, lead.id),
            eq(contactTasks.status, 'pending')
          ));

        return {
          ...lead,
          interactionsCount: Number(interactionResult?.count || 0),
          tasksCount: Number(taskResult?.count || 0),
          pendingTasksCount: Number(pendingTaskResult?.count || 0),
        };
      })
    );

    return leadsWithCounts;
  }

  async getLead(id: number): Promise<Lead | undefined> {
    const [lead] = await this.db
      .select()
      .from(leads)
      .where(eq(leads.id, id))
      .limit(1);
    return lead;
  }

  async getLeadWithDetails(id: number): Promise<(Lead & { 
    organization?: Organization;
    interactionCount?: number;
    taskCount?: number;
  }) | undefined> {
    const [lead] = await this.db
      .select()
      .from(leads)
      .where(eq(leads.id, id))
      .limit(1);

    if (!lead) return undefined;

    let organization: Organization | undefined;

    if (lead.organizationId) {
      const [org] = await this.db
        .select()
        .from(organizations)
        .where(eq(organizations.id, lead.organizationId))
        .limit(1);
      organization = org;
    }

    const [interactionResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(leadInteractions)
      .where(eq(leadInteractions.leadId, id));

    const [taskResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(contactTasks)
      .where(eq(contactTasks.leadId, id));

    return {
      ...lead,
      organization,
      interactionCount: interactionResult.count,
      taskCount: taskResult.count,
    };
  }

  async createLead(data: InsertLead): Promise<Lead> {
    const [lead] = await this.db
      .insert(leads)
      .values(data)
      .returning();
    return lead;
  }

  async updateLead(id: number, data: UpdateLead): Promise<Lead | undefined> {
    const [updated] = await this.db
      .update(leads)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return updated;
  }

  async deleteLead(id: number): Promise<boolean> {
    await this.db.delete(leads).where(eq(leads.id, id));
    return true;
  }

  // Lead Interaction operations
  async getLeadInteractions(leadId: number): Promise<LeadInteraction[]> {
    return this.db
      .select()
      .from(leadInteractions)
      .where(eq(leadInteractions.leadId, leadId))
      .orderBy(desc(leadInteractions.interactionDate));
  }

  async getLeadInteraction(id: number): Promise<LeadInteraction | undefined> {
    const [interaction] = await this.db
      .select()
      .from(leadInteractions)
      .where(eq(leadInteractions.id, id))
      .limit(1);
    return interaction;
  }

  async createLeadInteraction(data: InsertLeadInteraction): Promise<LeadInteraction> {
    const [interaction] = await this.db
      .insert(leadInteractions)
      .values(data)
      .returning();

    await this.db
      .update(leads)
      .set({ updatedAt: new Date() })
      .where(eq(leads.id, data.leadId));

    return interaction;
  }

  async updateLeadInteraction(id: number, data: UpdateLeadInteraction): Promise<LeadInteraction | undefined> {
    const [updated] = await this.db
      .update(leadInteractions)
      .set(data)
      .where(eq(leadInteractions.id, id))
      .returning();
    return updated;
  }

  async deleteLeadInteraction(id: number): Promise<boolean> {
    await this.db
      .delete(leadInteractions)
      .where(eq(leadInteractions.id, id));
    return true;
  }

  // Contact Task operations
  async getContactTasks(leadId: number): Promise<ContactTask[]> {
    return this.db
      .select()
      .from(contactTasks)
      .where(eq(contactTasks.leadId, leadId))
      .orderBy(asc(contactTasks.dueDate));
  }

  async getContactTask(id: number): Promise<ContactTask | undefined> {
    const [task] = await this.db
      .select()
      .from(contactTasks)
      .where(eq(contactTasks.id, id))
      .limit(1);
    return task;
  }

  async getContactTaskWithDepartment(id: number, getDepartment: (id: number) => Promise<Department | undefined>): Promise<(ContactTask & { department?: Department }) | undefined> {
    const task = await this.getContactTask(id);
    if (!task) return undefined;

    let department: Department | undefined;
    if (task.departmentId) {
      department = await getDepartment(task.departmentId);
    }

    return { ...task, department };
  }

  async getContactTasksByDepartment(departmentId: number): Promise<(ContactTask & { contact?: { id: number; name: string; status: string } })[]> {
    const results = await this.db
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
      partnershipId: null,
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
    const [task] = await this.db
      .insert(contactTasks)
      .values(data)
      .returning();
    return task;
  }

  async updateContactTask(id: number, data: UpdateContactTask): Promise<ContactTask | undefined> {
    if (data.status === 'completed' && !data.completedAt) {
      data.completedAt = new Date();
    }
    
    const [updated] = await this.db
      .update(contactTasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contactTasks.id, id))
      .returning();
    return updated;
  }

  async deleteContactTask(id: number): Promise<boolean> {
    await this.db
      .delete(contactTasks)
      .where(eq(contactTasks.id, id));
    return true;
  }

  async getContactTasksForDashboard(departmentId: number): Promise<any[]> {
    const tasksWithDetails = await this.db
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

    const tasksWithComments = await Promise.all(
      tasksWithDetails.map(async (task) => {
        const [commentCountResult] = await this.db
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
    const [task] = await this.db
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

    const [commentCountResult] = await this.db
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
    const commentsRaw = await this.db
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

    const commentsWithAttachments = await Promise.all(
      commentsRaw.map(async (comment) => {
        const attachments = await this.db
          .select()
          .from(contactTaskCommentAttachments)
          .where(eq(contactTaskCommentAttachments.commentId, comment.id));
        
        return { ...comment, attachments };
      })
    );

    return commentsWithAttachments;
  }

  async createContactTaskComment(data: { contactTaskId: number; authorUserId?: number; body: string }): Promise<any> {
    const [comment] = await this.db
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
    await this.db
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
    const [attachment] = await this.db
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
    const [attachment] = await this.db
      .select()
      .from(contactTaskCommentAttachments)
      .where(eq(contactTaskCommentAttachments.id, id));
    return attachment;
  }

  async deleteContactTaskCommentAttachment(id: number): Promise<boolean> {
    await this.db
      .delete(contactTaskCommentAttachments)
      .where(eq(contactTaskCommentAttachments.id, id));
    return true;
  }

  // Interaction Attachment operations
  async getInteractionAttachments(interactionId: number, entityType: 'lead' | 'partnership'): Promise<InteractionAttachment[]> {
    const condition = entityType === 'lead' 
      ? eq(interactionAttachments.leadInteractionId, interactionId)
      : eq(interactionAttachments.partnershipInteractionId, interactionId);
    
    return this.db
      .select()
      .from(interactionAttachments)
      .where(condition)
      .orderBy(desc(interactionAttachments.uploadedAt));
  }

  async getInteractionAttachment(id: number): Promise<InteractionAttachment | undefined> {
    const [attachment] = await this.db
      .select()
      .from(interactionAttachments)
      .where(eq(interactionAttachments.id, id));
    return attachment;
  }

  async createInteractionAttachment(data: InsertInteractionAttachment): Promise<InteractionAttachment> {
    const [attachment] = await this.db
      .insert(interactionAttachments)
      .values(data)
      .returning();
    return attachment;
  }

  async deleteInteractionAttachment(id: number): Promise<{ objectKey: string } | null> {
    const [attachment] = await this.db
      .select({ objectKey: interactionAttachments.objectKey })
      .from(interactionAttachments)
      .where(eq(interactionAttachments.id, id));
    
    if (!attachment) return null;
    
    await this.db
      .delete(interactionAttachments)
      .where(eq(interactionAttachments.id, id));
    
    return { objectKey: attachment.objectKey };
  }
}
