/**
 * Task Routes
 *
 * API endpoints for task management including CRUD operations,
 * status updates, comments, attachments, and workflow operations.
 *
 * @module routes/task
 */

import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated, isAdminOrSuperAdmin, isSuperAdmin } from "../auth";
import {
  insertTaskSchema,
  updateTaskSchema,
  insertTaskCommentSchema,
  type User,
  taskComments,
  taskCommentAttachments,
} from "@shared/schema.mssql";
import { fromError } from "zod-validation-error";
import { isDepartmentScopedRole, isDepartmentOrStakeholderRole } from "./utils";
import { upload, deleteFile, getFilePath } from "../fileUpload";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { emailService } from "../email";
import { eventFileService } from "../services/eventFileService";
import { indexingService } from "../services/elasticsearch-indexing.service";
import fs from "fs";
import { startOfDay, startOfWeek, endOfWeek } from "date-fns";

const router = Router();

// ==================== Helper Functions ====================

/**
 * Resolve date range for pending tasks query
 */
function resolveRange(referenceDate?: string, range: "day" | "week" = "day") {
  const refDate = referenceDate
    ? new Date(`${referenceDate}T00:00:00.000Z`)
    : new Date();
  const start = startOfDay(refDate);
  if (range === "day") {
    return { start, end: start };
  }

  const weekStart = startOfWeek(start, { weekStartsOn: 1 });
  return { start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) };
}

/**
 * Check if user can access event department tasks
 */
async function canAccessEventDepartmentTasks(
  user: User,
  eventDepartmentId: number
): Promise<boolean> {
  if (user.role === "admin" || user.role === "superadmin") return true;

  if (isDepartmentScopedRole(user.role)) {
    const account = await storage.getDepartmentAccountByUserId(user.id);
    if (!account) return false;

    const eventDepartment = await storage.getEventDepartment(eventDepartmentId);
    if (!eventDepartment) return false;

    return eventDepartment.departmentId === account.departmentId;
  }

  return false;
}

/**
 * Check if user can ACCESS a task (read)
 * Allows direct department access or workflow membership access
 */
async function canAccessTask(user: User, taskId: number): Promise<boolean> {
  if (user.role === "admin" || user.role === "superadmin") return true;

  if (isDepartmentOrStakeholderRole(user.role)) {
    // First check if this is an event-based task or partnership task
    const task = await storage.getTask(taskId);
    if (!task) {
      console.log(`[canAccessTask] Task ${taskId} not found`);
      return false;
    }

    // Partnership tasks: check if task has a departmentId that matches user's department
    if (task.partnershipId) {
      const account = await storage.getDepartmentAccountByUserId(user.id);
      if (!account) {
        console.log(`[canAccessTask] No department account for user ${user.id}`);
        return false;
      }

      // Partnership tasks can be accessed by the assigned department or any admin
      if (task.departmentId === account.departmentId) {
        console.log(
          `[canAccessTask] Partnership task access granted - assigned to department ${account.departmentId}`
        );
        return true;
      }

      console.log(
        `[canAccessTask] Partnership task access denied - not assigned to user's department`
      );
      return false;
    }

    // Event-based tasks: use existing logic
    const taskWithES = await storage.getTaskWithEventDepartment(taskId);
    if (!taskWithES) {
      console.log(
        `[canAccessTask] Event task ${taskId} not found or has no event department`
      );
      return false;
    }

    const account = await storage.getDepartmentAccountByUserId(user.id);
    if (!account) {
      console.log(`[canAccessTask] No department account for user ${user.id}`);
      return false;
    }

    console.log(
      `[canAccessTask] User ${user.id} (dept ${account.departmentId}) accessing task ${taskId} (task dept: ${taskWithES.eventDepartment.departmentId})`
    );

    // Direct access: task belongs to user's department
    if (taskWithES.eventDepartment.departmentId === account.departmentId) {
      console.log(`[canAccessTask] Direct access granted - same department`);
      return true;
    }

    // Workflow access: task is part of a workflow where user's department has tasks
    // This gives read-only access to related tasks in the same workflow
    const taskWorkflow = await storage.getTaskWorkflow(taskId);
    console.log(
      `[canAccessTask] Task workflow:`,
      taskWorkflow
        ? { id: taskWorkflow.id, taskCount: taskWorkflow.tasks.length }
        : null
    );
    if (taskWorkflow) {
      const canViewWorkflow = await storage.canDepartmentViewWorkflow(
        account.departmentId,
        taskWorkflow.id
      );
      console.log(
        `[canAccessTask] canDepartmentViewWorkflow(${account.departmentId}, ${taskWorkflow.id}) = ${canViewWorkflow}`
      );
      if (canViewWorkflow) {
        return true; // Read-only access through workflow membership
      }
    }

    console.log(`[canAccessTask] Access denied - no direct or workflow access`);
    return false;
  }

  return false;
}

