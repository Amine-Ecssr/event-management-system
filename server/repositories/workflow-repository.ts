/**
 * Workflow Repository
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
} from '@shared/schema';
import { eq, and, asc, desc, sql } from 'drizzle-orm';

export class WorkflowRepository extends BaseRepository {
  // Task Template Prerequisite operations
  async getTaskTemplatePrerequisites(taskTemplateId: number): Promise<TaskTemplatePrerequisite[]> {
    return await this.db
      .select()
      .from(taskTemplatePrerequisites)
      .where(eq(taskTemplatePrerequisites.taskTemplateId, taskTemplateId));
  }

  async getAllPrerequisitesForTemplate(taskTemplateId: number): Promise<DepartmentRequirement[]> {
    const visited = new Set<number>();
    const prerequisites: DepartmentRequirement[] = [];
    
    const collectPrerequisites = async (templateId: number) => {
      if (visited.has(templateId)) return;
      visited.add(templateId);
      
      const directPrereqs = await this.db
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

  async getTaskTemplatesWithPrerequisites(departmentId: number, getDepartmentRequirements: (departmentId: number) => Promise<DepartmentRequirement[]>): Promise<Array<DepartmentRequirement & { prerequisites: DepartmentRequirement[] }>> {
    const templates = await getDepartmentRequirements(departmentId);
    
    const templatesWithPrereqs = await Promise.all(
      templates.map(async (template) => {
        const prereqs = await this.db
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
    const [prereq] = await this.db.insert(taskTemplatePrerequisites).values(data).returning();
    return prereq;
  }

  async deleteTaskTemplatePrerequisite(taskTemplateId: number, prerequisiteTemplateId: number): Promise<boolean> {
    const result = await this.db
      .delete(taskTemplatePrerequisites)
      .where(and(
        eq(taskTemplatePrerequisites.taskTemplateId, taskTemplateId),
        eq(taskTemplatePrerequisites.prerequisiteTemplateId, prerequisiteTemplateId)
      ))
      .returning();
    return result.length > 0;
  }

  async getAvailablePrerequisites(taskTemplateId: number): Promise<DepartmentRequirement[]> {
    const allTemplates = await this.db.select().from(departmentRequirements);
    
    const dependentTemplates = new Set<number>();
    const findDependents = async (templateId: number) => {
      const dependents = await this.db
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
    
    return allTemplates.filter(
      t => t.id !== taskTemplateId && !dependentTemplates.has(t.id)
    );
  }

  // Event Workflow operations
  async getEventWorkflows(eventId: string): Promise<EventWorkflow[]> {
    return await this.db
      .select()
      .from(eventWorkflows)
      .where(eq(eventWorkflows.eventId, eventId))
      .orderBy(desc(eventWorkflows.createdAt));
  }

  async getAllWorkflowsWithDetails(): Promise<Array<EventWorkflow & { 
    tasks: Array<WorkflowTask & { task: Task & { department: Department; event: Event } }>;
    event: Event;
  }>> {
    // Get all workflows
    const allWorkflows = await this.db
      .select()
      .from(eventWorkflows)
      .orderBy(desc(eventWorkflows.createdAt));

    const workflows: Array<EventWorkflow & { 
      tasks: Array<WorkflowTask & { task: Task & { department: Department; event: Event } }>;
      event: Event;
    }> = [];

    for (const workflow of allWorkflows) {
      const workflowWithTasks = await this.getWorkflowWithTasks(workflow.id);
      if (workflowWithTasks) {
        const [event] = await this.db
          .select()
          .from(events)
          .where(eq(events.id, workflow.eventId))
          .limit(1);

        if (event) {
          workflows.push({
            ...workflowWithTasks,
            event,
          });
        }
      }
    }

    return workflows;
  }

  async getWorkflow(workflowId: number): Promise<EventWorkflow | undefined> {
    const [workflow] = await this.db
      .select()
      .from(eventWorkflows)
      .where(eq(eventWorkflows.id, workflowId))
      .limit(1);
    return workflow;
  }

  async getWorkflowWithTasks(workflowId: number): Promise<(EventWorkflow & { 
    tasks: Array<WorkflowTask & { task: Task & { department: Department; event: Event } }> 
  }) | undefined> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) return undefined;

    const workflowTasksData = await this.db
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
    const [workflow] = await this.db.insert(eventWorkflows).values(data).returning();
    return workflow;
  }

  async deleteEventWorkflow(workflowId: number): Promise<boolean> {
    const result = await this.db
      .delete(eventWorkflows)
      .where(eq(eventWorkflows.id, workflowId))
      .returning();
    return result.length > 0;
  }

  // Workflow Task operations
  async getWorkflowTasks(workflowId: number): Promise<WorkflowTask[]> {
    return await this.db
      .select()
      .from(workflowTasks)
      .where(eq(workflowTasks.workflowId, workflowId))
      .orderBy(asc(workflowTasks.orderIndex));
  }

  async addTaskToWorkflow(data: InsertWorkflowTask): Promise<WorkflowTask> {
    const [workflowTask] = await this.db.insert(workflowTasks).values(data).returning();
    return workflowTask;
  }

  async removeTaskFromWorkflow(workflowId: number, taskId: number): Promise<boolean> {
    const result = await this.db
      .delete(workflowTasks)
      .where(and(
        eq(workflowTasks.workflowId, workflowId),
        eq(workflowTasks.taskId, taskId)
      ))
      .returning();
    return result.length > 0;
  }

  async getTaskWorkflow(taskId: number): Promise<(EventWorkflow & { tasks: WorkflowTask[] }) | undefined> {
    const [workflowTaskEntry] = await this.db
      .select()
      .from(workflowTasks)
      .where(eq(workflowTasks.taskId, taskId))
      .limit(1);

    if (!workflowTaskEntry) return undefined;

    const workflow = await this.getWorkflow(workflowTaskEntry.workflowId);
    if (!workflow) return undefined;

    const allTasks = await this.getWorkflowTasks(workflow.id);
    return { ...workflow, tasks: allTasks };
  }

  // Workflow Status Management
  async getWaitingTasksForPrerequisite(prerequisiteTaskId: number): Promise<Task[]> {
    const waitingTasksData = await this.db
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
    const waitingTasks = await this.getWaitingTasksForPrerequisite(prerequisiteTaskId);
    
    if (waitingTasks.length === 0) return [];

    const activatedTasks: Task[] = [];
    for (const task of waitingTasks) {
      const taskWorkflowEntry = await this.db
        .select()
        .from(workflowTasks)
        .where(eq(workflowTasks.taskId, task.id))
        .limit(1);

      if (taskWorkflowEntry.length > 0 && taskWorkflowEntry[0].prerequisiteTaskId) {
        const [prereqTask] = await this.db
          .select()
          .from(tasks)
          .where(eq(tasks.id, taskWorkflowEntry[0].prerequisiteTaskId))
          .limit(1);

        if (prereqTask && prereqTask.status === 'completed') {
          const [updated] = await this.db
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
    const workflowIds = await this.db
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
        const [event] = await this.db
          .select()
          .from(events)
          .where(eq(events.id, workflow.eventId))
          .limit(1);

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
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(workflowTasks)
      .innerJoin(tasks, eq(workflowTasks.taskId, tasks.id))
      .innerJoin(eventDepartments, eq(tasks.eventDepartmentId, eventDepartments.id))
      .where(and(
        eq(workflowTasks.workflowId, workflowId),
        eq(eventDepartments.departmentId, departmentId)
      ));

    return result[0]?.count > 0;
  }

  // Task dependency checks
  async isTaskPrerequisiteForOthers(taskId: number): Promise<boolean> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(workflowTasks)
      .where(eq(workflowTasks.prerequisiteTaskId, taskId));

    return result[0]?.count > 0;
  }

  async getDependentTasks(taskId: number): Promise<Task[]> {
    const dependentTasksData = await this.db
      .select({ task: tasks })
      .from(workflowTasks)
      .innerJoin(tasks, eq(workflowTasks.taskId, tasks.id))
      .where(eq(workflowTasks.prerequisiteTaskId, taskId));

    return dependentTasksData.map(dt => dt.task);
  }
}
