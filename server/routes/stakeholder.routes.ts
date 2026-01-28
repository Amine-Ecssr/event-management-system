/**
 * Stakeholder Routes
 *
 * API endpoints for stakeholder (department) management, including
 * emails, requirements, prerequisites, accounts, and task templates.
 *
 * @module routes/stakeholder
 */

import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated, isAdminOrSuperAdmin, isSuperAdmin, authService } from "../auth";
import {
  insertStakeholderSchema,
  updateStakeholderSchema,
  insertStakeholderEmailSchema,
  insertStakeholderRequirementSchema,
} from "@shared/schema.mssql";
import { fromError } from "zod-validation-error";
import { isDepartmentScopedRole } from "./utils";

const router = Router();

// ==================== Stakeholder CRUD Routes ====================

// Get all stakeholders (authenticated)
router.get("/api/stakeholders", isAuthenticated, async (req, res) => {
  try {
    const stakeholders = await storage.getAllDepartments();
    res.json(stakeholders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stakeholders" });
  }
});

// Get stakeholders without accounts (superadmin only)
router.get("/api/stakeholders/without-accounts", isSuperAdmin, async (req, res) => {
  try {
    const stakeholders = await storage.getDepartmentsWithoutAccounts();
    res.json(stakeholders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stakeholders" });
  }
});

// Create stakeholder (superadmin only)
router.post("/api/stakeholders", isSuperAdmin, async (req, res) => {
  try {
    const result = insertStakeholderSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: fromError(result.error).toString(),
      });
    }

    const stakeholder = await storage.createDepartment(result.data);
    res.status(201).json(stakeholder);
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(400).json({ error: "Stakeholder name already exists" });
    }
    res.status(500).json({ error: "Failed to create stakeholder" });
  }
});

// Update stakeholder (superadmin only)
router.patch("/api/stakeholders/:id", isSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid stakeholder ID" });
    }

    const result = updateStakeholderSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: fromError(result.error).toString(),
      });
    }

    const stakeholder = await storage.updateDepartment(id, result.data);
    if (!stakeholder) {
      return res.status(404).json({ error: "Stakeholder not found" });
    }

    res.json(stakeholder);
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(400).json({ error: "Stakeholder name already exists" });
    }
    res.status(500).json({ error: "Failed to update stakeholder" });
  }
});

// Delete stakeholder (superadmin only)
router.delete("/api/stakeholders/:id", isSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid stakeholder ID" });
    }

    const deleted = await storage.deleteDepartment(id);
    if (!deleted) {
      return res.status(404).json({ error: "Stakeholder not found" });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete stakeholder" });
  }
});

// ==================== Stakeholder Email Routes ====================

// Add email to stakeholder (superadmin only)
router.post("/api/stakeholders/:stakeholderId/emails", isSuperAdmin, async (req, res) => {
  try {
    const departmentId = parseInt(req.params.stakeholderId);
    if (isNaN(departmentId)) {
      return res.status(400).json({ error: "Invalid stakeholder ID" });
    }

    const result = insertStakeholderEmailSchema.safeParse({
      ...req.body,
      departmentId,
    });
    if (!result.success) {
      return res.status(400).json({
        error: fromError(result.error).toString(),
      });
    }

    const email = await storage.createDepartmentEmail(result.data);
    res.status(201).json(email);
  } catch (error) {
    res.status(500).json({ error: "Failed to add email" });
  }
});

// Update stakeholder email (superadmin only)
router.patch("/api/stakeholder-emails/:id", isSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid email ID" });
    }

    const result = insertStakeholderEmailSchema
      .partial()
      .omit({ departmentId: true })
      .safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: fromError(result.error).toString(),
      });
    }

    const email = await storage.updateDepartmentEmail(id, result.data);
    if (!email) {
      return res.status(404).json({ error: "Email not found" });
    }

    res.json(email);
  } catch (error) {
    res.status(500).json({ error: "Failed to update email" });
  }
});

// Delete stakeholder email (superadmin only)
router.delete("/api/stakeholder-emails/:id", isSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid email ID" });
    }

    const deleted = await storage.deleteDepartmentEmail(id);
    if (!deleted) {
      return res.status(404).json({ error: "Email not found" });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete email" });
  }
});

