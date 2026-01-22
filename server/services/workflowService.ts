/**
 * Workflow Service
 * 
 * Handles task workflow logic including:
 * - Prerequisite chain resolution
 * - Circular dependency detection
 * - Task creation with workflows
 * - Task completion and activation of dependent tasks
 * - Task deletion validation
 */

import { storage } from '../storage';
import type { 
  Task, 
  DepartmentRequirement, 
  EventWorkflow, 
  InsertTask,
  Department,
  Event,
} from '@shared/schema';

interface ResolvedTemplates {
  selectedTemplates: DepartmentRequirement[];
  requiredPrerequisites: DepartmentRequirement[];
  workflowChains: Array<{
    chain: DepartmentRequirement[];
    departmentIds: number[];
  }>;
  allTemplates: DepartmentRequirement[]; // Convenience array with both selected and prerequisites
}

interface WorkflowCreationResult {
  tasks: Task[];
  workflows: EventWorkflow[];
}

interface TaskActivationResult {
  activatedTasks: Task[];
  emailsQueued: number;
}

interface DeletionValidation {
  canDelete: boolean;
  reason?: string;
  dependentTasks?: Task[];
  requiresChainDeletion?: boolean;
}

export class WorkflowService {
  /**
   * Validate that adding a prerequisite won't create a circular dependency
   * Uses DFS to detect cycles
   */
  async validateNoCycle(taskTemplateId: number, prerequisiteTemplateId: number): Promise<boolean> {
    // Check if adding this prerequisite would create a cycle
    // A cycle exists if prerequisiteTemplateId can reach taskTemplateId through its own prerequisites
    const visited = new Set<number>();
    
    const canReach = async (fromId: number, targetId: number): Promise<boolean> => {
      if (fromId === targetId) return true;
      if (visited.has(fromId)) return false;
      
      visited.add(fromId);
      
      const prerequisites = await storage.getTaskTemplatePrerequisites(fromId);
      for (const prereq of prerequisites) {
        if (await canReach(prereq.prerequisiteTemplateId, targetId)) {
          return true;
        }
      }
      
      return false;
    };
    
    // Check if prerequisiteTemplateId can reach taskTemplateId (which would create a cycle)
    const wouldCreateCycle = await canReach(prerequisiteTemplateId, taskTemplateId);
    return !wouldCreateCycle;
  }

  /**
   * Resolve all prerequisites for selected task templates
   * Returns the full dependency tree including transitive prerequisites
   */
  async resolvePrerequisiteChain(taskTemplateId: number): Promise<DepartmentRequirement[]> {
    return storage.getAllPrerequisitesForTemplate(taskTemplateId);
  }

  /**
   * Get all required task templates when selecting specific templates
   * Includes auto-added prerequisites and builds workflow chains
   */
  async getRequiredTaskTemplates(selectedTemplateIds: number[]): Promise<ResolvedTemplates> {
    const selectedTemplates: DepartmentRequirement[] = [];
    const requiredPrerequisites: DepartmentRequirement[] = [];
    const allTemplateIds = new Set<number>(selectedTemplateIds);
    
    // First, get all selected templates
    for (const templateId of selectedTemplateIds) {
      const template = await storage.getRequirementById(templateId);
      if (template) {
        selectedTemplates.push(template);
      }
    }
    
    // Then, recursively get all prerequisites
    for (const templateId of selectedTemplateIds) {
      const prereqs = await this.resolvePrerequisiteChain(templateId);
      for (const prereq of prereqs) {
        if (!allTemplateIds.has(prereq.id)) {
          allTemplateIds.add(prereq.id);
          requiredPrerequisites.push(prereq);
        }
      }
    }
    
    // Build workflow chains (groups of related tasks)
    const workflowChains = await this.buildWorkflowChains(selectedTemplateIds, requiredPrerequisites);
    
    // Combine all templates (selected + prerequisites) for frontend convenience
    const allTemplates = [...selectedTemplates, ...requiredPrerequisites];
    
    return {
      selectedTemplates,
      requiredPrerequisites,
      workflowChains,
      allTemplates, // All templates including selected and prerequisites
    };
  }

