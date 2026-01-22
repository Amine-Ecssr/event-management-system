/**
 * Category Routes
 *
 * API endpoints for event category management:
 * - GET /api/categories - Get all categories
 * - GET /api/categories/:id - Get category by ID
 * - POST /api/categories - Create new category (admin only)
 * - PUT /api/categories/:id - Update category (admin only)
 * - DELETE /api/categories/:id - Delete category (admin only)
 *
 * @module routes/category
 */

import { Router } from "express";
import { storage } from "../storage";
import { isAdminOrSuperAdmin } from "../auth";

const router = Router();

// ==================== Category Routes ====================

/**
 * GET /api/categories
 * Get all categories
 */
router.get("/api/categories", async (req, res) => {
  try {
    const categories = await storage.getCategories();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

/**
 * GET /api/categories/:id
 * Get category by ID
 */
router.get("/api/categories/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const category = await storage.getCategoryById(id);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch category" });
  }
});

/**
 * POST /api/categories
 * Create new category (admin only)
 */
router.post("/api/categories", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const { nameEn, nameAr } = req.body;

    if (!nameEn) {
      return res.status(400).json({ error: "Category name (English) is required" });
    }

    // Check if category already exists
    const existing = await storage.getCategoryByName(nameEn);
    if (existing) {
      return res.json(existing); // Return existing category
    }

    const category = await storage.createCategory({ nameEn, nameAr });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: "Failed to create category" });
  }
});

/**
 * PUT /api/categories/:id
 * Update category (admin only)
 */
router.put("/api/categories/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { nameEn, nameAr } = req.body;

    if (!nameEn) {
      return res.status(400).json({ error: "Category name (English) is required" });
    }

    const category = await storage.updateCategory(id, { nameEn, nameAr });
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: "Failed to update category" });
  }
});

/**
 * DELETE /api/categories/:id
 * Delete category (admin only)
 */
router.delete("/api/categories/:id", isAdminOrSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteCategory(id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;
