/**
 * Lead Repository (MSSQL version)
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
} from '@shared/schema.mssql';
import { eq, and, or, like, desc, asc, sql, count, SQLWrapper } from 'drizzle-orm';

export class LeadRepository extends BaseRepository {

  /* ---------------------------------------------------------
   * LEADS
   * --------------------------------------------------------- */

  async getAllLeads(options?: {
    search?: string;
    type?: string;
    status?: string;
  }) {
    const conditions = [];

    if (options?.type) conditions.push(eq(leads.type, options.type));
    if (options?.status) conditions.push(eq(leads.status, options.status));
    if (options?.search) {
      const pattern = `%${options.search}%`;
      conditions.push(
        or(
          like(leads.name, pattern),
          like(leads.nameAr, pattern),
          like(leads.email, pattern),
          like(leads.phone, pattern)
        )
      );
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const leadsList = await this.db
      .select()
      .from(leads)
      .where(whereClause)
      .orderBy(desc(leads.createdAt));

    return Promise.all(
      leadsList.map(async (lead: { id: number | SQLWrapper<unknown>; }) => {
        const [interactionCount] = await this.db
          .select({ count: sql<number>`COUNT(*)` })
          .from(leadInteractions)
          .where(eq(leadInteractions.leadId, lead.id));

        const [taskCount] = await this.db
          .select({ count: sql<number>`COUNT(*)` })
          .from(contactTasks)
          .where(eq(contactTasks.leadId, lead.id));

        const [pendingCount] = await this.db
          .select({ count: sql<number>`COUNT(*)` })
          .from(contactTasks)
          .where(and(
            eq(contactTasks.leadId, lead.id),
            eq(contactTasks.status, 'pending')
          ));

        return {
          ...lead,
          interactionsCount: Number(interactionCount?.count || 0),
          tasksCount: Number(taskCount?.count || 0),
          pendingTasksCount: Number(pendingCount?.count || 0),
        };
      })
    );
  }

  async getLead(id: number) {
    const [lead] = await this.db.select().from(leads).where(eq(leads.id, id)).limit(1);
    return lead;
  }

  async getLeadWithDetails(id: number) {
    const [lead] = await this.db.select().from(leads).where(eq(leads.id, id)).limit(1);
    if (!lead) return undefined;

    let organization: Organization | undefined;
    if (lead.organizationId) {
      const [org] = await this.db.select().from(organizations).where(eq(organizations.id, lead.organizationId));
      organization = org;
    }

    const [interactionCount] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(leadInteractions)
      .where(eq(leadInteractions.leadId, id));

    const [taskCount] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(contactTasks)
      .where(eq(contactTasks.leadId, id));

    return {
      ...lead,
      organization,
      interactionCount: interactionCount.count,
      taskCount: taskCount.count,
    };
  }

  async createLead(data: InsertLead) {
    const [lead] = await this.db.insert(leads).values(data).returning();
    return lead;
  }

  async updateLead(id: number, data: UpdateLead) {
    await this.db
      .update(leads)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leads.id, id));

    const [updated] = await this.db.select().from(leads).where(eq(leads.id, id));
    return updated;
  }

  async deleteLead(id: number) {
    const result = await this.db.delete(leads).where(eq(leads.id, id));
    return result.rowsAffected > 0;
  }

  /* ---------------------------------------------------------
   * LEAD INTERACTIONS
   * --------------------------------------------------------- */

  async getLeadInteractions(leadId: number) {
    return this.db
      .select()
      .from(leadInteractions)
      .where(eq(leadInteractions.leadId, leadId))
      .orderBy(desc(leadInteractions.interactionDate));
  }

  async getLeadInteraction(id: number) {
    const [interaction] = await this.db
      .select()
      .from(leadInteractions)
      .where(eq(leadInteractions.id, id))
      .limit(1);

    return interaction;
  }

  async createLeadInteraction(data: InsertLeadInteraction) {
    const [interaction] = await this.db.insert(leadInteractions).values(data).returning();

    await this.db
      .update(leads)
      .set({ updatedAt: new Date() })
      .where(eq(leads.id, data.leadId));

    return interaction;
  }

  async updateLeadInteraction(id: number, data: UpdateLeadInteraction) {
    await this.db.update(leadInteractions).set(data).where(eq(leadInteractions.id, id));

    const [updated] = await this.db.select().from(leadInteractions).where(eq(leadInteractions.id, id));
    return updated;
  }

  async deleteLeadInteraction(id: number) {
    const result = await this.db.delete(leadInteractions).where(eq(leadInteractions.id, id));
    return result.rowsAffected > 0;
  }

  /* ---------------------------------------------------------
   * CONTACT TASKS
   * --------------------------------------------------------- */

  async getContactTasks(leadId: number) {
    return this.db
      .select()
      .from(contactTasks)
      .where(eq(contactTasks.leadId, leadId))
      .orderBy(asc(contactTasks.dueDate));
  }

  async getContactTask(id: number) {
    const [task] = await this.db.select().from(contactTasks).where(eq(contactTasks.id, id));
    return task;
  }

  async getContactTaskWithDepartment(id: number, getDepartment: (id: number) => Promise<Department | undefined>) {
    const task = await this.getContactTask(id);
    if (!task) return undefined;

    const department = task.departmentId ? await getDepartment(task.departmentId) : undefined;

    return { ...task, department };
  }

  async getContactTasksByDepartment(departmentId: number) {
    const rows = await this.db
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

    return rows.map((r: { contactName: any; leadId: any; contactStatus: any; }) => ({
      ...r,
      contact: r.contactName
        ? { id: r.leadId!, name: r.contactName, status: r.contactStatus || 'active' }
        : undefined,
    }));
  }

  async createContactTask(data: InsertContactTask) {
    const [task] = await this.db.insert(contactTasks).values(data).returning();
    return task;
  }

  async updateContactTask(id: number, data: UpdateContactTask) {
    if (data.status === 'completed' && !data.completedAt) {
      data.completedAt = new Date();
    }

    await this.db
      .update(contactTasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contactTasks.id, id));

    const [updated] = await this.db.select().from(contactTasks).where(eq(contactTasks.id, id));
    return updated;
  }

  async deleteContactTask(id: number) {
    const result = await this.db.delete(contactTasks).where(eq(contactTasks.id, id));
    return result.rowsAffected > 0;
  }

  async getContactTasksForDashboard(departmentId: number) {
    const tasks = await this.db
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

    return Promise.all(
      tasks.map(async (task: { id: number | SQLWrapper<unknown>; contactName: any; leadId: any; contactStatus: any; }) => {
        const [commentCount] = await this.db
          .select({ count: count() })
          .from(contactTaskComments)
          .where(eq(contactTaskComments.taskId, task.id));

        return {
          ...task,
          commentCount: Number(commentCount?.count || 0),
          contact: task.contactName
            ? { id: task.leadId, name: task.contactName, status: task.contactStatus }
            : null,
        };
      })
    );
  }

  async getContactTaskWithDetails(id: number) {
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

    const [commentCount] = await this.db
      .select({ count: count() })
      .from(contactTaskComments)
      .where(eq(contactTaskComments.taskId, id));

    return {
      ...task,
      commentCount: Number(commentCount?.count || 0),
      contact: task.contactName
        ? { id: task.leadId, name: task.contactName, status: task.contactStatus }
        : null,
      department: task.departmentName
        ? { id: task.departmentId, name: task.departmentName }
        : null,
    };
  }

  /* ---------------------------------------------------------
   * CONTACT TASK COMMENTS
   * --------------------------------------------------------- */

  async getContactTaskComments(contactTaskId: number) {
    const comments = await this.db
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

    return Promise.all(
      comments.map(async (comment: { id: number | SQLWrapper<unknown>; }) => {
        const attachments = await this.db
          .select()
          .from(contactTaskCommentAttachments)
          .where(eq(contactTaskCommentAttachments.commentId, comment.id));

        return { ...comment, attachments };
      })
    );
  }

  async createContactTaskComment(data: { contactTaskId: number; authorUserId?: number; body: string }) {
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

  async deleteContactTaskComment(id: number) {
    const result = await this.db.delete(contactTaskComments).where(eq(contactTaskComments.id, id));
    return result.rowsAffected > 0;
  }

  /* ---------------------------------------------------------
   * CONTACT TASK COMMENT ATTACHMENTS
   * --------------------------------------------------------- */

  async createContactTaskCommentAttachment(data: { 
    commentId: number; 
    fileName: string; 
    storedFileName: string; 
    fileSize: number; 
    mimeType: string; 
    uploadedByUserId?: number 
  }) {
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

  async getContactTaskCommentAttachment(id: number) {
    const [attachment] = await this.db
      .select()
      .from(contactTaskCommentAttachments)
      .where(eq(contactTaskCommentAttachments.id, id));

    return attachment;
  }

  async deleteContactTaskCommentAttachment(id: number) {
    const result = await this.db
      .delete(contactTaskCommentAttachments)
      .where(eq(contactTaskCommentAttachments.id, id));

    return result.rowsAffected > 0;
  }

  /* ---------------------------------------------------------
   * INTERACTION ATTACHMENTS
   * --------------------------------------------------------- */

  async getInteractionAttachments(interactionId: number, entityType: 'lead' | 'partnership') {
    const condition =
      entityType === 'lead'
        ? eq(interactionAttachments.leadInteractionId, interactionId)
        : eq(interactionAttachments.partnershipInteractionId, interactionId);

    return this.db
      .select()
      .from(interactionAttachments)
      .where(condition)
      .orderBy(desc(interactionAttachments.uploadedAt));
  }

  async getInteractionAttachment(id: number) {
    const [attachment] = await this.db
      .select()
      .from(interactionAttachments)
      .where(eq(interactionAttachments.id, id));

    return attachment;
  }

  async createInteractionAttachment(data: InsertInteractionAttachment) {
    const [attachment] = await this.db
      .insert(interactionAttachments)
      .values(data)
      .returning();

    return attachment;
  }

  async deleteInteractionAttachment(id: number) {
    const [attachment] = await this.db
      .select({ objectKey: interactionAttachments.objectKey })
      .from(interactionAttachments)
      .where(eq(interactionAttachments.id, id));

    if (!attachment) return null;

    await this.db.delete(interactionAttachments).where(eq(interactionAttachments.id, id));

    return { objectKey: attachment.objectKey };
  }
}