// ==================== Stakeholder Requirement Routes ====================

// Add requirement to stakeholder (superadmin only)
router.post("/api/stakeholders/:stakeholderId/requirements", isSuperAdmin, async (req, res) => {
  try {
    const departmentId = parseInt(req.params.stakeholderId);
    if (isNaN(departmentId)) {
      return res.status(400).json({ error: "Invalid stakeholder ID" });
    }

    const result = insertStakeholderRequirementSchema.safeParse({
      ...req.body,
      departmentId,
    });
    if (!result.success) {
      return res.status(400).json({
        error: fromError(result.error).toString(),
      });
    }

    const requirement = await storage.createDepartmentRequirement(result.data);
    res.status(201).json(requirement);
  } catch (error) {
    res.status(500).json({ error: "Failed to add requirement" });
  }
});

// Update stakeholder requirement (superadmin only)
router.patch("/api/stakeholder-requirements/:id", isSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid requirement ID" });
    }

    const result = insertStakeholderRequirementSchema
      .partial()
      .omit({ departmentId: true })
      .safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: fromError(result.error).toString(),
      });
    }

    const requirement = await storage.updateDepartmentRequirement(id, result.data);
    if (!requirement) {
      return res.status(404).json({ error: "Requirement not found" });
    }

    res.json(requirement);
  } catch (error) {
    res.status(500).json({ error: "Failed to update requirement" });
  }
});

// Delete stakeholder requirement (superadmin only)
router.delete("/api/stakeholder-requirements/:id", isSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid requirement ID" });
    }

    const deleted = await storage.deleteDepartmentRequirement(id);
    if (!deleted) {
      return res.status(404).json({ error: "Requirement not found" });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete requirement" });
  }
});

// ==================== Task Template Prerequisites Routes ====================

// Get prerequisites for a task template
router.get("/api/stakeholders/:stakeholderId/requirements/:reqId/prerequisites", isAuthenticated, async (req, res) => {
  try {
    const reqId = parseInt(req.params.reqId);
    if (isNaN(reqId)) {
      return res.status(400).json({ error: "Invalid requirement ID" });
    }

    const prerequisites = await storage.getTaskTemplatePrerequisites(reqId);

    // Get full details for each prerequisite template
    const prereqDetails = await Promise.all(
      prerequisites.map(async (p) => {
        const allDepts = await storage.getAllDepartments();
        for (const dept of allDepts) {
          const reqs = await storage.getDepartmentRequirements(dept.id);
          const req = reqs.find((r) => r.id === p.prerequisiteTemplateId);
          if (req) {
            return { ...p, prerequisiteTemplate: req, department: dept };
          }
        }
        return { ...p, prerequisiteTemplate: null, department: null };
      })
    );

    res.json(prereqDetails);
  } catch (error) {
    console.error("Error getting prerequisites:", error);
    res.status(500).json({ error: "Failed to get prerequisites" });
  }
});

// Get available prerequisites for a task template (excludes self and circular dependencies)
router.get("/api/stakeholders/:stakeholderId/requirements/:reqId/available-prerequisites", isAuthenticated, async (req, res) => {
  try {
    const reqId = parseInt(req.params.reqId);
    if (isNaN(reqId)) {
      return res.status(400).json({ error: "Invalid requirement ID" });
    }

    const availablePrereqs = await storage.getAvailablePrerequisites(reqId);

    // Group by department for easier UI rendering
    const allDepts = await storage.getAllDepartments();
    const groupedByDept = allDepts
      .map((dept) => ({
        department: dept,
        templates: availablePrereqs.filter((t) => t.departmentId === dept.id),
      }))
      .filter((g) => g.templates.length > 0);

    res.json(groupedByDept);
  } catch (error) {
    console.error("Error getting available prerequisites:", error);
    res.status(500).json({ error: "Failed to get available prerequisites" });
  }
});

