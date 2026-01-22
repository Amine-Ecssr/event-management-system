/**
 * Elasticsearch Health Routes
 * 
 * Provides health check endpoints for monitoring Elasticsearch status.
 * Includes both public (minimal) and detailed (admin-only) endpoints.
 */

import { Router } from 'express';
import { 
  checkElasticsearchHealth, 
  getIndexStats, 
  isElasticsearchEnabled 
} from '../elasticsearch';
import { isAuthenticated, isAdminOrSuperAdmin } from '../auth';

const router = Router();

/**
 * GET /api/health/elasticsearch
 * Public health check - returns minimal status info
 * Safe to expose for load balancers and monitoring
 */
router.get('/api/health/elasticsearch', async (req, res) => {
  try {
    const health = await checkElasticsearchHealth();
    const statusCode = health.status === 'unavailable' ? 503 : 200;
    
    res.status(statusCode).json({ 
      status: health.status,
      enabled: health.enabled,
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unavailable',
      enabled: isElasticsearchEnabled(),
      error: 'Health check failed',
    });
  }
});

/**
 * GET /api/health/elasticsearch/detailed
 * Detailed health check - requires authentication
 * Returns full cluster information for debugging
 */
router.get('/api/health/elasticsearch/detailed', isAuthenticated, async (req, res) => {
  try {
    const health = await checkElasticsearchHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unavailable',
      enabled: isElasticsearchEnabled(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/health/elasticsearch/indices
 * Index statistics - requires admin role
 * Returns info about all EventCal indices
 */
router.get('/api/health/elasticsearch/indices', isAdminOrSuperAdmin, async (req, res) => {
  try {
    if (!isElasticsearchEnabled()) {
      return res.status(503).json({
        error: 'Elasticsearch is disabled',
        indices: [],
      });
    }
    
    const indices = await getIndexStats();
    res.json({
      count: indices.length,
      indices,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      indices: [],
    });
  }
});

export default router;
