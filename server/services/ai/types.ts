/**
 * AI Service Types
 * 
 * Core type definitions for the production-grade AI assistant.
 * Includes query parsing schemas, tool definitions, and response types.
 * 
 * @module services/ai/types
 */

import { z } from 'zod';

// ============================================================================
// Query Parsing Types (LLM extracts these from natural language)
// ============================================================================

/**
 * Schema for LLM-parsed query parameters
 * The LLM uses function calling to extract structured data from user queries
 */
export const ParsedQuerySchema = z.object({
  // Core search parameters
  searchText: z.string().describe('Keywords to search for, excluding temporal/filter terms. Can be empty if query is purely filter-based.'),
  
  // Entity type filtering
  entityTypes: z.array(z.enum([
    'events', 
    'tasks', 
    'contacts', 
    'partnerships', 
    'leads',
    'organizations',
    'archived-events'
  ])).describe('Which entity types the user wants to search. Infer from context.'),
  
  // Temporal filtering - LLM calculates actual dates
  dateRange: z.object({
    start: z.string().nullable().describe('ISO 8601 date string (YYYY-MM-DD) for range start'),
    end: z.string().nullable().describe('ISO 8601 date string (YYYY-MM-DD) for range end'),
    field: z.enum(['startDate', 'endDate', 'dueDate', 'createdAt']).describe('Which date field to filter on'),
  }).nullable().describe('Date range filter. Calculate actual dates from relative expressions like "next week"'),
  
  // Status and priority filters
  filters: z.object({
    status: z.array(z.string()).nullable().describe('Status values to filter by (e.g., pending, completed, confirmed)'),
    priority: z.array(z.string()).nullable().describe('Priority values to filter by (e.g., high, medium, low)'),
    department: z.string().nullable().describe('Department name to filter by'),
    category: z.string().nullable().describe('Event category to filter by'),
  }).nullable(),
  
  // Query intent classification
  intent: z.enum([
    'search',      // Find matching records
    'count',       // Count records matching criteria
    'summarize',   // Provide summary/overview
    'compare',     // Compare multiple items
    'analyze',     // Provide analytics/insights
    'list',        // List items (often with filters)
    'detail',      // Get details about specific item
  ]).describe('The user intent - what kind of response they expect'),
  
  // Sorting preference
  sortBy: z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']),
  }).nullable().describe('How to sort results'),
  
  // Result limit
  limit: z.number().min(1).max(50).default(10).describe('Maximum number of results to return'),
});

export type ParsedQuery = z.infer<typeof ParsedQuerySchema>;

// ============================================================================
// Tool Parameter Types
// ============================================================================

export interface SearchEventsParams {
  query?: string;
  dateRange?: {
    start?: string | null;
    end?: string | null;
    field?: 'startDate' | 'endDate';
  };
  status?: string[];
  category?: string;
  sortBy?: { field: string; direction: 'asc' | 'desc' };
  limit?: number;
}

export interface SearchTasksParams {
  query?: string;
  dateRange?: {
    start?: string | null;
    end?: string | null;
    field?: 'dueDate' | 'createdAt';
  };
  status?: string[];
  priority?: string[];
  sortBy?: { field: string; direction: 'asc' | 'desc' };
  limit?: number;
}

// ============================================================================
// Tool Definitions for Agentic RAG
// ============================================================================

/**
 * Tool parameter schemas - used for OpenAI function calling
 */
