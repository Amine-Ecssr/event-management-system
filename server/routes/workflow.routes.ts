/**
 * Workflow Routes
 *
 * API endpoints for workflow management including:
 * - Viewing all workflows
 * - Viewing workflows for a specific department
 * - Getting workflow details with tasks
 *
 * @module routes/workflow
 */

import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated, isAdminOrSuperAdmin } from "../auth";
import { isDepartmentScopedRole } from "./utils";
import type { User } from "@shared/schema.mssql";

const router = Router();

// ==================== Helper Functions ====================

/**
 * Check if user can access workflows (either admin/superadmin or has department account)
 */
async function canAccessWorkflows(user: User): Promise<boolean> {
  if (user.role === "admin" || user.role === "superadmin") return true;
  
  if (isDepartmentScopedRole(user.role)) {
    const account = await storage.getDepartmentAccountByUserId(user.id);
    return !!account;
  }
  
  return false;
}

// ==================== Workflow Endpoints ====================

// GET /api/workflows - Get all workflows (admin/superadmin only)
router.get("/api/workflows", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const workflows = await storage.getAllWorkflowsWithDetails();
    
    // Transform to match frontend expectations - flatten event data
    const transformedWorkflows = workflows.map(workflow => ({
      id: workflow.id,
      eventId: workflow.eventId,
      eventName: workflow.event?.name,
      eventNameAr: workflow.event?.nameAr,
      eventStartDate: workflow.event?.startDate,
      eventEndDate: workflow.event?.endDate,
      createdAt: workflow.createdAt,
      createdByUserId: workflow.createdByUserId,
      tasks: workflow.tasks.map(wt => ({
        id: wt.id,
        taskId: wt.taskId,
        title: wt.task.title,
        titleAr: wt.task.titleAr,
        description: wt.task.description,
        descriptionAr: wt.task.descriptionAr,
        status: wt.task.status,
        deadline: wt.task.dueDate,
        departmentId: wt.task.department.id,
        departmentName: wt.task.department.name,
        departmentNameAr: wt.task.department.nameAr,
        prerequisiteTaskId: wt.prerequisiteTaskId,
        orderIndex: wt.orderIndex,
        commentsCount: 0, // TODO: Add comment counts if needed
      })),
    }));
    
    res.json(transformedWorkflows);
  } catch (error) {
    console.error("Failed to get all workflows:", error);
    res.status(500).json({ error: "Failed to fetch workflows" });
  }
});

// GET /api/my-workflows - Get workflows for current user's department
router.get("/api/my-workflows", isAuthenticated, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const hasAccess = await canAccessWorkflows(req.user);
    if (!hasAccess) {
      return res.status(403).json({ error: "Forbidden: No department access" });
    }

    let workflows;
    
    // Admin/Superadmin get all workflows
    if (req.user.role === "admin" || req.user.role === "superadmin") {
      workflows = await storage.getAllWorkflowsWithDetails();
    } else {
      // Department users get their department's workflows
      const account = await storage.getDepartmentAccountByUserId(req.user.id);
      if (!account) {
        return res.status(403).json({ error: "Forbidden: No department account" });
      }
      workflows = await storage.getWorkflowsForDepartment(account.departmentId);
    }
    
    // Transform to match frontend expectations - flatten event data
    const transformedWorkflows = workflows.map(workflow => ({
      id: workflow.id,
      eventId: workflow.eventId,
      eventName: workflow.event?.name,
      eventNameAr: workflow.event?.nameAr,
      eventStartDate: workflow.event?.startDate,
      eventEndDate: workflow.event?.endDate,
      createdAt: workflow.createdAt,
      createdByUserId: workflow.createdByUserId,
      tasks: workflow.tasks.map(wt => ({
        id: wt.id,
        taskId: wt.taskId,
        title: wt.task.title,
        titleAr: wt.task.titleAr,
        description: wt.task.description,
        descriptionAr: wt.task.descriptionAr,
        status: wt.task.status,
        deadline: wt.task.dueDate,
        departmentId: wt.task.department.id,
        departmentName: wt.task.department.name,
        departmentNameAr: wt.task.department.nameAr,
        prerequisiteTaskId: wt.prerequisiteTaskId,
        orderIndex: wt.orderIndex,
        commentsCount: 0, // TODO: Add comment counts if needed
      })),
    }));
    
    res.json(transformedWorkflows);
  } catch (error) {
    console.error("Failed to get user workflows:", error);
    res.status(500).json({ error: "Failed to fetch workflows" });
  }
});

