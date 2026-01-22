/**
 * AI Routes
 *
 * Production-grade endpoints for AI chat and intake parsing.
 * Uses the new orchestrator with LLM query parsing and tool execution.
 *
 * @module routes/ai
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { isAuthenticated } from '../auth';
import { AiAssistant, AiConfig, DEFAULT_AI_CONFIG } from '../services/ai';
// Legacy imports for backwards compatibility
import { parseIntakeText } from '../services/ai-intake.service';
import { storage } from '../repositories';

const router = Router();

// Rate limiting state (per-user, in-memory)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // 20 requests per minute

function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = (req.user as any)?.id || req.ip || 'anonymous';
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Too many requests. Please slow down.',
      retryAfter,
    });
  }

  entry.count += 1;
  next();
}

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(2000),
      }),
    )
    .max(10)
    .optional(),
  mode: z.enum(['standard', 'agentic']).optional().default('standard'),
  stream: z.boolean().optional().default(false),
});

const intakeSchema = z.object({
  text: z.string().min(1).max(10000),
});

const parseQuerySchema = z.object({
  query: z.string().min(1).max(2000),
});

/**
 * Handles errors with appropriate status codes
 */
function handleRouteError(error: unknown, res: Response, defaultMessage: string) {
  // Zod validation errors -> 400 Bad Request
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }

  // OpenAI rate limit errors -> 429
  if (error instanceof Error && error.message.includes('429')) {
    return res.status(429).json({
      error: 'AI service rate limited. Please try again later.',
    });
  }

  // OpenAI auth errors -> 503
  if (error instanceof Error && (error.message.includes('401') || error.message.includes('403'))) {
    return res.status(503).json({
      error: 'AI service temporarily unavailable.',
    });
  }

  // Generic error
  const message = error instanceof Error ? error.message : defaultMessage;
  console.error('[AI Route Error]', message);
  return res.status(500).json({ error: message });
}

/**
 * Main chat endpoint - Production-grade with LLM query parsing
 * 
 * POST /api/ai/chat
 * Body: { message: string, history?: Array, mode?: 'standard' | 'agentic', stream?: boolean }
 * 
 * Modes:
 * - standard: Parse query → execute tools → generate response
 * - agentic: Let LLM dynamically decide which tools to call
 */
router.post('/api/ai/chat', isAuthenticated, rateLimitMiddleware, async (req, res) => {
  try {
    const { message, history, mode, stream } = chatSchema.parse(req.body);
    
    // TODO: Implement conversation history properly
    // For now, we process single messages
    
    if (stream) {
      // Server-Sent Events for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      const generator = AiAssistant.streamChatResponse(message);
      
      for await (const chunk of generator) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      
      res.end();
      return;
    }
    
    // Non-streaming response
    const response = mode === 'agentic' 
      ? await AiAssistant.agenticChat(message)
      : await AiAssistant.chat(message);
    
    // Transform response to match frontend expected format
    const frontendResponse = {
      answer: response.message,
      sources: response.sources.map((s) => ({
        id: s.id,
        entityType: s.entityType,
        title: s.title,
        snippet: s.snippet || '',
        score: s.relevanceScore || 0,
      })),
      provider: 'openai',
      model: response.metadata?.model || 'gpt-4o-mini',
    };
    
    res.json(frontendResponse);
  } catch (error) {
    handleRouteError(error, res, 'Failed to generate response');
  }
});

/**
 * Query parsing endpoint - Useful for debugging and understanding
 * 
 * POST /api/ai/parse
 * Body: { query: string }
 * 
 * Returns the parsed query structure without executing tools
 */
router.post('/api/ai/parse', isAuthenticated, rateLimitMiddleware, async (req, res) => {
  try {
    const { query } = parseQuerySchema.parse(req.body);
    const parsed = await AiAssistant.parseQuery(query);
    res.json({ parsed });
  } catch (error) {
    handleRouteError(error, res, 'Failed to parse query');
  }
});

/**
 * Intake parsing endpoint - For extracting suggestions from user input
 * Uses legacy service for backwards compatibility
 * 
 * POST /api/ai/intake/parse
 * Body: { text: string, type?: 'event' | 'task' | 'partnership' | 'lead' }
 */
router.post('/api/ai/intake/parse', isAuthenticated, rateLimitMiddleware, async (req, res) => {
  try {
    const { text } = intakeSchema.parse(req.body);
    const { type = 'event' } = req.body; // Default to event if not provided
    
    // Fetch dropdown options from database for LLM context
    const departments = await storage.getAllDepartments();
    const partnershipTypes = await storage.getAllPartnershipTypes();
    
    const options = {
      departments: departments.map(d => ({
        id: d.id,
        name: d.name,
        nameAr: d.nameAr,
      })),
      partnershipTypes: partnershipTypes.map(pt => ({
        id: pt.id,
        nameEn: pt.nameEn,
        nameAr: pt.nameAr,
      })),
      eventTypes: [
        { value: 'local', label: 'Local' },
        { value: 'international', label: 'International' },
      ],
      priorities: [
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
        { value: 'low', label: 'Low' },
      ],
    };
    
    // Use parsing with type and dropdown options (now always async)
    const analysis = await parseIntakeText(text, type, options);
    
    // Optionally find similar events using the new AI system
    let similar: any[] = [];
    try {
      const parsed = await AiAssistant.parseQuery(text);
      if (parsed.searchText) {
        // We could use tools here to find similar items
        // For now, return empty array
        similar = [];
      }
    } catch {
      // Ignore errors in similarity search
    }

    res.json({
      ...analysis,
      similar,
    });
  } catch (error) {
    handleRouteError(error, res, 'Failed to parse intake text');
  }
});

