/**
 * Suggest Routes
 * API endpoints for search suggestions and autocomplete
 */

import { Router } from 'express';
import { z } from 'zod';
import { suggestService } from '../services/elasticsearch-suggest.service';
import { isAuthenticated } from '../auth';
import { SuggestionEntityType } from '../elasticsearch/types/suggest.types';

const router = Router();

// Validation schemas
const suggestQuerySchema = z.object({
  q: z.string().min(1).max(100),
  types: z
    .string()
    .optional()
    .transform((v) =>
      v ? (v.split(',') as SuggestionEntityType[]) : undefined
    ),
  limit: z.coerce.number().min(1).max(50).default(5),
  fuzzy: z.coerce.boolean().default(true),
  departmentId: z.coerce.number().optional(),
  category: z.string().optional(),
});

const autocompleteQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().min(1).max(20).default(10),
});

/**
 * GET /api/suggest
 * Main suggestion endpoint with multi-entity search and did-you-mean
 */
router.get('/api/suggest', isAuthenticated, async (req, res) => {
  try {
    const params = suggestQuerySchema.parse(req.query);

    // Run suggestions and did-you-mean in parallel
    const [suggestionsResult, didYouMean] = await Promise.all([
      suggestService.getSuggestions({
        q: params.q,
        types: params.types,
        limit: params.limit,
        fuzzy: params.fuzzy,
        context: params.departmentId || params.category
          ? {
              departmentId: params.departmentId,
              category: params.category,
            }
          : undefined,
      }),
      suggestService.getDidYouMean(params.q),
    ]);

    res.json({
      ...suggestionsResult,
      didYouMean,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: error.errors,
      });
    }
    console.error('[SuggestRoutes] GET /api/suggest error:', error);
    res.status(500).json({ error: 'Suggestion failed' });
  }
});

/**
 * GET /api/suggest/did-you-mean
 * Spelling correction endpoint
 */
router.get('/api/suggest/did-you-mean', isAuthenticated, async (req, res) => {
  try {
    const q = z.string().min(1).max(100).parse(req.query.q);
    const suggestion = await suggestService.getDidYouMean(q);
    res.json({ original: q, suggestion });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query' });
    }
    console.error('[SuggestRoutes] GET /api/suggest/did-you-mean error:', error);
    res.status(500).json({ error: 'Spell check failed' });
  }
});

/**
 * GET /api/suggest/popular
 * Get popular searches
 */
router.get('/api/suggest/popular', isAuthenticated, async (req, res) => {
  try {
    const period = z.enum(['24h', '7d', '30d']).default('7d').parse(req.query.period);
    const result = await suggestService.getPopularSearches(period);
    res.json(result);
  } catch (error) {
    console.error('[SuggestRoutes] GET /api/suggest/popular error:', error);
    res.status(500).json({ error: 'Failed to get popular searches' });
  }
});

/**
 * GET /api/autocomplete/events
 * Autocomplete for events
 */
router.get('/api/autocomplete/events', isAuthenticated, async (req, res) => {
  try {
    const { q, limit } = autocompleteQuerySchema.parse(req.query);
    const result = await suggestService.getAutocomplete('events', q, limit);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters' });
    }
    console.error('[SuggestRoutes] GET /api/autocomplete/events error:', error);
    res.status(500).json({ error: 'Autocomplete failed' });
  }
});

/**
 * GET /api/autocomplete/contacts
 * Autocomplete for contacts
 */
router.get('/api/autocomplete/contacts', isAuthenticated, async (req, res) => {
  try {
    const { q, limit } = autocompleteQuerySchema.parse(req.query);
    const result = await suggestService.getAutocomplete('contacts', q, limit);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters' });
    }
    console.error('[SuggestRoutes] GET /api/autocomplete/contacts error:', error);
    res.status(500).json({ error: 'Autocomplete failed' });
  }
});

/**
 * GET /api/autocomplete/organizations
 * Autocomplete for organizations
 */
router.get('/api/autocomplete/organizations', isAuthenticated, async (req, res) => {
  try {
    const { q, limit } = autocompleteQuerySchema.parse(req.query);
    const result = await suggestService.getAutocomplete('organizations', q, limit);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters' });
    }
    console.error('[SuggestRoutes] GET /api/autocomplete/organizations error:', error);
    res.status(500).json({ error: 'Autocomplete failed' });
  }
});

/**
 * GET /api/autocomplete/tasks
 * Autocomplete for tasks
 */
router.get('/api/autocomplete/tasks', isAuthenticated, async (req, res) => {
  try {
    const { q, limit } = autocompleteQuerySchema.parse(req.query);
    const result = await suggestService.getAutocomplete('tasks', q, limit);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters' });
    }
    console.error('[SuggestRoutes] GET /api/autocomplete/tasks error:', error);
    res.status(500).json({ error: 'Autocomplete failed' });
  }
});

/**
 * GET /api/autocomplete/partnerships
 * Autocomplete for partnerships
 */
router.get('/api/autocomplete/partnerships', isAuthenticated, async (req, res) => {
  try {
    const { q, limit } = autocompleteQuerySchema.parse(req.query);
    const result = await suggestService.getAutocomplete('partnerships', q, limit);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters' });
    }
    console.error('[SuggestRoutes] GET /api/autocomplete/partnerships error:', error);
    res.status(500).json({ error: 'Autocomplete failed' });
  }
});

export default router;
