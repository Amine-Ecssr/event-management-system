/**
 * AI Query Parser Service
 * 
 * Uses LLM function calling to parse natural language queries into
 * structured search parameters. This is the CORRECT approach - letting
 * the AI understand temporal expressions, filters, and intent rather
 * than using brittle keyword matching.
 * 
 * @module services/ai/query-parser
 */

import { z } from 'zod';
import { ParsedQuery, ParsedQuerySchema } from './types';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const QUERY_PARSING_MODEL = process.env.AI_QUERY_PARSING_MODEL ?? 'gpt-4o-mini';

/**
 * Convert Zod schema to JSON Schema for OpenAI function calling
 */
function zodToJsonSchema(schema: z.ZodObject<any>): Record<string, unknown> {
  const shape = schema.shape;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodType = value as z.ZodTypeAny;
    properties[key] = zodTypeToJsonSchema(zodType);
    
    // Check if field is required (not optional/nullable)
    if (!zodType.isOptional() && !zodType.isNullable()) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

function zodTypeToJsonSchema(zodType: z.ZodTypeAny): Record<string, unknown> {
  const description = zodType.description;
  
  // Handle optional
  if (zodType instanceof z.ZodOptional) {
    return zodTypeToJsonSchema(zodType.unwrap());
  }
  
  // Handle nullable
  if (zodType instanceof z.ZodNullable) {
    const inner = zodTypeToJsonSchema(zodType.unwrap());
    return { ...inner, nullable: true };
  }
  
  // Handle default
  if (zodType instanceof z.ZodDefault) {
    const inner = zodTypeToJsonSchema(zodType._def.innerType);
    return { ...inner, default: zodType._def.defaultValue() };
  }
  
  // Handle string
  if (zodType instanceof z.ZodString) {
    return { type: 'string', description };
  }
  
  // Handle number
  if (zodType instanceof z.ZodNumber) {
    return { type: 'number', description };
  }
  
  // Handle boolean
  if (zodType instanceof z.ZodBoolean) {
    return { type: 'boolean', description };
  }
  
  // Handle enum
  if (zodType instanceof z.ZodEnum) {
    return { type: 'string', enum: zodType._def.values, description };
  }
  
  // Handle array
  if (zodType instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodTypeToJsonSchema(zodType._def.type),
      description,
    };
  }
  
  // Handle object
  if (zodType instanceof z.ZodObject) {
    return zodToJsonSchema(zodType);
  }
  
  // Fallback
  return { type: 'string', description };
}

/**
 * System prompt for query parsing
 * This teaches the LLM how to extract structured data from natural language
 */