  /**
   * Build workflow chains from selected templates and their prerequisites
   */
  private async buildWorkflowChains(
    selectedTemplateIds: number[],
    prerequisites: DepartmentRequirement[]
  ): Promise<Array<{ chain: DepartmentRequirement[]; departmentIds: number[] }>> {
    const chains: Array<{ chain: DepartmentRequirement[]; departmentIds: number[] }> = [];
    const processedTemplates = new Set<number>();
    
    // For each selected template that has prerequisites, build a chain
    for (const templateId of selectedTemplateIds) {
      if (processedTemplates.has(templateId)) continue;
      
      const prereqs = await this.resolvePrerequisiteChain(templateId);
      if (prereqs.length === 0) continue;
      
      // Build the chain from root to leaf
      const chain: DepartmentRequirement[] = [];
      const departmentIds = new Set<number>();
      
      // Add prerequisites in order (root first)
      for (const prereq of prereqs.reverse()) {
        chain.push(prereq);
        departmentIds.add(prereq.departmentId);
        processedTemplates.add(prereq.id);
      }
      
      // Add the selected template at the end
      const allTemplates = [...prerequisites];
      for (const tid of selectedTemplateIds) {
        const template = allTemplates.find(t => t.id === tid);
        if (template && !chain.find(c => c.id === template.id)) {
          // Need to fetch the template
        }
      }
      
      processedTemplates.add(templateId);
      
      if (chain.length > 0) {
        chains.push({
          chain,
          departmentIds: Array.from(departmentIds),
        });
      }
    }
    
    return chains;
  }

  /**
   * Create tasks and workflows when adding task templates to an event
   * This creates tasks only for the specified department's templates,
   * but also creates workflows linking to prerequisite tasks from other departments
   */
  async createTasksWithWorkflows(
    eventId: string,
    eventDepartmentId: number,
    selectedTemplateIds: number[],
    createdByUserId: number
  ): Promise<WorkflowCreationResult> {
    const createdTasks: Task[] = [];
    const createdWorkflows: EventWorkflow[] = [];
    
    // Only process templates that belong to the department for this eventDepartmentId
    // Prerequisites from other departments should already exist (created when their dept was processed)
    
    // Get all templates to check department ownership
    const allTemplates = await this.getAllTemplates();
    
    // Get the eventDepartment to find the departmentId
    const eventDept = await storage.getEventDepartment(eventDepartmentId);
    if (!eventDept) {
      console.error(`EventDepartment ${eventDepartmentId} not found`);
      return { tasks: [], workflows: [] };
    }
    
    // Get the event to determine due dates
    const event = await storage.getEvent(eventId);
    if (!event) {
      console.error(`Event ${eventId} not found`);
      return { tasks: [], workflows: [] };
    }
    
    // Filter selected templates to only those belonging to this department
    const deptTemplateIds = selectedTemplateIds.filter(tid => {
      const template = allTemplates.find(t => t.id === tid);
      return template && template.departmentId === eventDept.departmentId;
    });
    
    // Create tasks for this department's templates
    for (const templateId of deptTemplateIds) {
      const template = allTemplates.find(t => t.id === templateId);
      if (!template) continue;
      
      // Check if this template has prerequisites
      const prereqs = await storage.getTaskTemplatePrerequisites(templateId);
      
      // Check if any prerequisites are not yet completed
      // Look for existing tasks in this event that match the prerequisite templates
      let hasWaitingPrereqs = false;
      
      for (const prereq of prereqs) {
        // Find if there's a task for this prerequisite in the event
        const prereqTemplate = allTemplates.find(t => t.id === prereq.prerequisiteTemplateId);
        if (!prereqTemplate) continue;
        
        // Get the eventDepartment for the prerequisite's department
        const prereqEventDept = await storage.getEventDepartmentByEventAndDepartment(
          eventId, 
          prereqTemplate.departmentId
        );
        
        if (prereqEventDept) {
          // Check if the prerequisite task exists and is not completed
          const prereqTasks = await storage.getTasksByEventDepartment(prereqEventDept.id);
          const prereqTask = prereqTasks.find(t => t.title === prereqTemplate.title);
          
          if (!prereqTask || prereqTask.status !== 'completed') {
            hasWaitingPrereqs = true;
            break;
          }
        } else {
          // Prerequisite department not assigned to this event - task is waiting
          hasWaitingPrereqs = true;
          break;
        }
      }
      
      // Determine due date based on template configuration
      const dueDateBasis = (template as any).dueDateBasis || 'event_end';
      const dueDate = dueDateBasis === 'event_start' ? event.startDate : event.endDate;
      
      // Create the task with appropriate status and due date
      const task = await storage.createTask({
        eventDepartmentId,
        title: template.title,
        titleAr: template.titleAr,
        description: template.description,
        descriptionAr: template.descriptionAr,
        status: hasWaitingPrereqs ? 'waiting' : 'pending',
        priority: 'medium',
        notificationEmails: template.notificationEmails || undefined,
        dueDate: dueDate,
        createdByUserId,
      });
      createdTasks.push(task);
      
      // If this task has prerequisites, create or update a workflow
      if (prereqs.length > 0) {
        // Try to find an existing workflow for this event that contains the prerequisite tasks
        let workflow = await this.findOrCreateWorkflowForTask(eventId, task, prereqs, allTemplates, createdByUserId);
        if (workflow && !createdWorkflows.find(w => w.id === workflow!.id)) {
          createdWorkflows.push(workflow);
        }
      }
    }
    
    return {
      tasks: createdTasks,
      workflows: createdWorkflows,
    };
  }
  
