/**
 * Export Routes
 * API endpoints for data export functionality
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { exportService } from '../services/export';
import { ExportFormat, ExportLanguage, ExportEntityType } from '../services/export/types';
import { isAuthenticated, isAdminOrSuperAdmin } from '../auth';

const router = Router();

// ============================================================
// Validation Schemas
// ============================================================

const exportQuerySchema = z.object({
  format: z.enum(['xlsx', 'csv', 'pdf']).default('xlsx'),
  language: z.enum(['en', 'ar', 'both']).default('en'),
  columns: z.string().optional().transform((v) => v?.split(',').filter(Boolean)),
  limit: z.coerce.number().int().min(1).max(50000).optional(), // Max 50k rows per export
});

const queueExportSchema = z.object({
  type: z.enum(['events', 'tasks', 'contacts', 'partnerships', 'organizations', 'leads']),
  format: z.enum(['xlsx', 'csv', 'pdf']).default('xlsx'),
  language: z.enum(['en', 'ar', 'both']).default('en'),
  columns: z.array(z.string()).optional(),
});

// ============================================================
// Helper Functions
// ============================================================

function sendExportResponse(res: Response, result: { filename: string; mimeType: string; buffer?: Buffer }) {
  if (!result.buffer) {
    return res.status(500).json({ error: 'Export failed: No data generated' });
  }
  
  res.setHeader('Content-Type', result.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.setHeader('Content-Length', result.buffer.length);
  res.setHeader('Cache-Control', 'no-cache');
  res.send(result.buffer);
}

function handleExportError(res: Response, error: unknown, entityType: string) {
  console.error(`[Export] ${entityType} export failed:`, error);

  // Handle Zod validation errors
  if (error && typeof error === 'object' && 'issues' in error) {
    return res.status(400).json({
      error: 'Invalid export parameters',
      details: (error as any).issues,
    });
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  const statusCode = message.includes('not found') || message.includes('no data') ? 404 : 500;

  res.status(statusCode).json({
    error: 'Export failed',
    message,
    entityType
  });
}

// ============================================================
// Events Export Routes
// ============================================================

/**
 * GET /api/export/events
 * Export all events to selected format
 */
router.get('/api/export/events', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const options = exportQuerySchema.parse(req.query);
    const result = await exportService.exportEvents({
      format: options.format as ExportFormat,
      language: options.language as ExportLanguage,
      columns: options.columns,
    });
    sendExportResponse(res, result);
  } catch (error) {
    handleExportError(res, error, 'events');
  }
});

/**
 * GET /api/export/events/archived
 * Export archived events
 */
router.get('/api/export/events/archived', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const options = exportQuerySchema.parse(req.query);
    const result = await exportService.exportArchivedEvents({
      format: options.format as ExportFormat,
      language: options.language as ExportLanguage,
      columns: options.columns,
    });
    sendExportResponse(res, result);
  } catch (error) {
    handleExportError(res, error, 'archived-events');
  }
});

// ============================================================
// Tasks Export Routes
// ============================================================

/**
 * GET /api/export/tasks
 * Export all tasks
 */
router.get('/api/export/tasks', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const options = exportQuerySchema.parse(req.query);
    const result = await exportService.exportTasks({
      format: options.format as ExportFormat,
      language: options.language as ExportLanguage,
      columns: options.columns,
    });
    sendExportResponse(res, result);
  } catch (error) {
    handleExportError(res, error, 'tasks');
  }
});

/**
 * GET /api/export/tasks/overdue
 * Export overdue tasks only
 */
router.get('/api/export/tasks/overdue', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const options = exportQuerySchema.parse(req.query);
    const result = await exportService.exportOverdueTasks({
      format: options.format as ExportFormat,
      language: options.language as ExportLanguage,
      columns: options.columns,
    });
    sendExportResponse(res, result);
  } catch (error) {
    handleExportError(res, error, 'overdue-tasks');
  }
});

// ============================================================
// Contacts Export Routes
// ============================================================

/**
 * GET /api/export/contacts
 * Export all contacts
 */