/**
 * Health check endpoint for AI service
 * 
 * GET /api/ai/health
 */
router.get('/api/ai/health', async (req, res) => {
  const hasOpenAiKey = !!process.env.OPENAI_API_KEY;
  
  res.json({
    status: hasOpenAiKey ? 'operational' : 'degraded',
    features: {
      queryParsing: hasOpenAiKey,
      toolExecution: true,
      responseGeneration: hasOpenAiKey,
      streaming: hasOpenAiKey,
    },
    message: hasOpenAiKey 
      ? 'AI service is fully operational'
      : 'Running in fallback mode (no OpenAI API key)',
  });
});

// ==================== Chat History Endpoints ====================

const conversationSchema = z.object({
  title: z.string().min(1).max(255).optional(),
});

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
  sources: z.array(z.object({
    id: z.string(),
    entityType: z.string(),
    title: z.string(),
    snippet: z.string().optional(),
    score: z.number().optional(),
  })).optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Get all conversations for the authenticated user
 * 
 * GET /api/ai/conversations
 */
router.get('/api/ai/conversations', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const conversations = await storage.getAiConversations(userId);
    res.json(conversations);
  } catch (error) {
    handleRouteError(error, res, 'Failed to fetch conversations');
  }
});

/**
 * Create a new conversation
 * 
 * POST /api/ai/conversations
 * Body: { title?: string }
 */
router.post('/api/ai/conversations', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { title } = conversationSchema.parse(req.body);
    const conversation = await storage.createAiConversation(userId, title);
    res.status(201).json(conversation);
  } catch (error) {
    handleRouteError(error, res, 'Failed to create conversation');
  }
});

/**
 * Get or create an active conversation for the user
 * 
 * POST /api/ai/conversations/active
 */
router.post('/api/ai/conversations/active', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const conversation = await storage.getOrCreateActiveAiConversation(userId);
    res.json(conversation);
  } catch (error) {
    handleRouteError(error, res, 'Failed to get or create active conversation');
  }
});

/**
 * Get a specific conversation with messages
 * 
 * GET /api/ai/conversations/:conversationId
 */
router.get('/api/ai/conversations/:conversationId', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { conversationId } = req.params;
    const conversation = await storage.getAiConversation(conversationId, userId);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    res.json(conversation);
  } catch (error) {
    handleRouteError(error, res, 'Failed to fetch conversation');
  }
});

/**
 * Update conversation title
 * 
 * PATCH /api/ai/conversations/:conversationId
 * Body: { title: string }
 */
router.patch('/api/ai/conversations/:conversationId', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { conversationId } = req.params;
    const { title } = z.object({ title: z.string().min(1).max(255) }).parse(req.body);
    
    const updated = await storage.updateAiConversationTitle(conversationId, userId, title);
    
    if (!updated) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    res.json(updated);
  } catch (error) {
    handleRouteError(error, res, 'Failed to update conversation');
  }
});

/**
 * Archive a conversation
 * 
 * POST /api/ai/conversations/:conversationId/archive
 */
router.post('/api/ai/conversations/:conversationId/archive', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { conversationId } = req.params;
    const archived = await storage.archiveAiConversation(conversationId, userId);
    
    if (!archived) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    res.json({ success: true, archived });
  } catch (error) {
    handleRouteError(error, res, 'Failed to archive conversation');
  }
});

/**
 * Delete a conversation
 * 
 * DELETE /api/ai/conversations/:conversationId
 */
router.delete('/api/ai/conversations/:conversationId', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { conversationId } = req.params;
    const deleted = await storage.deleteAiConversation(conversationId, userId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    handleRouteError(error, res, 'Failed to delete conversation');
  }
});

/**
 * Get messages for a conversation
 * 
 * GET /api/ai/conversations/:conversationId/messages
 */
router.get('/api/ai/conversations/:conversationId/messages', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { conversationId } = req.params;
    const messages = await storage.getAiChatMessages(conversationId, userId);
    res.json(messages);
  } catch (error) {
    handleRouteError(error, res, 'Failed to fetch messages');
  }
});

/**
 * Add a message to a conversation
 * 
 * POST /api/ai/conversations/:conversationId/messages
 * Body: { role: 'user' | 'assistant', content: string, sources?: [], metadata?: {} }
 */
router.post('/api/ai/conversations/:conversationId/messages', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { conversationId } = req.params;
    
    // Verify the conversation belongs to this user
    const conversation = await storage.getAiConversation(conversationId, userId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const messageData = messageSchema.parse(req.body);
    const message = await storage.addAiChatMessage(conversationId, messageData);
    
    res.status(201).json(message);
  } catch (error) {
    handleRouteError(error, res, 'Failed to add message');
  }
});

export default router;