  /**
   * Find an existing workflow that contains prerequisite tasks, or create a new one
   */
  private async findOrCreateWorkflowForTask(
    eventId: string,
    task: Task,
    prereqs: { prerequisiteTemplateId: number }[],
    allTemplates: DepartmentRequirement[],
    createdByUserId: number
  ): Promise<EventWorkflow | null> {
    // Get existing workflows for this event
    const existingWorkflows = await storage.getEventWorkflows(eventId);
    
    // For each prerequisite, find the corresponding task in this event
    for (const prereq of prereqs) {
      const prereqTemplate = allTemplates.find(t => t.id === prereq.prerequisiteTemplateId);
      if (!prereqTemplate) continue;
      
      // Find the eventDepartment for the prerequisite's department
      const prereqEventDept = await storage.getEventDepartmentByEventAndDepartment(
        eventId,
        prereqTemplate.departmentId
      );
      if (!prereqEventDept) continue;
      
      // Find the prerequisite task
      const prereqTasks = await storage.getTasksByEventDepartment(prereqEventDept.id);
      const prereqTask = prereqTasks.find(t => t.title === prereqTemplate.title);
      if (!prereqTask) continue;
      
      // Check if this prereq task is already in a workflow
      for (const wf of existingWorkflows) {
        const workflowTasks = await storage.getWorkflowTasks(wf.id);
        if (workflowTasks.some(wt => wt.taskId === prereqTask.id)) {
          // Add the new task to this workflow
          const maxOrder = Math.max(...workflowTasks.map(wt => wt.orderIndex), 0);
          await storage.addTaskToWorkflow({
            workflowId: wf.id,
            taskId: task.id,
            prerequisiteTaskId: prereqTask.id,
            orderIndex: maxOrder + 1,
          });
          return wf;
        }
      }
      
      // No existing workflow found - create a new one
      const workflow = await storage.createEventWorkflow({
        eventId,
        createdByUserId,
      });
      
      // Add the prerequisite task first
      await storage.addTaskToWorkflow({
        workflowId: workflow.id,
        taskId: prereqTask.id,
        prerequisiteTaskId: null,
        orderIndex: 0,
      });
      
      // Add the dependent task
      await storage.addTaskToWorkflow({
        workflowId: workflow.id,
        taskId: task.id,
        prerequisiteTaskId: prereqTask.id,
        orderIndex: 1,
      });
      
      return workflow;
    }
    
    return null;
  }

  /**
   * Get all department requirement templates
   */
  private async getAllTemplates(): Promise<DepartmentRequirement[]> {
    // Get all departments first, then their requirements
    const allDepts = await storage.getAllDepartments();
    const allTemplates: DepartmentRequirement[] = [];
    
    for (const dept of allDepts) {
      const reqs = await storage.getDepartmentRequirements(dept.id);
      allTemplates.push(...reqs);
    }
    
    return allTemplates;
  }

  /**
   * Handle task completion - activate dependent tasks and queue notifications
   */
  async handleTaskCompletion(taskId: number): Promise<TaskActivationResult> {
    // Get the task to verify it's completed
    const task = await storage.getTask(taskId);
    if (!task || task.status !== 'completed') {
      return { activatedTasks: [], emailsQueued: 0 };
    }
    
    // Activate any waiting tasks that depend on this one
    const activatedTasks = await storage.activateWaitingTasks(taskId);
    
    // Return result - email sending will be handled by the caller
    return {
      activatedTasks,
      emailsQueued: activatedTasks.length,
    };
  }