function getQueryParsingSystemPrompt(currentDate: string): string {
  return `You are a query parser for EventVue, an events management system for ECSSR (Emirates Center for Strategic Studies and Research).

Your job is to extract structured search parameters from natural language queries.

## Current Date
Today is ${currentDate}. Use this to calculate relative dates.

## Date Calculations
When users mention relative dates, calculate the ACTUAL ISO dates:
- "today" → ${currentDate}
- "tomorrow" → the next day
- "this week" → Monday to Sunday of the current week
- "next week" → Monday to Sunday of the coming week  
- "last week" → Monday to Sunday of the previous week
- "this month" → 1st to last day of current month
- "next month" → 1st to last day of next month
- "upcoming" or "coming up" → today to 7 days from now
- "next N days" → today to N days from now
- "Q1", "Q2", etc. → respective quarter dates
- "overdue" → implies filtering for items with dates BEFORE today

## Entity Types
- events: Conferences, seminars, workshops, meetings, forums, lectures
- tasks: Action items, to-dos, assignments with deadlines
- contacts: People in the system (speakers, attendees, partners, contacts)
- partnerships: Organizational partnerships, MoUs, collaborations, partners
- leads: Potential partnerships in the pipeline
- organizations: Partner organizations (use partnerships)
- archived-events: Past/completed/historical events

## Event Categories (ECSSR)
When users ask about event types or categories, map to these:
- "Exhibitions & Conferences" - for exhibitions, expos, conferences
- "Culture and Heritage" - for cultural events, heritage programs
- "Social Development" - for community, social programs
- "Energy and Environment" - for sustainability, energy events
- "General" - for general/unspecified events
- "Policy Forum" - for policy discussions, forums
- "Book Launch" - for book launches, publications
- "Youth Lab" - for youth programs, labs
- "Training Program" - for training, workshops, courses
- "Public Lecture" - for lectures, talks, speeches

## Intent Classification
- search: User wants to find matching records
- list: User wants a list of items (similar to search but often with filters)
- count: User wants to know HOW MANY match criteria
- summarize: User wants an overview or summary
- analyze: User wants insights or analytics
- detail: User wants details about a specific item
- compare: User wants to compare multiple items

## Status Values
Events: draft, confirmed, cancelled
Tasks: pending, in_progress, completed, blocked
Partnerships: pending, active, inactive, expired
Leads: new, contacted, qualified, proposal, negotiation, won, lost

## Priority Values
Tasks: low, medium, high, critical

## Examples

Query: "What events do we have next week?"
→ entityTypes: ["events"], dateRange: {start: "2025-01-06", end: "2025-01-12", field: "startDate"}, intent: "list"

Query: "Show me overdue high priority tasks"
→ entityTypes: ["tasks"], dateRange: {start: null, end: "${currentDate}", field: "dueDate"}, filters: {priority: ["high"]}, intent: "list"

Query: "How many partnerships are pending approval?"
→ entityTypes: ["partnerships"], filters: {status: ["pending"]}, intent: "count"

Query: "Find contacts from Abu Dhabi University"
→ entityTypes: ["contacts"], searchText: "Abu Dhabi University", intent: "search"

Query: "Show me all energy related events happening next year in Abu Dhabi"
→ entityTypes: ["events"], searchText: "energy", filters: {category: "Energy and Environment"}, dateRange: {start: "2026-01-01", end: "2026-12-31", field: "startDate"}, intent: "list"

Query: "Anything energy related"
→ entityTypes: ["events"], searchText: "energy", filters: {category: "Energy and Environment"}, intent: "search"

Query: "Summarize the events for Q1 2025"
→ entityTypes: ["events"], dateRange: {start: "2025-01-01", end: "2025-03-31", field: "startDate"}, intent: "summarize"

Query: "What's happening tomorrow?"
→ entityTypes: ["events", "tasks"], dateRange: {start: tomorrow's date, end: tomorrow's date, field: "startDate"}, intent: "list"

IMPORTANT:
- Always calculate actual dates, never return relative terms like "next week"
- If no entity type is obvious, include the most likely types based on context
- searchText SHOULD include topic/subject keywords (energy, culture, conference, etc.) even when setting a category filter
- The searchText helps find events that match the topic semantically (e.g., "World Future Energy Summit" matches "energy")
- If the query is asking about quantity, set intent to "count"
- For Arabic queries, still return the parsed structure in English`;
}

/**
 * Parse a natural language query using LLM function calling
 * 
 * This is the PRODUCTION-GRADE approach - using AI to understand
 * the query rather than brittle regex/keyword matching.
 */