// GET /api/workflows/:workflowId - Get workflow details
router.get("/api/workflows/:workflowId", isAuthenticated, async (req, res) => {
  try {
    const workflowId = parseInt(req.params.workflowId);
    if (isNaN(workflowId)) {
      return res.status(400).json({ error: "Invalid workflow ID" });
    }

    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const workflow = await storage.getWorkflowWithTasks(workflowId);
    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    // Check access permissions
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      const account = await storage.getDepartmentAccountByUserId(req.user.id);
      if (!account) {
        return res.status(403).json({ error: "Forbidden: No department access" });
      }

      const canView = await storage.canDepartmentViewWorkflow(account.departmentId, workflowId);
      if (!canView) {
        return res.status(403).json({ error: "Forbidden: Cannot view this workflow" });
      }
    }

    // Fetch event details
    const event = await storage.getEvent(workflow.eventId);
    res.json({
      ...workflow,
      event,
    });
  } catch (error) {
    console.error("Failed to get workflow details:", error);
    res.status(500).json({ error: "Failed to fetch workflow details" });
  }
});

// GET /api/workflows/:workflowId/tasks - Get tasks in a workflow
router.get("/api/workflows/:workflowId/tasks", isAuthenticated, async (req, res) => {
  try {
    const workflowId = parseInt(req.params.workflowId);
    if (isNaN(workflowId)) {
      return res.status(400).json({ error: "Invalid workflow ID" });
    }

    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check access permissions
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      const account = await storage.getDepartmentAccountByUserId(req.user.id);
      if (!account) {
        return res.status(403).json({ error: "Forbidden: No department access" });
      }

      const canView = await storage.canDepartmentViewWorkflow(account.departmentId, workflowId);
      if (!canView) {
        return res.status(403).json({ error: "Forbidden: Cannot view this workflow" });
      }
    }

    const workflowTasks = await storage.getWorkflowTasks(workflowId);
    
    // Fetch full task details for each workflow task
    const tasksWithDetails = await Promise.all(
      workflowTasks.map(async (wt) => {
        const task = await storage.getTaskWithEventDepartment(wt.taskId);
        return {
          ...wt,
          task,
        };
      })
    );

    res.json(tasksWithDetails);
  } catch (error) {
    console.error("Failed to get workflow tasks:", error);
    res.status(500).json({ error: "Failed to fetch workflow tasks" });
  }
});

// GET /api/events/:eventId/workflows - Get workflows for an event
router.get("/api/events/:eventId/workflows", isAuthenticated, async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const workflows = await storage.getEventWorkflows(eventId);
    res.json(workflows);
  } catch (error) {
    console.error("Failed to get event workflows:", error);
    res.status(500).json({ error: "Failed to fetch event workflows" });
  }
});

// GET /api/departments/:departmentId/workflows - Get workflows for a department
router.get("/api/departments/:departmentId/workflows", isAuthenticated, async (req, res) => {
  try {
    const departmentId = parseInt(req.params.departmentId);
    if (isNaN(departmentId)) {
      return res.status(400).json({ error: "Invalid department ID" });
    }

    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check access permissions
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      const account = await storage.getDepartmentAccountByUserId(req.user.id);
      if (!account || account.departmentId !== departmentId) {
        return res.status(403).json({ error: "Forbidden: Cannot view this department's workflows" });
      }
    }

    const workflows = await storage.getWorkflowsForDepartment(departmentId);
    res.json(workflows);
  } catch (error) {
    console.error("Failed to get department workflows:", error);
    res.status(500).json({ error: "Failed to fetch department workflows" });
  }
});

export default router;
