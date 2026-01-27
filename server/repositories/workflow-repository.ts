/**
 * Workflow Repository (MSSQL version)
 * Handles task workflows and prerequisites
 */
import { BaseRepository } from './base';
import { 
  taskTemplatePrerequisites, eventWorkflows, workflowTasks, tasks, eventDepartments, departments, events,
  departmentRequirements,
  type TaskTemplatePrerequisite, type InsertTaskTemplatePrerequisite,
  type EventWorkflow, type InsertEventWorkflow,
  type WorkflowTask, type InsertWorkflowTask,
  type Task, type Department, type Event, type DepartmentRequirement
} from '@shared/schema.mssql';
import { eq, and, asc, desc, sql } from 'drizzle-orm';

export class WorkflowRepository extends BaseRepository {

  /* ---------------------------------------------------------
   * TASK TEMPLATE PREREQUISITES
   * --------------------------------------------------------- */

  async getTaskTemplatePrerequisites(taskTemplateId: number) {
    return this.db
      .select()
      .from(taskTemplatePrerequisites)
      .where(eq(taskTemplatePrerequisites.taskTemplateId, taskTemplateId));
  }

  async getAllPrerequisitesForTemplate(taskTemplateId: number) {
    const visited = new Set<number>();
    const prerequisites: DepartmentRequirement[] = [];

    const collect = async (templateId: number) => {
      if (visited.has(templateId)) return;
      visited.add(templateId);

      const rows = await this.db
        .select({ requirement: departmentRequirements })
        .from(taskTemplatePrerequisites)
        .innerJoin(
          departmentRequirements,
          eq(taskTemplatePrerequisites.prerequisiteTemplateId, departmentRequirements.id)
        )
        .where(eq(taskTemplatePrerequisites.taskTemplateId, templateId));

      for (const { requirement } of rows) {
        if (!prerequisites.some(p => p.id === requirement.id)) {
          prerequisites.push(requirement);
          await collect(requirement.id);
        }
      }
    };

    await collect(taskTemplateId);
    return prerequisites;
  }

  async getTaskTemplatesWithPrerequisites(
    departmentId: number,
    getDepartmentRequirements: (departmentId: number) => Promise<DepartmentRequirement[]>
  ) {
    const templates = await getDepartmentRequirements(departmentId);

    return Promise.all(
      templates.map(async (template) => {
        const prereqs = await this.db
          .select({ requirement: departmentRequirements })
          .from(taskTemplatePrerequisites)
          .innerJoin(
            departmentRequirements,
            eq(taskTemplatePrerequisites.prerequisiteTemplateId, departmentRequirements.id)
          )
          .where(eq(taskTemplatePrerequisites.taskTemplateId, template.id));

        return {
          ...template,
          prerequisites: prereqs.map((p: { requirement: any; }) => p.requirement),
        };
      })
    );
  }

  async createTaskTemplatePrerequisite(data: InsertTaskTemplatePrerequisite) {
    const [prereq] = await this.db.insert(taskTemplatePrerequisites).values(data).returning();
    return prereq;
  }

  async deleteTaskTemplatePrerequisite(taskTemplateId: number, prerequisiteTemplateId: number) {
    const result = await this.db
      .delete(taskTemplatePrerequisites)
      .where(and(
        eq(taskTemplatePrerequisites.taskTemplateId, taskTemplateId),
        eq(taskTemplatePrerequisites.prerequisiteTemplateId, prerequisiteTemplateId)
      ));

    return result.rowsAffected > 0;
  }

  async getAvailablePrerequisites(taskTemplateId: number) {
    const allTemplates = await this.db.select().from(departmentRequirements);

    const dependent = new Set<number>();

    const findDependents = async (id: number) => {
      const rows = await this.db
        .select()
        .from(taskTemplatePrerequisites)
        .where(eq(taskTemplatePrerequisites.prerequisiteTemplateId, id));

      for (const row of rows) {
        if (!dependent.has(row.taskTemplateId)) {
          dependent.add(row.taskTemplateId);
          await findDependents(row.taskTemplateId);
        }
      }
    };

    await findDependents(taskTemplateId);

    return allTemplates.filter((t: { id: number; }) => t.id !== taskTemplateId && !dependent.has(t.id));
  }

  /* ---------------------------------------------------------
   * EVENT WORKFLOWS
   * --------------------------------------------------------- */

  async getEventWorkflows(eventId: string) {
    return this.db
      .select()
      .from(eventWorkflows)
      .where(eq(eventWorkflows.eventId, eventId))
      .orderBy(desc(eventWorkflows.createdAt));
  }

  async getAllWorkflowsWithDetails() {
    const all = await this.db
      .select()
      .from(eventWorkflows)
      .orderBy(desc(eventWorkflows.createdAt));

    const workflows = [];

    for (const wf of all) {
      const wfWithTasks = await this.getWorkflowWithTasks(wf.id);
      if (!wfWithTasks) continue;

      const [event] = await this.db
        .select()
        .from(events)
        .where(eq(events.id, wf.eventId));

      if (event) {
        workflows.push({
          ...wfWithTasks,
          event,
        });
      }
    }

    return workflows;
  }

  async getWorkflow(workflowId: number) {
    const [workflow] = await this.db
      .select()
      .from(eventWorkflows)
      .where(eq(eventWorkflows.id, workflowId));

    return workflow;
  }

  async getWorkflowWithTasks(workflowId: number) {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) return undefined;