export async function parseQueryWithLLM(userQuery: string): Promise<ParsedQuery> {
  if (!OPENAI_API_KEY) {
    console.warn('[AI Query Parser] No API key, using fallback parsing');
    return fallbackParsing(userQuery);
  }

  const currentDate = new Date().toISOString().split('T')[0];
  const systemPrompt = getQueryParsingSystemPrompt(currentDate);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: QUERY_PARSING_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuery },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'parse_search_query',
            description: 'Parse a natural language query into structured search parameters',
            parameters: {
              type: 'object',
              properties: {
                searchText: {
                  type: 'string',
                  description: 'Keywords to search for, excluding temporal/filter terms',
                },
                entityTypes: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['events', 'tasks', 'contacts', 'partnerships', 'leads', 'organizations', 'archived-events'],
                  },
                  description: 'Which entity types to search',
                },
                dateRange: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    start: { type: 'string', nullable: true, description: 'Start date (YYYY-MM-DD)' },
                    end: { type: 'string', nullable: true, description: 'End date (YYYY-MM-DD)' },
                    field: { 
                      type: 'string', 
                      enum: ['startDate', 'endDate', 'dueDate', 'createdAt'],
                      description: 'Which date field to filter on',
                    },
                  },
                  description: 'Date range filter with actual ISO dates',
                },
                filters: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    status: { type: 'array', items: { type: 'string' }, nullable: true },
                    priority: { type: 'array', items: { type: 'string' }, nullable: true },
                    department: { type: 'string', nullable: true },
                    category: { type: 'string', nullable: true },
                  },
                },
                intent: {
                  type: 'string',
                  enum: ['search', 'count', 'summarize', 'compare', 'analyze', 'list', 'detail'],
                  description: 'What kind of response the user expects',
                },
                sortBy: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    field: { type: 'string' },
                    direction: { type: 'string', enum: ['asc', 'desc'] },
                  },
                },
                limit: {
                  type: 'number',
                  default: 10,
                  description: 'Max results to return',
                },
              },
              required: ['searchText', 'entityTypes', 'intent'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'parse_search_query' } },
        temperature: 0.1, // Low temperature for consistent parsing
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI Query Parser] OpenAI error:', errorText);
      return fallbackParsing(userQuery);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.warn('[AI Query Parser] No tool call in response');
      return fallbackParsing(userQuery);
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    
    // Validate and set defaults
    return {
      searchText: parsed.searchText || '',
      entityTypes: parsed.entityTypes || ['events', 'tasks'],
      dateRange: parsed.dateRange || null,
      filters: parsed.filters || null,
      intent: parsed.intent || 'search',
      sortBy: parsed.sortBy || null,
      limit: parsed.limit || 10,
    };
  } catch (error) {
    console.error('[AI Query Parser] Failed:', error);
    return fallbackParsing(userQuery);
  }
}

/**
 * Fallback parsing when LLM is unavailable
 * This is ONLY used as a backup - the LLM approach is primary
 */
function fallbackParsing(query: string): ParsedQuery {
  const lowerQuery = query.toLowerCase();
  
  // Detect entity types from keywords
  const entityTypes: ParsedQuery['entityTypes'] = [];
  if (lowerQuery.includes('event')) entityTypes.push('events');
  if (lowerQuery.includes('task')) entityTypes.push('tasks');
  if (lowerQuery.includes('contact')) entityTypes.push('contacts');
  if (lowerQuery.includes('partner')) entityTypes.push('partnerships');
  if (lowerQuery.includes('lead')) entityTypes.push('leads');
  
  // Default to events and tasks if nothing detected
  if (entityTypes.length === 0) {
    entityTypes.push('events', 'tasks');
  }

  // Detect intent
  let intent: ParsedQuery['intent'] = 'search';
  if (lowerQuery.includes('how many') || lowerQuery.includes('count')) {
    intent = 'count';
  } else if (lowerQuery.includes('summar')) {
    intent = 'summarize';
  } else if (lowerQuery.includes('list') || lowerQuery.includes('show') || lowerQuery.includes('what')) {
    intent = 'list';
  }

  return {
    searchText: query, // Use full query as search text in fallback
    entityTypes,
    dateRange: null, // Cannot reliably parse dates without LLM
    filters: null,
    intent,
    sortBy: null,
    limit: 10,
  };
}

/**
 * Format parsed query for logging/debugging
 */
export function formatParsedQuery(parsed: ParsedQuery): string {
  const parts: string[] = [];
  
  parts.push(`Intent: ${parsed.intent}`);
  parts.push(`Entities: ${parsed.entityTypes.join(', ')}`);
  
  if (parsed.searchText) {
    parts.push(`Search: "${parsed.searchText}"`);
  }
  
  if (parsed.dateRange) {
    const { start, end, field } = parsed.dateRange;
    parts.push(`Date filter (${field}): ${start || '*'} to ${end || '*'}`);
  }
  
  if (parsed.filters) {
    const filters = Object.entries(parsed.filters)
      .filter(([_, v]) => v)
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : v}`)
      .join(', ');
    if (filters) parts.push(`Filters: ${filters}`);
  }
  
  return parts.join(' | ');
}