export const ToolSchemas = {
  search_events: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Text search query' },
      dateRange: {
        type: 'object',
        properties: {
          start: { type: 'string', nullable: true, description: 'Start date (YYYY-MM-DD)' },
          end: { type: 'string', nullable: true, description: 'End date (YYYY-MM-DD)' },
          field: { type: 'string', enum: ['startDate', 'endDate'], default: 'startDate' },
        },
      },
      status: { type: 'array', items: { type: 'string' }, description: 'Filter by status' },
      category: { type: 'string', description: 'Filter by category' },
      limit: { type: 'number', default: 10 },
    },
  },
  
  search_tasks: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Text search query' },
      dateRange: {
        type: 'object',
        properties: {
          start: { type: 'string', nullable: true },
          end: { type: 'string', nullable: true },
          field: { type: 'string', enum: ['dueDate', 'createdAt'], default: 'dueDate' },
        },
      },
      status: { type: 'array', items: { type: 'string' }, description: 'Filter by status' },
      priority: { type: 'array', items: { type: 'string' }, description: 'Filter by priority' },
      limit: { type: 'number', default: 10 },
    },
  },
  
  search_contacts: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search by name, email, or organization' },
      organization: { type: 'string', description: 'Filter by organization name' },
      limit: { type: 'number', default: 10 },
    },
  },
  
  search_partnerships: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Text search query' },
      status: { type: 'array', items: { type: 'string' }, description: 'Filter by partnership status' },
      limit: { type: 'number', default: 10 },
    },
  },

  search_leads: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Text search query for leads' },
      status: { type: 'array', items: { type: 'string' }, description: 'Filter by lead status (new, contacted, qualified, proposal, negotiation, won, lost)' },
      limit: { type: 'number', default: 10 },
    },
  },
  
  get_event_details: {
    type: 'object',
    properties: {
      eventId: { type: 'number', description: 'The event ID to get details for' },
    },
    required: ['eventId'],
  },
  
  get_task_details: {
    type: 'object',
    properties: {
      taskId: { type: 'number', description: 'The task ID to get details for' },
    },
    required: ['taskId'],
  },
  
  get_count: {
    type: 'object',
    properties: {
      entityType: { type: 'string', enum: ['events', 'tasks', 'contacts', 'partnerships', 'leads'] },
      status: { type: 'array', items: { type: 'string' } },
      dateRange: {
        type: 'object',
        properties: {
          start: { type: 'string', nullable: true },
          end: { type: 'string', nullable: true },
        },
      },
    },
    required: ['entityType'],
  },
  
  get_dashboard_summary: {
    type: 'object',
    properties: {},
  },
  
  search_archived_events: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Text search query' },
      year: { type: 'number', description: 'Filter by year' },
      limit: { type: 'number', default: 10 },
    },
  },

  // Executive query tools for multi-step reasoning
  get_partnership_updates: {
    type: 'object',
    properties: {
      partnershipId: { type: 'number', description: 'The partnership ID to get updates for' },
      partnershipName: { type: 'string', description: 'Partnership name to search for (if ID is unknown)' },
      limit: { type: 'number', default: 5, description: 'Maximum number of updates/activities to return' },
    },
    description: 'Get recent updates, activities, and interactions for a partnership. Use this to answer "what was the last update regarding partnership X?"',
  },

  get_contact_interactions: {
    type: 'object',
    properties: {
      contactId: { type: 'number', description: 'The contact ID to get interactions for' },
      contactName: { type: 'string', description: 'Contact name to search for (if ID is unknown)' },
      interactionType: { type: 'string', description: 'Filter by interaction type (call, email, meeting, note)' },
      limit: { type: 'number', default: 5, description: 'Maximum number of interactions to return' },
    },
    description: 'Get recent interactions and communications with a contact or lead. Use this to answer "what was our last interaction with Y?"',
  },

  get_speaker_history: {
    type: 'object',
    properties: {
      contactId: { type: 'number', description: 'The contact ID to get speaker history for' },
      contactName: { type: 'string', description: 'Contact name to search for (if ID is unknown)' },
      limit: { type: 'number', default: 10, description: 'Maximum number of events to return' },
    },
    description: 'Get the events where a contact was a speaker or presenter. Use this to answer "when was the last event that Z spoke at?"',
  },

  get_lead_activities: {
    type: 'object',
    properties: {
      leadId: { type: 'number', description: 'The lead ID to get activities for' },
      leadName: { type: 'string', description: 'Lead name or organization to search for (if ID is unknown)' },
      limit: { type: 'number', default: 5, description: 'Maximum number of activities to return' },
    },
    description: 'Get recent activities, interactions, and status changes for a lead. Use this to track sales pipeline progress.',
  },

  // Analytics & Insight Tools
  get_event_risk_assessment: {
    type: 'object',
    properties: {
      eventId: { type: 'number', description: 'Specific event ID to assess (optional)' },
      daysAhead: { type: 'number', default: 30, description: 'Look at events within this many days' },
    },
    description: 'Assess risk level for upcoming events based on task completion, speaker confirmation, and department engagement. Use this to answer "which events are at risk?" or "what could go wrong with event X?"',
  },

  get_department_workload: {
    type: 'object',
    properties: {
      departmentId: { type: 'number', description: 'Specific department ID (optional, returns all if not provided)' },
    },
    description: 'Analyze department workload based on pending tasks, upcoming event assignments, and overdue items. Use this to answer "which departments are overloaded?" or "who has capacity?"',
  },

  get_expiring_agreements: {
    type: 'object',
    properties: {
      daysAhead: { type: 'number', default: 90, description: 'Look for agreements expiring within this many days' },
      includeExpired: { type: 'boolean', default: false, description: 'Include recently expired agreements' },
    },
    description: 'Find partnership agreements expiring soon or recently expired. Use for "which partnerships need renewal?" or "expiring agreements this quarter"',
  },

  get_stale_leads: {
    type: 'object',
    properties: {
      staleDays: { type: 'number', default: 30, description: 'Consider leads stale if not contacted for this many days' },
      status: { type: 'array', items: { type: 'string' }, description: 'Filter by lead status (new, contacted, qualified, proposal, negotiation)' },
    },
    description: 'Find leads that have not been contacted recently. Use for "which leads are going cold?" or "leads needing follow-up"',
  },

  get_event_timeline: {
    type: 'object',
    properties: {
      eventId: { type: 'number', description: 'Event ID to get timeline for' },
      eventName: { type: 'string', description: 'Event name to search for (if ID unknown)' },
    },
    description: 'Get a comprehensive timeline of an event including tasks, speakers, department assignments, and milestones. Use for "what is the status of event X?" or "give me an overview of the summit"',
  },

  compare_events: {
    type: 'object',
    properties: {
      eventIds: { type: 'array', items: { type: 'number' }, description: 'Array of event IDs to compare' },
      eventNames: { type: 'array', items: { type: 'string' }, description: 'Array of event names to search for (if IDs unknown)' },
    },
    description: 'Compare multiple events side by side (attendance, tasks, speakers, success metrics). Use for "compare last year summit with this year" or "which event performed better?"',
  },

  get_weekly_summary: {
    type: 'object',
    properties: {
      weekOffset: { type: 'number', default: 0, description: 'Week offset (0 = this week, -1 = last week, 1 = next week)' },
    },
    description: 'Get a comprehensive weekly summary including events, tasks due, partnership activities, and key updates. Use for "summarize this week" or "what happened last week?"',
  },

  get_partnership_analytics: {
    type: 'object',
    properties: {
      topN: { type: 'number', default: 10, description: 'Number of top partnerships to return' },
      metric: { type: 'string', enum: ['activity', 'interactions', 'events'], default: 'activity', description: 'What metric to rank by' },
    },
    description: 'Analyze partnership engagement to find most active partners, compare partnership activity levels. Use for "who is our most active partner?" or "which partnerships are performing well?"',
  },

  get_stale_partnerships: {
    type: 'object',
    properties: {
      staleDays: { type: 'number', default: 60, description: 'Consider partnerships stale if no activity for this many days' },
      status: { type: 'array', items: { type: 'string' }, description: 'Filter by partnership status (active, pending)' },
    },
    description: 'Find partnerships that have had no recent activity or interaction. Use for "which partnerships are stale?" or "partnerships needing attention"',
  },

  get_contact_analysis: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['speakers', 'vip', 'frequent'], description: 'Type of contact analysis' },
      limit: { type: 'number', default: 10, description: 'Number of contacts to return' },
    },
    description: 'Analyze contacts to find top speakers, VIP contacts, or frequently engaged contacts. Use for "who are our top speakers?" or "most engaged contacts"',
  },
} as const;

