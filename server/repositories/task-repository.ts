/**
 * Task Repository
 * Handles all task-related database operations
 */
import { BaseRepository } from './base';
import { 
  tasks, taskComments, taskCommentAttachments, eventDepartments, events, departments, users,
  leads, organizations,
  type Task, type InsertTask, type UpdateTask,
  type TaskComment, type InsertTaskComment,
  type TaskCommentAttachment, type InsertTaskCommentAttachment,
  type EventDepartment, type Event, type Department
} from '@shared/schema';
import { eq, and, sql, inArray, desc, asc } from 'drizzle-orm';

function parseDateOnly(dateValue: string | null): Date | null {
  if (!dateValue) return null;
  return new Date(`${dateValue}T00:00:00.000Z`);
}

export class TaskRepository extends BaseRepository {
  async getTasksByEventDepartment(eventDepartmentId: number): Promise<Task[]> {
    return await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.eventDepartmentId, eventDepartmentId))
      .orderBy(tasks.createdAt);
  }

  async createTask(data: InsertTask): Promise<Task> {
    const [task] = await this.db
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

    const [task] = await this.db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, taskId))
      .returning();
    return task || undefined;
  }

  async deleteTask(taskId: number): Promise<boolean> {
    const result = await this.db
      .delete(tasks)
      .where(eq(tasks.id, taskId))
      .returning();
    return result.length > 0;
  }

  async getTask(taskId: number): Promise<Task | undefined> {
    const [task] = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId));
    return task || undefined;
  }

  async getTaskWithEventDepartment(taskId: number): Promise<(Task & { eventDepartment: EventDepartment }) | undefined> {
    const results = await this.db
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

  // Task Comment operations
  async getTaskComments(taskId: number): Promise<Array<TaskComment & { authorUsername: string | null }>> {
    const results = await this.db
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
    const [comment] = await this.db
      .insert(taskComments)
      .values(data)
      .returning();
    return comment;
  }

  async deleteTaskComment(id: number): Promise<boolean> {
    await this.db
      .delete(taskComments)
      .where(eq(taskComments.id, id));
    return true;
  }

  // Task Comment Attachment operations
  async getTaskCommentAttachments(commentId: number): Promise<TaskCommentAttachment[]> {
    return await this.db
      .select()
      .from(taskCommentAttachments)
      .where(eq(taskCommentAttachments.commentId, commentId))
      .orderBy(taskCommentAttachments.uploadedAt);
  }

  async createTaskCommentAttachment(attachment: InsertTaskCommentAttachment): Promise<TaskCommentAttachment> {
    const [result] = await this.db
      .insert(taskCommentAttachments)
      .values(attachment)
      .returning();
    return result;
  }

  async deleteTaskCommentAttachment(id: number): Promise<void> {
    await this.db
      .delete(taskCommentAttachments)
      .where(eq(taskCommentAttachments.id, id));
  }

  async getAllTaskCommentAttachments(): Promise<Array<TaskCommentAttachment & { comment: TaskComment; task: Task }>> {
    const results = await this.db
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

  // Dashboard and reporting methods
  async getStakeholderDashboardData(
    departmentId: number,
    departmentRepo: { getDepartment(id: number): Promise<any> },
    eventRepo: { getEvent(id: string): Promise<any> }
  ): Promise<{
    stakeholder: Department;
    events: Array<{
      eventDepartment: EventDepartment;
      event: Event;
      tasks: Array<Task & { commentCount: number }>;
    }>;
  }> {
    // First fetch the stakeholder record
    const stakeholderData = await departmentRepo.getDepartment(departmentId);
    if (!stakeholderData) {
      throw new Error(`Stakeholder ${departmentId} not found`);
    }

    // Then fetch the events array
    const eventStakeholderRecords = await this.db
      .select()
      .from(eventDepartments)
      .where(eq(eventDepartments.departmentId, departmentId));

    const eventsArray = await Promise.all(
      eventStakeholderRecords.map(async (es) => {
        const event = await eventRepo.getEvent(es.eventId);
        if (!event) {
          throw new Error(`Event ${es.eventId} not found`);
        }
        const tasksList = await this.getTasksByEventDepartment(es.id);
        const taskIds = tasksList.map((task) => task.id);

        const commentCounts = taskIds.length === 0
          ? []
          : await this.db
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

  async getEventDepartmentsWithPendingTasks(
    departmentRepo: { getDepartment(id: number): Promise<any> },
    eventRepo: { getEvent(id: string): Promise<any> }
  ): Promise<Array<{
    eventDepartment: EventDepartment;
    stakeholder: Department;
    event: Event;
    tasks: Task[];
    primaryEmail: string;
  }>> {
    const allEventDepartments = await this.db
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
      const tasksList = await this.getTasksByEventDepartment(es.id);
      const incompleteTasks = tasksList.filter(
        t => t.status === 'pending' || t.status === 'in_progress'
      );

      if (incompleteTasks.length === 0) {
        continue;
      }

      const stakeholderData = await departmentRepo.getDepartment(es.departmentId);
      if (!stakeholderData) {
        continue;
      }

      const event = await eventRepo.getEvent(es.eventId);
      if (!event) {
        continue;
      }

      const primaryEmailRecord = stakeholderData.emails.find((e: any) => e.isPrimary);
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

  async getAllTasksForAdminDashboard(
    departmentRepo: { getDepartment(id: number): Promise<any>; getEventDepartment(id: number): Promise<EventDepartment | undefined> },
    eventRepo: { getEvent(id: string): Promise<any> }
  ): Promise<Array<{
    task: Task;
    eventDepartment?: EventDepartment;
    department: Department;
    event?: Event;
    contact?: { id: number; name: string; nameAr: string | null; status: string };
    partnership?: { id: number; nameEn: string; nameAr: string | null };
    taskType: 'event' | 'contact' | 'partnership';
  }>> {
    const allTasks = await this.db
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
      if (task.eventDepartmentId) {
        const eventStakeholder = await departmentRepo.getEventDepartment(task.eventDepartmentId);
        if (!eventStakeholder) {
          continue;
        }

        const stakeholderData = await departmentRepo.getDepartment(eventStakeholder.departmentId);
        if (!stakeholderData) {
          continue;
        }

        const event = await eventRepo.getEvent(eventStakeholder.eventId);
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
      } else if (task.leadId) {
        const [contactData] = await this.db
          .select()
          .from(leads)
          .where(eq(leads.id, task.leadId))
          .limit(1);
        
        if (!contactData) {
          continue;
        }

        let departmentData: Department | undefined;
        if (task.departmentId) {
          departmentData = await departmentRepo.getDepartment(task.departmentId);
        }
        
        if (!departmentData) {
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
      } else if (task.partnershipId) {
        const [orgData] = await this.db
          .select()
          .from(organizations)
          .where(eq(organizations.id, task.partnershipId))
          .limit(1);
        
        if (!orgData) {
          continue;
        }

        let departmentData: Department | undefined;
        if (task.departmentId) {
          departmentData = await departmentRepo.getDepartment(task.departmentId);
        }
        
        if (!departmentData) {
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
    departmentIds?: number[]
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

    const pendingTasks = await this.db
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

  // Partnership Task operations
  async getPartnershipTasks(partnershipId: number): Promise<Task[]> {
    return this.db
      .select()
      .from(tasks)
      .where(eq(tasks.partnershipId, partnershipId))
      .orderBy(asc(tasks.dueDate));
  }

  async createPartnershipTask(data: InsertTask): Promise<Task> {
    const [task] = await this.db
      .insert(tasks)
      .values(data)
      .returning();
    return task;
  }
}