/**
 * Check if user can MODIFY a task (more restrictive - only direct ownership)
 */
async function canModifyTask(user: User, taskId: number): Promise<boolean> {
  if (user.role === "admin" || user.role === "superadmin") return true;

  if (isDepartmentOrStakeholderRole(user.role)) {
    // First check if this is an event-based task or partnership task
    const task = await storage.getTask(taskId);
    if (!task) return false;

    const account = await storage.getDepartmentAccountByUserId(user.id);
    if (!account) return false;

    // Partnership tasks: check if task has a departmentId that matches user's department
    if (task.partnershipId) {
      return task.departmentId === account.departmentId;
    }

    // Event-based tasks: use existing logic
    const taskWithES = await storage.getTaskWithEventDepartment(taskId);
    if (!taskWithES) return false;

    // Only direct ownership allows modification
    return taskWithES.eventDepartment.departmentId === account.departmentId;
  }

  return false;
}

/**
 * Check if user can access a comment
 */
async function canAccessComment(user: User, commentId: number): Promise<boolean> {
  if (user.role === "admin" || user.role === "superadmin") return true;

  if (isDepartmentOrStakeholderRole(user.role)) {
    const [comment] = await db
      .select()
      .from(taskComments)
      .where(eq(taskComments.id, commentId));
    if (!comment) return false;

    return await canAccessTask(user, comment.taskId);
  }

  return false;
}

// ==================== Pending Tasks Routes ====================

// GET /api/tasks/pending-range - Pending tasks filtered by range (day/week)
router.get("/api/tasks/pending-range", isAuthenticated, async (req, res) => {
  try {
    const querySchema = z.object({
      range: z.enum(["day", "week"]).default("day"),
      referenceDate: z.string().optional(),
    });

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: fromError(parsed.error).toString() });
    }

    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { start, end } = resolveRange(
      parsed.data.referenceDate,
      parsed.data.range
    );

    let departmentIds: number[] | undefined;
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      const account = await storage.getDepartmentAccountByUserId(req.user.id);
      if (!account) {
        return res.status(403).json({
          error: "Forbidden: You can only view tasks for your department",
        });
      }
      departmentIds = [account.departmentId];
    }

    const pendingTasks = await storage.getPendingTasksByRange(
      start,
      end,
      departmentIds
    );

    res.json({
      rangeStart: start.toISOString(),
      rangeEnd: end.toISOString(),
      timezone: "UTC",
      rules: {
        dueDateFallback:
          "Tasks without dueDate fall back to the associated event start date.",
        overlappingEvents:
          "If an event spans the selected range, tasks without due dates count on the first in-range day.",
        timezone:
          "Date-only comparisons are anchored to UTC midnight to avoid timezone drift.",
      },
      departments: pendingTasks,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch pending tasks" });
  }
});

// ==================== Admin Task Routes ====================

// GET /api/admin/tasks - Get all tasks for admin dashboard (admin/superadmin only)
router.get("/api/admin/tasks", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const tasksData = await storage.getAllTasksForAdminDashboard();
    res.json(tasksData);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch admin dashboard tasks" });
  }
});

// GET /api/admin/event-stakeholders - Get all event-stakeholder pairs for task assignment (admin/superadmin only)
router.get("/api/admin/event-stakeholders", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const eventStakeholders = await storage.getAllEventDepartmentsForAdmin();
    res.json(eventStakeholders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch event-stakeholder assignments" });
  }
});