export type ToolName = keyof typeof ToolSchemas;

// ============================================================================
// Tool Result Types
// ============================================================================

export interface ToolResult {
  success: boolean;
  data: unknown;
  summary?: string;
  error?: string;
}

export interface AiTool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

// ============================================================================
// Response Types
// ============================================================================

export interface AiSource {
  id: string;
  entityType: 'event' | 'task' | 'contact' | 'partnership' | 'lead';
  title: string;
  relevanceScore: number;
  snippet?: string;
  metadata?: Record<string, unknown>;
}

export interface AiChatResponse {
  message: string;
  sources: AiSource[];
  metadata?: {
    model?: string;
    processingTime?: number;
    tokensUsed?: number;
    intent?: string;
    parsedQuery?: ParsedQuery;
    toolsUsed?: string[];
    iterations?: number;
    error?: string;
  };
}

export interface StreamingChunk {
  type: 'thinking' | 'parsing' | 'searching' | 'sources' | 'token' | 'done' | 'error' | 'status' | 'content';
  content?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface AiConfig {
  provider?: 'openai' | 'anthropic' | 'disabled';
  model?: string;
  queryParsingModel?: string;
  temperature?: number;
  maxTokens?: number;
  enableStreaming?: boolean;
  enableToolUse?: boolean;
  maxRetries?: number;
  language?: string;
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  queryParsingModel: 'gpt-4o-mini',
  temperature: 0.3,
  maxTokens: 1500,
  enableStreaming: true,
  enableToolUse: true,
  maxRetries: 2,
  language: 'en',
};