    const rows = await this.db
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
      tasks: rows.map((wt: { workflowTask: any; task: any; department: any; event: any; }) => ({
        ...wt.workflowTask,
        task: {
          ...wt.task,
          department: wt.department,
          event: wt.event,
        },
      })),
    };
  }

  async createEventWorkflow(data: InsertEventWorkflow) {
    const [workflow] = await this.db.insert(eventWorkflows).values(data).returning();
    return workflow;
  }

  async deleteEventWorkflow(workflowId: number) {
    const result = await this.db.delete(eventWorkflows).where(eq(eventWorkflows.id, workflowId));
    return result.rowsAffected > 0;
  }

  /* ---------------------------------------------------------
   * WORKFLOW TASKS
   * --------------------------------------------------------- */

  async getWorkflowTasks(workflowId: number) {
    return this.db
      .select()
      .from(workflowTasks)
      .where(eq(workflowTasks.workflowId, workflowId))
      .orderBy(asc(workflowTasks.orderIndex));
  }

  async addTaskToWorkflow(data: InsertWorkflowTask) {
    const [workflowTask] = await this.db.insert(workflowTasks).values(data).returning();
    return workflowTask;
  }

  async removeTaskFromWorkflow(workflowId: number, taskId: number) {
    const result = await this.db
      .delete(workflowTasks)
      .where(and(
        eq(workflowTasks.workflowId, workflowId),
        eq(workflowTasks.taskId, taskId)
      ));

    return result.rowsAffected > 0;
  }

  async getTaskWorkflow(taskId: number) {
    const [entry] = await this.db
      .select()
      .from(workflowTasks)
      .where(eq(workflowTasks.taskId, taskId));

    if (!entry) return undefined;

    const workflow = await this.getWorkflow(entry.workflowId);
    if (!workflow) return undefined;

    const allTasks = await this.getWorkflowTasks(workflow.id);
    return { ...workflow, tasks: allTasks };
  }

  /* ---------------------------------------------------------
   * WORKFLOW STATUS MANAGEMENT
   * --------------------------------------------------------- */

  async getWaitingTasksForPrerequisite(prerequisiteTaskId: number) {
    const rows = await this.db
      .select({ task: tasks })
      .from(workflowTasks)
      .innerJoin(tasks, eq(workflowTasks.taskId, tasks.id))
      .where(and(
        eq(workflowTasks.prerequisiteTaskId, prerequisiteTaskId),
        eq(tasks.status, 'waiting')
      ));

    return rows.map((r: { task: any; }) => r.task);
  }

  async activateWaitingTasks(prerequisiteTaskId: number) {
    const waiting = await this.getWaitingTasksForPrerequisite(prerequisiteTaskId);
    if (!waiting.length) return [];

    const activated: Task[] = [];

    for (const task of waiting) {
      const [wfEntry] = await this.db
        .select()
        .from(workflowTasks)
        .where(eq(workflowTasks.taskId, task.id));

      if (!wfEntry?.prerequisiteTaskId) continue;

      const [prereq] = await this.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, wfEntry.prerequisiteTaskId));

      if (prereq?.status === 'completed') {
        await this.db
          .update(tasks)
          .set({ status: 'pending', updatedAt: new Date() })
          .where(eq(tasks.id, task.id));

        const [updated] = await this.db
          .select()
          .from(tasks)
          .where(eq(tasks.id, task.id));

        if (updated) activated.push(updated);
      }
    }

    return activated;
  }

  /* ---------------------------------------------------------
   * DEPARTMENT WORKFLOW VISIBILITY
   * --------------------------------------------------------- */

  async getWorkflowsForDepartment(departmentId: number) {
    const workflowIds = await this.db
      .selectDistinct({ workflowId: workflowTasks.workflowId })
      .from(workflowTasks)
      .innerJoin(tasks, eq(workflowTasks.taskId, tasks.id))
      .innerJoin(eventDepartments, eq(tasks.eventDepartmentId, eventDepartments.id))
      .where(eq(eventDepartments.departmentId, departmentId));

    const workflows = [];

    for (const { workflowId } of workflowIds) {
      const wf = await this.getWorkflowWithTasks(workflowId);
      if (!wf) continue;

      const [event] = await this.db
        .select()
        .from(events)
        .where(eq(events.id, wf.eventId));

      if (event) {
        workflows.push({
          ...wf,
          event,
        });
      }
    }

    return workflows;
  }

  async canDepartmentViewWorkflow(departmentId: number, workflowId: number) {
    const rows = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(workflowTasks)
      .innerJoin(tasks, eq(workflowTasks.taskId, tasks.id))
      .innerJoin(eventDepartments, eq(tasks.eventDepartmentId, eventDepartments.id))
      .where(and(
        eq(workflowTasks.workflowId, workflowId),
        eq(eventDepartments.departmentId, departmentId)
      ));

    return rows[0]?.count > 0;
  }

  /* ---------------------------------------------------------
   * TASK DEPENDENCY CHECKS
   * --------------------------------------------------------- */

  async isTaskPrerequisiteForOthers(taskId: number) {
    const rows = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(workflowTasks)
      .where(eq(workflowTasks.prerequisiteTaskId, taskId));

    return rows[0]?.count > 0;
  }

  async getDependentTasks(taskId: number) {
    const rows = await this.db
      .select({ task: tasks })
      .from(workflowTasks)
      .innerJoin(tasks, eq(workflowTasks.taskId, tasks.id))
      .where(eq(workflowTasks.prerequisiteTaskId, taskId));

    return rows.map((r: { task: any; }) => r.task);
  }
}