// Add prerequisite to a task template (superadmin only)
router.post("/api/stakeholders/:stakeholderId/requirements/:reqId/prerequisites", isSuperAdmin, async (req, res) => {
  try {
    const reqId = parseInt(req.params.reqId);
    if (isNaN(reqId)) {
      return res.status(400).json({ error: "Invalid requirement ID" });
    }

    const prerequisiteTemplateId =
      typeof req.body.prerequisiteTemplateId === "string"
        ? parseInt(req.body.prerequisiteTemplateId)
        : req.body.prerequisiteTemplateId;

    if (!prerequisiteTemplateId || isNaN(prerequisiteTemplateId)) {
      return res.status(400).json({ error: "prerequisiteTemplateId is required and must be a number" });
    }

    // Prevent self-reference
    if (reqId === prerequisiteTemplateId) {
      return res.status(400).json({ error: "A task template cannot be its own prerequisite" });
    }

    // Validate no circular dependency
    const { workflowService } = await import("../services/workflowService");
    const isValid = await workflowService.validateNoCycle(reqId, prerequisiteTemplateId);
    if (!isValid) {
      return res.status(400).json({ error: "Adding this prerequisite would create a circular dependency" });
    }

    const prerequisite = await storage.createTaskTemplatePrerequisite({
      taskTemplateId: reqId,
      prerequisiteTemplateId,
    });

    res.status(201).json(prerequisite);
  } catch (error: any) {
    console.error("Error adding prerequisite:", error);
    if (error.code === "23505") {
      return res.status(409).json({ error: "This prerequisite already exists" });
    }
    res.status(500).json({ error: "Failed to add prerequisite" });
  }
});

// Remove prerequisite from a task template (superadmin only)
router.delete("/api/stakeholders/:stakeholderId/requirements/:reqId/prerequisites/:prereqId", isSuperAdmin, async (req, res) => {
  try {
    const reqId = parseInt(req.params.reqId);
    const prereqId = parseInt(req.params.prereqId);

    if (isNaN(reqId) || isNaN(prereqId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const deleted = await storage.deleteTaskTemplatePrerequisite(reqId, prereqId);
    if (!deleted) {
      return res.status(404).json({ error: "Prerequisite not found" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error removing prerequisite:", error);
    res.status(500).json({ error: "Failed to remove prerequisite" });
  }
});

// ==================== Task Template Routes ====================

// Get all task templates with their prerequisites
router.get("/api/task-templates/with-prerequisites", isAuthenticated, async (req, res) => {
  try {
    const allDepts = await storage.getAllDepartments();
    const result = [];

    for (const dept of allDepts) {
      const templatesWithPrereqs = await storage.getTaskTemplatesWithPrerequisites(dept.id);
      result.push({
        department: dept,
        templates: templatesWithPrereqs,
      });
    }

    res.json(result);
  } catch (error) {
    console.error("Error getting templates with prerequisites:", error);
    res.status(500).json({ error: "Failed to get templates" });
  }
});

// Resolve prerequisites for selected templates (used by event form)
router.post("/api/task-templates/resolve-prerequisites", isAuthenticated, async (req, res) => {
  try {
    const { selectedTemplateIds } = req.body;
    if (!Array.isArray(selectedTemplateIds)) {
      return res.status(400).json({ error: "selectedTemplateIds must be an array" });
    }

    const { workflowService } = await import("../services/workflowService");
    const resolved = await workflowService.getRequiredTaskTemplates(selectedTemplateIds);

    res.json(resolved);
  } catch (error) {
    console.error("Error resolving prerequisites:", error);
    res.status(500).json({ error: "Failed to resolve prerequisites" });
  }
});

// ==================== Stakeholder Account Routes ====================

// Get all stakeholder accounts (superadmin only)
router.get("/api/stakeholder-accounts", isSuperAdmin, async (req, res) => {
  try {
    const accounts = await storage.getAllDepartmentAccounts();
    // Map departmentId/departmentName to stakeholderId/stakeholderName for frontend compatibility
    const mappedAccounts = accounts.map((account) => ({
      ...account,
      stakeholderId: account.departmentId,
      stakeholderName: account.departmentName,
    }));
    res.json(mappedAccounts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stakeholder accounts" });
  }
});

// Create stakeholder account (superadmin only)
router.post("/api/stakeholder-accounts", isSuperAdmin, async (req, res) => {
  try {
    const createAccountSchema = z.object({
      stakeholderId: z.number().int().positive("Valid stakeholder ID is required"),
      emailId: z.number().int().positive("Valid email ID is required"),
      password: z.string().min(8, "Password must be at least 8 characters"),
    });

    const result = createAccountSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: fromError(result.error).toString(),
      });
    }

    const { stakeholderId, emailId, password } = result.data;
    const departmentId = stakeholderId;

    // Check if stakeholder exists
    const stakeholder = await storage.getDepartment(departmentId);
    if (!stakeholder) {
      return res.status(404).json({ error: "Stakeholder not found" });
    }

    // Each account uses a different email from the stakeholder's email list
    const selectedEmail = stakeholder.emails.find((e) => e.id === emailId);
    if (!selectedEmail) {
      return res.status(400).json({ error: "Selected email not found for this stakeholder" });
    }

    // Create user account with unique email
    const user = await authService.createUser({
      username: selectedEmail.email,
      password: password,
      role: "department",
    });

    // Create auth identity
    await storage.createAuthIdentity({
      userId: user.id,
      provider: "local",
      externalId: null,
      metadata: null,
    });

    // Create stakeholder account
    const stakeholderAccount = await storage.createDepartmentAccount({
      userId: user.id,
      departmentId: departmentId,
      primaryEmailId: selectedEmail.id,
      lastLoginAt: null,
    });

    // Return the created account with joined data
    const accounts = await storage.getAllDepartmentAccounts();
    const createdAccount = accounts.find((a: any) => a.id === stakeholderAccount.id);

    const mappedAccount = createdAccount
      ? {
          ...createdAccount,
          stakeholderId: createdAccount.departmentId,
          stakeholderName: createdAccount.departmentName,
        }
      : null;

    res.status(201).json(mappedAccount);
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "This email already has an account. Choose a different email." });
    }
    res.status(500).json({ error: "Failed to create stakeholder account" });
  }
});