// POST /api/admin/event-stakeholders - Ensure event-stakeholder pair exists (create if missing)
router.post("/api/admin/event-stakeholders", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { eventId, departmentId } = req.body as {
      eventId?: string;
      departmentId?: number;
    };

    if (!eventId || !departmentId || isNaN(Number(departmentId))) {
      return res.status(400).json({ error: "Invalid event or department" });
    }

    const event = await storage.getEvent(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const department = await storage.getDepartment(Number(departmentId));
    if (!department) {
      return res.status(404).json({ error: "Department not found" });
    }

    const existing = await storage.getEventDepartmentByEventAndDepartment(
      eventId,
      Number(departmentId)
    );
    const assignment =
      existing ||
      (await storage.createEventDepartment({
        eventId,
        departmentId: Number(departmentId),
      }));

    const { emails: _emails, requirements: _requirements, ...departmentData } =
      department;

    res.status(existing ? 200 : 201).json({
      ...assignment,
      event,
      department: departmentData,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to ensure event-stakeholder assignment" });
  }
});

// ==================== Event Department Task Routes ====================

// GET /api/event-departments/:eventDepartmentId/tasks (Authenticated users)
router.get(
  "/api/event-departments/:eventDepartmentId/tasks",
  isAuthenticated,
  async (req, res) => {
    try {
      const eventDepartmentId = parseInt(req.params.eventDepartmentId);
      if (isNaN(eventDepartmentId)) {
        return res.status(400).json({ error: "Invalid event stakeholder ID" });
      }

      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const hasAccess = await canAccessEventDepartmentTasks(
        req.user,
        eventDepartmentId
      );
      if (!hasAccess) {
        return res
          .status(403)
          .json({ error: "Forbidden: You can only view your own tasks" });
      }

      const tasks = await storage.getTasksByEventDepartment(eventDepartmentId);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  }
);

// POST /api/event-departments/:eventDepartmentId/tasks (admin/superadmin only)
router.post(
  "/api/event-departments/:eventDepartmentId/tasks",
  isAdminOrSuperAdmin,
  async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const eventDepartmentId = parseInt(req.params.eventDepartmentId);
      if (isNaN(eventDepartmentId)) {
        return res.status(400).json({ error: "Invalid event stakeholder ID" });
      }

      // Verify event department exists
      const eventDepartment =
        await storage.getEventDepartment(eventDepartmentId);
      if (!eventDepartment) {
        return res
          .status(404)
          .json({ error: "Event stakeholder assignment not found" });
      }

      const result = insertTaskSchema.safeParse({
        ...req.body,
        eventDepartmentId,
        createdByUserId: req.user.id,
      });

      if (!result.success) {
        return res.status(400).json({
          error: fromError(result.error).toString(),
        });
      }

      const task = await storage.createTask(result.data);

      // Index task to Elasticsearch (non-blocking)
      indexingService.indexTask(task).catch(err => {
        console.warn("[ES] Failed to index new task:", err?.message || err);
      });

      res.status(201).json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to create task" });
    }
  }
);

// ==================== Task CRUD Routes ====================

// GET /api/tasks/:taskId (Authenticated users - returns task with event and department info)
router.get("/api/tasks/:taskId", isAuthenticated, async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    if (isNaN(taskId)) {
      return res.status(400).json({ error: "Invalid task ID" });
    }

    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const hasAccess = await canAccessTask(req.user, taskId);
    if (!hasAccess) {
      return res
        .status(403)
        .json({ error: "Forbidden: You don't have access to this task" });
    }

    const taskWithED = await storage.getTaskWithEventDepartment(taskId);
    if (!taskWithED) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Get event info
    const event = await storage.getEvent(taskWithED.eventDepartment.eventId);

    // Get department info
    const department = await storage.getDepartment(
      taskWithED.eventDepartment.departmentId
    );

    // Get comment count
    const comments = await storage.getTaskComments(taskId);

    res.json({
      ...taskWithED,
      event: event
        ? {
            id: event.id,
            name: event.name,
            nameAr: event.nameAr,
            startDate: event.startDate,
            endDate: event.endDate,
          }
        : null,
      department: department
        ? {
            id: department.id,
            name: department.name,
            nameAr: department.nameAr,
          }
        : null,
      commentCount: comments.length,
    });
  } catch (error) {
    console.error("Error fetching task:", error);
    res.status(500).json({ error: "Failed to fetch task" });
  }
});