  /**
   * Validate if a task can be deleted
   */
  async canDeleteTask(
    taskId: number, 
    userId: number, 
    userRole: string
  ): Promise<DeletionValidation> {
    const task = await storage.getTask(taskId);
    if (!task) {
      return { canDelete: false, reason: 'Task not found' };
    }
    
    // Check if this task is a prerequisite for others
    const isPrerequisite = await storage.isTaskPrerequisiteForOthers(taskId);
    
    if (!isPrerequisite) {
      return { canDelete: true };
    }
    
    // Get dependent tasks
    const dependentTasks = await storage.getDependentTasks(taskId);
    
    // Only superadmins can delete tasks that are prerequisites
    if (userRole !== 'superadmin') {
      return {
        canDelete: false,
        reason: 'This task is a prerequisite for other tasks. Only superadmins can delete it.',
        dependentTasks,
        requiresChainDeletion: true,
      };
    }
    
    // Superadmin can delete, but needs confirmation
    return {
      canDelete: true,
      reason: 'This task is a prerequisite for other tasks. Deleting will remove the entire chain.',
      dependentTasks,
      requiresChainDeletion: true,
    };
  }

  /**
   * Delete a task and optionally its dependent chain (superadmin only)
   */
  async deleteTaskWithChain(taskId: number, deleteChain: boolean): Promise<boolean> {
    if (deleteChain) {
      // Recursively delete all dependent tasks
      const dependentTasks = await storage.getDependentTasks(taskId);
      
      for (const depTask of dependentTasks) {
        await this.deleteTaskWithChain(depTask.id, true);
      }
    }
    
    // Delete the task
    return storage.deleteTask(taskId);
  }

  /**
   * Create workflows for an event after all tasks have been created
   * This should be called after all departments have been processed for an event
   */
  async createWorkflowsForEvent(eventId: string, createdByUserId: number): Promise<EventWorkflow[]> {
    const createdWorkflows: EventWorkflow[] = [];
    
    // Get all event departments for this event
    const eventDepartments = await storage.getEventDepartments(eventId);
    
    // Get all templates
    const allTemplates = await this.getAllTemplates();
    
    // For each event department, check all tasks for prerequisites
    for (const eventDept of eventDepartments) {
      const tasks = await storage.getTasksByEventDepartment(eventDept.id);
      
      for (const task of tasks) {
        // Find the template that matches this task (by title and department)
        const template = allTemplates.find(t => 
          t.title === task.title && t.departmentId === eventDept.departmentId
        );
        if (!template) continue;
        
        // Check if this template has prerequisites
        const prereqs = await storage.getTaskTemplatePrerequisites(template.id);
        if (prereqs.length === 0) continue;
        
        // Check if this task is already in a workflow
        const existingWorkflow = await storage.getTaskWorkflow(task.id);
        if (existingWorkflow) continue;
        
        // Try to create a workflow for this task
        const workflow = await this.findOrCreateWorkflowForTask(
          eventId, 
          task, 
          prereqs, 
          allTemplates, 
          createdByUserId
        );
        
        if (workflow && !createdWorkflows.find(w => w.id === workflow!.id)) {
          createdWorkflows.push(workflow);
        }
      }
    }
    
    return createdWorkflows;
  }

  /**
   * Get workflow details for display, including task status information
   */
  async getWorkflowDetails(workflowId: number): Promise<{
    workflow: EventWorkflow;
    event: Event;
    tasks: Array<{
      task: Task;
      department: Department;
      isActive: boolean;
      isWaiting: boolean;
      isCompleted: boolean;
      prerequisiteTask?: Task;
      dependentTasks: Task[];
    }>;
  } | null> {
    const workflowWithTasks = await storage.getWorkflowWithTasks(workflowId);
    if (!workflowWithTasks) return null;
    
    const event = await storage.getEvent(workflowWithTasks.eventId);
    if (!event) return null;
    
    const tasksWithDetails = await Promise.all(
      workflowWithTasks.tasks.map(async (wt) => {
        const prerequisiteTask = wt.prerequisiteTaskId 
          ? await storage.getTask(wt.prerequisiteTaskId) 
          : undefined;
        
        const dependentTasks = await storage.getDependentTasks(wt.task.id);
        
        return {
          task: wt.task,
          department: wt.task.department,
          isActive: wt.task.status === 'pending' || wt.task.status === 'in_progress',
          isWaiting: wt.task.status === 'waiting',
          isCompleted: wt.task.status === 'completed',
          prerequisiteTask: prerequisiteTask || undefined,
          dependentTasks,
        };
      })
    );
    
    return {
      workflow: workflowWithTasks,
      event,
      tasks: tasksWithDetails,
    };
  }
}

// Export singleton instance
export const workflowService = new WorkflowService();
