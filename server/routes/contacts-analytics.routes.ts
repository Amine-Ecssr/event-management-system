/**
 * Contacts Analytics API Routes
 * 
 * Provides endpoints for contacts database, speakers, leads, and interaction analytics.
 * 
 * @module routes/contacts-analytics
 */

import { Router, type Request, type Response } from "express";
import { contactsAnalyticsService } from "../services/contacts-analytics.service";
import { isAuthenticated, isAdminOrSuperAdmin } from "../auth";

const router = Router();

/**
 * GET /api/analytics/contacts
 * Get comprehensive contacts analytics
 * Access: Admin, Superadmin
 */
router.get("/api/analytics/contacts", isAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const data = await contactsAnalyticsService.getContactsAnalytics(year);
    res.json(data);
  } catch (error) {
    console.error("Error fetching contacts analytics:", error);
    res.status(500).json({ error: "Failed to fetch contacts analytics" });
  }
});

/**
 * GET /api/analytics/contacts/summary
 * Get contacts summary metrics
 * Access: Authenticated users
 */
router.get("/api/analytics/contacts/summary", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
    const summary = await contactsAnalyticsService.getSummary(year);
    res.json(summary);
  } catch (error) {
    console.error("Error fetching contacts summary:", error);
    res.status(500).json({ error: "Failed to fetch contacts summary" });
  }
});

/**
 * GET /api/analytics/contacts/leads
 * Get leads summary and analytics
 * Access: Authenticated users
 */
router.get("/api/analytics/contacts/leads", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const leadsSummary = await contactsAnalyticsService.getLeadsSummary();
    res.json(leadsSummary);
  } catch (error) {
    console.error("Error fetching leads summary:", error);
    res.status(500).json({ error: "Failed to fetch leads summary" });
  }
});

export default router;