// PATCH /api/tasks/:taskId (Authenticated users with proper authorization)
router.patch("/api/tasks/:taskId", isAuthenticated, async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    if (isNaN(taskId)) {
      return res.status(400).json({ error: "Invalid task ID" });
    }

    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Use canModifyTask for write operations (more restrictive than canAccessTask)
    const hasAccess = await canModifyTask(req.user, taskId);
    if (!hasAccess) {
      return res
        .status(403)
        .json({ error: "Forbidden: You can only update your own tasks" });
    }

    const result = updateTaskSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: fromError(result.error).toString(),
      });
    }

    // Check if trying to change status from 'waiting' - only workflow can do that
    const existingTask = await storage.getTask(taskId);
    if (
      existingTask?.status === "waiting" &&
      result.data.status &&
      result.data.status !== "waiting"
    ) {
      // Check if all prerequisites are completed
      const taskWorkflow = await storage.getTaskWorkflow(taskId);
      if (taskWorkflow) {
        const workflowTask = taskWorkflow.tasks.find(
          (wt) => wt.taskId === taskId
        );
        if (workflowTask?.prerequisiteTaskId) {
          const prereqTask = await storage.getTask(
            workflowTask.prerequisiteTaskId
          );
          if (prereqTask && prereqTask.status !== "completed") {
            return res.status(400).json({
              error:
                "Cannot change status from 'waiting'. Prerequisite task must be completed first.",
            });
          }
        }
      }
    }

    const task = await storage.updateTask(taskId, result.data);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Send notification email if task status changed to 'completed' and has notification emails
    if (
      result.data.status === "completed" &&
      task.notificationEmails &&
      task.notificationEmails.length > 0
    ) {
      try {
        // Get task with event department details
        const taskWithDetails = await storage.getTaskWithEventDepartment(taskId);
        if (taskWithDetails) {
          const { eventDepartment } = taskWithDetails;

          // Get event details
          const event = await storage.getEvent(eventDepartment.eventId);

          // Get department details
          const stakeholder = await storage.getDepartment(
            eventDepartment.departmentId
          );

          // Get settings
          const settings = await storage.getSettings();

          if (
            event &&
            stakeholder &&
            settings.emailEnabled &&
            settings.emailFromEmail
          ) {
            // Send notification email
            await emailService.sendTaskCompletionNotification({
              taskTitle: task.title,
              taskDescription: task.description,
              eventName: event.name,
              eventStartDate: event.startDate,
              eventEndDate: event.endDate,
              completedByStakeholder: stakeholder.name,
              recipients: task.notificationEmails,
              ccList: stakeholder.ccList ? [stakeholder.ccList] : undefined,
              settings,
            });

            console.log(
              `Task completion notification sent for task "${task.title}" to ${task.notificationEmails.join(", ")}`
            );
          }
        }
      } catch (emailError) {
        // Log error but don't fail the request
        console.error("Failed to send task completion notification:", emailError);
      }
    }

    // Handle workflow task activation when task is completed
    if (result.data.status === "completed") {
      try {
        const { workflowService } = await import("../services/workflowService");
        const activationResult = await workflowService.handleTaskCompletion(taskId);

        // Send activation emails for dependent tasks
        if (activationResult.activatedTasks.length > 0) {
          const settings = await storage.getSettings();

          for (const activatedTask of activationResult.activatedTasks) {
            try {
              const taskWithDetails = await storage.getTaskWithEventDepartment(
                activatedTask.id
              );
              if (taskWithDetails && activatedTask.notificationEmails?.length) {
                const { eventDepartment } = taskWithDetails;
                const event = await storage.getEvent(eventDepartment.eventId);
                const stakeholder = await storage.getDepartment(
                  eventDepartment.departmentId
                );
                const completedStakeholder = await storage.getDepartment(
                  (await storage.getTaskWithEventDepartment(taskId))
                    ?.eventDepartment.departmentId || 0
                );

                if (
                  event &&
                  stakeholder &&
                  settings.emailEnabled &&
                  settings.emailFromEmail
                ) {
                  await emailService.sendTaskActivatedNotification({
                    taskTitle: activatedTask.title,
                    taskDescription: activatedTask.description,
                    eventName: event.name,
                    completedPrerequisiteTask: task.title,
                    completedByDepartment: completedStakeholder?.name || "Unknown",
                    recipients: activatedTask.notificationEmails,
                    settings,
                  });

                  console.log(
                    `Task activation notification sent for task "${activatedTask.title}"`
                  );
                }
              }
            } catch (activationEmailError) {
              console.error(
                "Failed to send task activation notification:",
                activationEmailError
              );
            }
          }
        }
      } catch (workflowError) {
        console.error("Failed to handle workflow activation:", workflowError);
      }
    }

    // Re-index task to Elasticsearch (non-blocking)
    indexingService.indexTask(task).catch(err => {
      console.warn("[ES] Failed to re-index updated task:", err?.message || err);
    });

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: "Failed to update task" });
  }
});