router.get('/api/export/contacts', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const options = exportQuerySchema.parse(req.query);
    const result = await exportService.exportContacts({
      format: options.format as ExportFormat,
      language: options.language as ExportLanguage,
      columns: options.columns,
    });
    sendExportResponse(res, result);
  } catch (error) {
    handleExportError(res, error, 'contacts');
  }
});

/**
 * GET /api/export/speakers
 * Export eligible speakers only
 */
router.get('/api/export/speakers', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const options = exportQuerySchema.parse(req.query);
    const result = await exportService.exportSpeakers({
      format: options.format as ExportFormat,
      language: options.language as ExportLanguage,
      columns: options.columns,
    });
    sendExportResponse(res, result);
  } catch (error) {
    handleExportError(res, error, 'speakers');
  }
});

// ============================================================
// Organizations Export Routes
// ============================================================

/**
 * GET /api/export/organizations
 * Export all organizations
 */
router.get('/api/export/organizations', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const options = exportQuerySchema.parse(req.query);
    const result = await exportService.exportOrganizations({
      format: options.format as ExportFormat,
      language: options.language as ExportLanguage,
      columns: options.columns,
    });
    sendExportResponse(res, result);
  } catch (error) {
    handleExportError(res, error, 'organizations');
  }
});

// ============================================================
// Partnerships Export Routes
// ============================================================

/**
 * GET /api/export/partnerships
 * Export all partnerships
 */
router.get('/api/export/partnerships', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const options = exportQuerySchema.parse(req.query);
    const result = await exportService.exportPartnerships({
      format: options.format as ExportFormat,
      language: options.language as ExportLanguage,
      columns: options.columns,
    });
    sendExportResponse(res, result);
  } catch (error) {
    handleExportError(res, error, 'partnerships');
  }
});

// ============================================================
// Leads Export Routes
// ============================================================

/**
 * GET /api/export/leads
 * Export all leads
 */
router.get('/api/export/leads', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const options = exportQuerySchema.parse(req.query);
    const result = await exportService.exportLeads({
      format: options.format as ExportFormat,
      language: options.language as ExportLanguage,
      columns: options.columns,
    });
    sendExportResponse(res, result);
  } catch (error) {
    handleExportError(res, error, 'leads');
  }
});

// ============================================================
// Job Queue Routes (for large exports)
// ============================================================

/**
 * POST /api/export/queue
 * Queue a large export job for async processing
 */
router.post('/api/export/queue', isAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const body = queueExportSchema.parse(req.body);
    const jobId = await exportService.queueExport(body.type as ExportEntityType, {
      format: body.format as ExportFormat,
      language: body.language as ExportLanguage,
      columns: body.columns,
    });
    res.json({ 
      jobId, 
      status: 'pending',
      message: 'Export job queued successfully' 
    });
  } catch (error) {
    console.error('[Export] Failed to queue export:', error);
    res.status(500).json({ error: 'Failed to queue export job' });
  }
});

/**
 * GET /api/export/jobs
 * List all export jobs (admin only)
 */
router.get('/api/export/jobs', isAdminOrSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const jobs = exportService.getAllJobs();
    res.json(jobs);
  } catch (error) {
    console.error('[Export] Failed to get jobs:', error);
    res.status(500).json({ error: 'Failed to retrieve export jobs' });
  }
});

/**
 * GET /api/export/jobs/:jobId
 * Get status of a specific export job
 */
router.get('/api/export/jobs/:jobId', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const job = exportService.getJobStatus(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
  } catch (error) {
    console.error('[Export] Failed to get job status:', error);
    res.status(500).json({ error: 'Failed to retrieve job status' });
  }
});

/**
 * DELETE /api/export/jobs/:jobId
 * Cancel a pending export job
 */
router.delete('/api/export/jobs/:jobId', isAdminOrSuperAdmin, async (req: Request, res: Response) => {
  try {
    const cancelled = exportService.cancelJob(req.params.jobId);
    if (!cancelled) {
      return res.status(400).json({ 
        error: 'Cannot cancel job',
        message: 'Job is already processing or completed' 
      });
    }
    res.json({ message: 'Job cancelled successfully' });
  } catch (error) {
    console.error('[Export] Failed to cancel job:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

export default router;
