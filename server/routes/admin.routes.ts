/**
 * Admin Routes
 *
 * API endpoints for admin user management, including:
 * - User listing and CRUD operations
 * - Admin account creation and management
 * - User role updates and password resets
 *
 * Note: Stakeholder account routes are in stakeholder.routes.ts
 *
 * @module routes/admin
 */

import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isSuperAdmin } from "../auth";
import { getAuthService } from "../auth-service";
import { fromError } from "zod-validation-error";

const router = Router();

// ==================== User Management Routes (superadmin only) ====================

/**
 * POST /api/admin/create-user
 * Create admin user (superadmin only)
 */
router.post("/api/admin/create-user", isSuperAdmin, async (req, res) => {
  try {
    const createUserSchema = z.object({
      username: z.string().min(3, "Username must be at least 3 characters"),
      password: z.string().min(8, "Password must be at least 8 characters"),
      role: z.enum(["admin", "superadmin"]).default("admin"),
    });

    const result = createUserSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: fromError(result.error).toString(),
      });
    }

    const { username, password, role } = result.data;

    // Check if username already exists
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ error: "Username already exists" });
    }

    // Create user
    const authService = getAuthService();
    const user = await authService.createUser({
      username,
      password,
      role,
    });

    // Create auth identity
    await storage.createAuthIdentity({
      userId: user.id,
      provider: "local",
      externalId: null,
      metadata: null,
    });

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Username already exists" });
    }
    res.status(500).json({ error: "Failed to create user" });
  }
});

/**
 * GET /api/users
 * Get all users (superadmin only)
 */
router.get("/api/users", isSuperAdmin, async (req, res) => {
  try {
    const allUsers = await storage.getAllUsers();
    // Don't send passwords to frontend
    const usersWithoutPasswords = allUsers.map(({ password, ...user }) => user);
    res.json(usersWithoutPasswords);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

/**
 * PATCH /api/admin/users/:id/reset-password
 * Reset admin user password (superadmin only)
 */
router.patch("/api/admin/users/:id/reset-password", isSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid user ID" });
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

    // Verify user exists
    const user = await storage.getUser(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update the password
    const authService = getAuthService();
    await authService.updateUserPassword(id, newPassword);

    res.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to reset password" });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete admin user (superadmin only)
 */
router.delete("/api/admin/users/:id", isSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // Check if user exists
    const user = await storage.getUser(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent deletion of current user
    if (req.user && req.user.id === id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    // Check if this is the last superadmin
    if (user.role === "superadmin") {
      const allUsers = await storage.getAllUsers();
      const superadminCount = allUsers.filter((u) => u.role === "superadmin").length;
      if (superadminCount <= 1) {
        return res.status(400).json({ error: "Cannot delete the last superadmin" });
      }
    }

    // Delete the user
    const deleted = await storage.deleteUser(id);
    if (!deleted) {
      return res.status(500).json({ error: "Failed to delete user" });
    }

    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