// DELETE /api/tasks/:taskId (admin/superadmin only)
router.delete("/api/tasks/:taskId", isAdminOrSuperAdmin, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const taskId = parseInt(req.params.taskId);
    if (isNaN(taskId)) {
      return res.status(400).json({ error: "Invalid task ID" });
    }

    // Check if task is part of a workflow and has dependent tasks
    const { workflowService } = await import("../services/workflowService");
    const deletionCheck = await workflowService.canDeleteTask(
      taskId,
      req.user.id,
      req.user.role
    );

    if (!deletionCheck.canDelete) {
      return res.status(403).json({
        error: deletionCheck.reason,
        dependentTasks: deletionCheck.dependentTasks,
        requiresChainDeletion: deletionCheck.requiresChainDeletion,
      });
    }

    // If requires chain deletion (superadmin confirmed), check for query param
    const deleteChain = req.query.deleteChain === "true";
    if (deletionCheck.requiresChainDeletion && !deleteChain) {
      return res.status(400).json({
        error:
          "This task has dependent tasks. Add ?deleteChain=true to delete the entire chain.",
        dependentTasks: deletionCheck.dependentTasks,
        requiresChainDeletion: true,
      });
    }

    const deleted = deleteChain
      ? await workflowService.deleteTaskWithChain(taskId, true)
      : await storage.deleteTask(taskId);

    if (!deleted) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Delete task from Elasticsearch (non-blocking)
    indexingService.deleteDocument('tasks', String(taskId)).catch(err => {
      console.warn("[ES] Failed to delete task from index:", err?.message || err);
    });

    res.json({
      message: deleteChain
        ? "Task chain deleted successfully"
        : "Task deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// ==================== Task Comment Routes ====================

// GET /api/tasks/:taskId/comments (Authenticated users)
router.get("/api/tasks/:taskId/comments", isAuthenticated, async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    if (isNaN(taskId)) {
      return res.status(400).json({ error: "Invalid task ID" });
    }

    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const hasAccess = await canAccessTask(req.user, taskId);
    if (!hasAccess) {
      return res
        .status(403)
        .json({ error: "Forbidden: You can only view comments for your own tasks" });
    }

    const comments = await storage.getTaskComments(taskId);
    const commentsWithAttachments = await Promise.all(
      comments.map(async (comment) => ({
        ...comment,
        attachments: await storage.getTaskCommentAttachments(comment.id),
      }))
    );
    res.json(commentsWithAttachments);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// POST /api/tasks/:taskId/comments (Authenticated users)
router.post(
  "/api/tasks/:taskId/comments",
  isAuthenticated,
  upload.single("attachment"),
  async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      if (isNaN(taskId)) {
        return res.status(400).json({ error: "Invalid task ID" });
      }

      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const hasAccess = await canAccessTask(req.user, taskId);
      if (!hasAccess) {
        return res
          .status(403)
          .json({ error: "Forbidden: You can only comment on your own tasks" });
      }

      // Support both 'body' and 'content' field names for flexibility
      const commentBody = req.body.body || req.body.content;

      if (
        !commentBody ||
        typeof commentBody !== "string" ||
        commentBody.trim().length === 0
      ) {
        // If no text but a file was uploaded, allow it
        if (!req.file) {
          return res.status(400).json({ error: "Comment body is required" });
        }
      }

      const result = insertTaskCommentSchema.safeParse({
        taskId,
        authorUserId: req.user.id,
        body: commentBody || "",
      });

      if (!result.success) {
        return res.status(400).json({
          error: fromError(result.error).toString(),
        });
      }

      const comment = await storage.createTaskComment(result.data);

      // Handle file attachment if present
      if (req.file) {
        try {
          const attachment = await storage.createTaskCommentAttachment({
            commentId: comment.id,
            storedFileName: req.file.filename,
            fileName: req.file.originalname,
            mimeType: req.file.mimetype,
            fileSize: req.file.size,
            uploadedByUserId: req.user.id,
          });

          // Get task details for MinIO upload
          const task = await storage.getTaskWithEventDepartment(taskId);
          if (task) {
            const fileBuffer = fs.readFileSync(req.file.path);
            await eventFileService.uploadTaskCommentFile(
              fileBuffer,
              req.file.originalname,
              req.file.mimetype,
              task.eventDepartment.eventId,
              task.title,
              comment.id,
              req.user.id
            );
          }
        } catch (uploadError) {
          console.error("Failed to upload attachment:", uploadError);
          // Comment was created, but attachment failed - don't fail the whole request
        }
      }

      // Get comment with author username and attachments
      const comments = await storage.getTaskComments(taskId);
      const createdComment = comments.find((c) => c.id === comment.id);
      if (createdComment) {
        const attachments = await storage.getTaskCommentAttachments(comment.id);
        res.status(201).json({ ...createdComment, attachments });
      } else {
        res.status(201).json(comment);
      }
    } catch (error) {
      console.error("Failed to create task comment:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  }
);

// DELETE /api/tasks/:taskId/comments/:commentId (Delete a task comment)
router.delete(
  "/api/tasks/:taskId/comments/:commentId",
  isAuthenticated,
  async (req, res) => {
    try {
      const commentId = parseInt(req.params.commentId);
      const taskId = parseInt(req.params.taskId);

      if (isNaN(commentId) || isNaN(taskId)) {
        return res.status(400).json({ error: "Invalid comment or task ID" });
      }

      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verify the user has access to the task
      const hasAccess = await canAccessTask(req.user, taskId);
      if (!hasAccess) {
        return res
          .status(403)
          .json({ error: "Forbidden: You don't have access to this task" });
      }

      // Get the comment to check ownership
      const comments = await storage.getTaskComments(taskId);
      const comment = comments.find((c) => c.id === commentId);

      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }

      // Only allow deleting own comments unless admin/superadmin
      const isOwner = comment.authorUserId === req.user.id;
      const isAdmin = req.user.role === "admin" || req.user.role === "superadmin";

      if (!isOwner && !isAdmin) {
        return res
          .status(403)
          .json({ error: "Forbidden: You can only delete your own comments" });
      }

      await storage.deleteTaskComment(commentId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Failed to delete task comment:", error);
      res.status(500).json({ error: error.message || "Failed to delete comment" });
    }
  }
);

// ==================== Task Comment Attachment Routes ====================

// POST /api/task-comments/:commentId/attachments - Upload file to comment
router.post(
  "/api/task-comments/:commentId/attachments",
  isAuthenticated,
  upload.single("file"),
  async (req, res) => {
    try {
      const commentId = parseInt(req.params.commentId);
      const file = req.file;

      if (isNaN(commentId)) {
        return res.status(400).json({ message: "Invalid comment ID" });
      }

      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      if (!req.user) {
        deleteFile(file.filename);
        return res.status(401).json({ message: "Unauthorized" });
      }

      const settings = await storage.getSettings();
      if (!settings.fileUploadsEnabled) {
        deleteFile(file.filename);
        return res.status(403).json({ message: "File uploads are disabled" });
      }

      const hasAccess = await canAccessComment(req.user, commentId);
      if (!hasAccess) {
        deleteFile(file.filename);
        return res
          .status(403)
          .json({ message: "Forbidden: You do not have access to this comment" });
      }

      // Get the task details to find the event
      const [comment] = await db
        .select()
        .from(taskComments)
        .where(eq(taskComments.id, commentId));
      if (!comment) {
        deleteFile(file.filename);
        return res.status(404).json({ message: "Comment not found" });
      }

      const task = await storage.getTaskWithEventDepartment(comment.taskId);
      if (!task) {
        deleteFile(file.filename);
        return res.status(404).json({ message: "Task not found" });
      }

      const eventId = task.eventDepartment.eventId;

      // Create the local attachment record (backward compatibility)
      const attachment = await storage.createTaskCommentAttachment({
        commentId,
        fileName: file.originalname,
        storedFileName: file.filename,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedByUserId: req.user.id,
      });

      // Also upload to MinIO event folder structure (best-effort, don't fail if MinIO unavailable)
      try {
        const filePath = getFilePath(file.filename);
        const fileBuffer = fs.readFileSync(filePath);

        await eventFileService.uploadTaskCommentFile(
          fileBuffer,
          file.originalname,
          file.mimetype,
          eventId,
          task.title,
          commentId,
          req.user.id
        );
        console.log(
          `[TaskAttachment] Successfully uploaded to event folder: ${eventId}`
        );
      } catch (minioError) {
        // Log but don't fail - local storage is the primary storage
        console.warn(
          "[TaskAttachment] Failed to upload to event folder (MinIO may be unavailable):",
          minioError
        );
      }

      res.status(201).json(attachment);
    } catch (error) {
      console.error("File upload error:", error);
      if (req.file) {
        deleteFile(req.file.filename);
      }
      res.status(500).json({ message: "Failed to upload file" });
    }
  }
);

// GET /api/task-comment-attachments/:id/download - Download file
router.get(
  "/api/task-comment-attachments/:id/download",
  isAuthenticated,
  async (req, res) => {
    try {
      const attachmentId = parseInt(req.params.id);
      if (isNaN(attachmentId)) {
        return res.status(400).json({ message: "Invalid attachment ID" });
      }

      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const [attachment] = await db
        .select()
        .from(taskCommentAttachments)
        .where(eq(taskCommentAttachments.id, attachmentId));

      if (!attachment) {
        return res.status(404).json({ message: "Attachment not found" });
      }

      const hasAccess = await canAccessComment(req.user, attachment.commentId);
      if (!hasAccess) {
        return res
          .status(403)
          .json({ message: "Forbidden: You do not have access to this attachment" });
      }

      const filePath = getFilePath(attachment.storedFileName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found on disk" });
      }

      res.download(filePath, attachment.fileName);
    } catch (error) {
      console.error("File download error:", error);
      res.status(500).json({ message: "Failed to download file" });
    }
  }
);

// DELETE /api/task-comment-attachments/:id - Delete attachment
router.delete(
  "/api/task-comment-attachments/:id",
  isAuthenticated,
  async (req, res) => {
    try {
      const attachmentId = parseInt(req.params.id);
      if (isNaN(attachmentId)) {
        return res.status(400).json({ message: "Invalid attachment ID" });
      }

      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const [attachment] = await db
        .select()
        .from(taskCommentAttachments)
        .where(eq(taskCommentAttachments.id, attachmentId));

      if (!attachment) {
        return res.status(404).json({ message: "Attachment not found" });
      }

      const isOwner = attachment.uploadedByUserId === req.user.id;
      const isAdmin = req.user.role === "admin" || req.user.role === "superadmin";

      if (!isOwner && !isAdmin) {
        return res
          .status(403)
          .json({ message: "Forbidden: You can only delete your own attachments" });
      }

      deleteFile(attachment.storedFileName);
      await storage.deleteTaskCommentAttachment(attachmentId);

      res.json({ message: "Attachment deleted successfully" });
    } catch (error) {
      console.error("File delete error:", error);
      res.status(500).json({ message: "Failed to delete attachment" });
    }
  }
);

// GET /api/admin/all-attachments - Get all attachments (superadmin only)
router.get("/api/admin/all-attachments", isSuperAdmin, async (req, res) => {
  try {
    const attachments = await storage.getAllTaskCommentAttachments();
    res.json(attachments);
  } catch (error) {
    console.error("Get all attachments error:", error);
    res.status(500).json({ message: "Failed to fetch attachments" });
  }
});

export default router;