// Reset stakeholder account password (superadmin only)
router.post("/api/stakeholder-accounts/:id/reset-password", isSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid account ID" });
    }

    const resetPasswordSchema = z.object({
      newPassword: z.string().min(8, "Password must be at least 8 characters"),
    });

    const result = resetPasswordSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: fromError(result.error).toString(),
      });
    }

    const { newPassword } = result.data;

    // Get the account to find the userId
    const accounts = await storage.getAllDepartmentAccounts();
    const account = accounts.find((a) => a.id === id);
    if (!account) {
      return res.status(404).json({ error: "Stakeholder account not found" });
    }

    // Update the password
    await authService.updateUserPassword(account.userId, newPassword);

    res.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// Delete stakeholder account (superadmin only)
router.delete("/api/stakeholder-accounts/:id", isSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid account ID" });
    }

    // Get the account to find the userId
    const accounts = await storage.getAllDepartmentAccounts();
    const account = accounts.find((a) => a.id === id);
    if (!account) {
      return res.status(404).json({ error: "Stakeholder account not found" });
    }

    // Delete the user (cascade will delete auth_identity and stakeholder_account)
    const deleted = await storage.deleteUser(account.userId);
    if (!deleted) {
      return res.status(500).json({ error: "Failed to delete stakeholder account" });
    }

    res.json({ success: true, message: "Stakeholder account deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete stakeholder account" });
  }
});

// ==================== Event Stakeholder Routes ====================

// Get stakeholders assigned to an event (authenticated - stakeholders see only their own assignment)
router.get("/api/events/:eventId/stakeholders", isAuthenticated, async (req, res) => {
  try {
    let eventStakeholders;

    if (req.user && isDepartmentScopedRole(req.user.role)) {
      // Departments only see their own assignment
      const account = await storage.getDepartmentAccountByUserId(req.user.id);
      if (!account) {
        return res.json([]);
      }
      eventStakeholders = await storage.getEventDepartmentsByDepartmentId(req.params.eventId, account.departmentId);
    } else {
      // Admins see all stakeholder assignments
      eventStakeholders = await storage.getEventDepartmentsWithDetails(req.params.eventId);
    }

    // Add stakeholderId field for backwards compatibility with frontend
    const compatibleStakeholders = eventStakeholders.map((es) => ({
      ...es,
      stakeholderId: es.departmentId,
    }));

    res.json(compatibleStakeholders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch event stakeholders" });
  }
});

export default router;
