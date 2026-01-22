/**
 * AI Prompts Module
 * 
 * Contains all system prompts, templates, and few-shot examples
 * for the AI assistant. Well-crafted prompts are critical for
 * reliable AI behavior.
 * 
 * @module services/ai/prompts
 */

import { ParsedQuery, AiSource, ToolResult } from './types';

/**
 * Get the current date formatted for prompts
 */
export function getCurrentDateContext(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  const formattedDate = now.toLocaleDateString('en-US', options);
  const isoDate = now.toISOString().split('T')[0];

  return `Current date: ${formattedDate} (${isoDate})`;
}

/**
 * Get dynamic example dates for prompts
 * These are generated relative to the current date
 */
function getExampleDates(): {
  nextWeekStart: string;
  nextWeekEnd: string;
  upcomingEvent1: string;
  upcomingEvent2Start: string;
  upcomingEvent2End: string;
  overdueDate1: string;
  overdueDate2: string;
  overdueDate3: string;
  futureDue: string;
} {
  const now = new Date();

  // Next week dates
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + (8 - now.getDay()) % 7 || 7);
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);

  // Upcoming event dates (2-3 weeks out)
  const event1 = new Date(now);
  event1.setDate(now.getDate() + 14);

  const event2Start = new Date(now);
  event2Start.setDate(now.getDate() + 30);
  const event2End = new Date(event2Start);
  event2End.setDate(event2Start.getDate() + 60);

  // Overdue dates (past)
  const overdue1 = new Date(now);
  overdue1.setDate(now.getDate() - 5);
  const overdue2 = new Date(now);
  overdue2.setDate(now.getDate() - 9);
  const overdue3 = new Date(now);
  overdue3.setDate(now.getDate() - 7);

  // Future due date
  const futureDue = new Date(now);
  futureDue.setDate(now.getDate() + 10);

  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const formatShortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return {
    nextWeekStart: formatShortDate(nextMonday),
    nextWeekEnd: formatShortDate(nextSunday),
    upcomingEvent1: `${formatDate(event1)}`,
    upcomingEvent2Start: formatDate(event2Start),
    upcomingEvent2End: formatDate(event2End),
    overdueDate1: formatShortDate(overdue1),
    overdueDate2: formatShortDate(overdue2),
    overdueDate3: formatShortDate(overdue3),
    futureDue: formatShortDate(futureDue),
  };
}

/**
 * Main system prompt for the AI assistant
 * This establishes identity, capabilities, and response guidelines
 */
export function getMainSystemPrompt(userLanguage: string = 'en'): string {
  const dateContext = getCurrentDateContext();
  const exampleDates = getExampleDates();

  const languageInstruction = userLanguage === 'ar'
    ? 'The user prefers Arabic. Respond in Arabic when appropriate, but you can use English for technical terms.'
    : 'Respond in English unless the user writes in another language.';
  
  return `You are the AI Assistant for EventVue, an events management system for ECSSR (Emirates Center for Strategic Studies and Research).

## Context
${dateContext}
${languageInstruction}

## CRITICAL: Language Response Rule
- ALWAYS detect the language of the user's message
- If the user writes in Arabic, respond ENTIRELY in Arabic (use Arabic script)
- If the user writes in English, respond in English
- For Arabic responses, translate all labels (Date, Location, Category, etc.) to Arabic
- Keep proper nouns (event names, locations, organization names) as-is or transliterate appropriately

## Your Capabilities
You can help users with:
- Finding events, tasks, contacts, and partnerships
- Answering questions about schedules and deadlines
- Providing summaries and analytics
- Helping with event planning and coordination

## Response Guidelines

### Be Accurate
- ONLY use information from the provided context
- If information is not in the context, say "I don't have that information"
- Never make up event names, dates, or details

### Be Helpful
- Provide actionable information when possible
- If results are empty, suggest alternative searches
- For dates, mention both the day and actual date (e.g., "Monday, January 6th")

### Be Concise
- Lead with the most important information
- Use bullet points for lists of items
- Keep summaries brief but informative

### Handle Edge Cases
- If no results found: "I couldn't find any [entity] matching your criteria. Would you like me to search with different filters?"
- If query is unclear: "Could you clarify what you're looking for? Are you asking about [option A] or [option B]?"
- If you detect a potential mistake: "Just to confirm, you're asking about [interpretation]. Is that correct?"

## Formatting Rules (IMPORTANT)
Your responses will be rendered with markdown support AND can include structured data blocks.

### Structured Data Blocks (REQUIRED for Entity Lists)
When listing events, tasks, or other entities, ALWAYS include a structured data block that the UI can parse:

\`\`\`eventvue-data
{
  "type": "events",
  "items": [
    {
      "id": 123,
      "title": "Event Name",
      "startDate": "2025-01-14",
      "endDate": "2025-01-16",
      "location": "ADNEC, Abu Dhabi",
      "category": "Energy and Environment",
      "status": "confirmed"
    }
  ]
}
\`\`\`

The data block should appear AFTER your text response. Always include it when returning lists of entities.

### For Lists of Events/Items:
- Use numbered lists (1. 2. 3.) for ordered results
- Put the main title in **bold**: **Event Name**
- Use bullet points (-) for sub-details under each item
- Keep each detail on its own line

### Example Format for Events:
1. **World Future Energy Summit**
   - Date: ${exampleDates.upcomingEvent1}
   - Location: ADNEC, Abu Dhabi
   - Category: Energy and Environment

2. **Sheikh Zayed Festival**
   - Date: ${exampleDates.upcomingEvent2Start} - ${exampleDates.upcomingEvent2End}
   - Location: Al Wathba, Abu Dhabi
   - Category: Culture and Heritage

### Example Format for Tasks:
1. **Confirm venue booking** ⏳
   - Due: ${exampleDates.futureDue}
   - Event: World Future Energy Summit
   - Priority: High

### General Rules:
- Use **bold** for titles, names, and important values
- Format dates as: "January 6, 2025" or "Jan 6-8, 2025" for ranges
- Task status emojis: ✅ completed, 🔄 in progress, ⏳ pending, 🚫 blocked
- Keep responses concise - no unnecessary prose
- Start with a brief summary sentence if helpful

## Domain Knowledge
- Events have: title, description, dates, location, status (draft/confirmed/cancelled), category, department
- Tasks have: title, description, due date, status (pending/in_progress/completed/blocked), priority (low/medium/high/critical), assignees
- Contacts have: name, email, organization, role, type, can be speakers at events
- Partnerships have: name, organization, status (pending/active/inactive/expired), dates, activities, interactions
- Leads have: name, email, organization, status (new/contacted/qualified/proposal/negotiation/won/lost), interactions

## Executive-Level Queries
For executive questions requiring deeper insights, use specialized tools:
- "What was the last update on partnership X?" → Use get_partnership_updates
- "What was our last interaction with Y?" → Use get_contact_interactions or get_lead_activities
- "When was the last event that Z spoke at?" → Use get_speaker_history
- "What's the status of lead ABC?" → Use get_lead_activities

For complex queries:
1. Search for the entity by name first if needed
2. Use detailed tools to get updates/interactions
3. Synthesize into a clear executive summary

## Important
You are NOT a general-purpose AI. Stay focused on EventVue data and event management topics. Politely redirect off-topic questions.`;
}

/**
 * Format tool results into readable context for the AI
 */
export function formatToolResultsAsContext(
  toolResults: Array<{ toolName: string; result: ToolResult }>
): string {
  const sections: string[] = [];

  for (const { toolName, result } of toolResults) {
    if (!result.success) {
      sections.push(`## ${toolName} (Error)\n${result.error}`);
      continue;
    }

    const data = result.data;
    if (!data) continue;

    if (Array.isArray(data)) {
      if (data.length === 0) {
        sections.push(`## ${toolName}\nNo results found.`);
      } else {
        sections.push(`## ${toolName} (${data.length} results)\n${formatDataArray(data)}`);
      }
    } else if (typeof data === 'object') {
      sections.push(`## ${toolName}\n${formatDataObject(data as Record<string, unknown>)}`);
    } else {
      sections.push(`## ${toolName}\n${String(data)}`);
    }
  }

  return sections.join('\n\n---\n\n');
}

function formatDataArray(data: unknown[]): string {
  return data.map((item, index) => {
    if (typeof item === 'object' && item !== null) {
      return `${index + 1}. ${formatDataObject(item as Record<string, unknown>)}`;
    }
    return `${index + 1}. ${String(item)}`;
  }).join('\n\n');
}

function formatDataObject(obj: Record<string, unknown>): string {
  const lines: string[] = [];
  
  // Priority fields to show first
  const priorityFields = ['title', 'name', 'id', 'status', 'startDate', 'dueDate', 'priority'];
  
  for (const field of priorityFields) {
    if (obj[field] !== undefined && obj[field] !== null) {
      lines.push(`**${formatFieldName(field)}**: ${formatValue(obj[field])}`);
    }
  }
  
  // Then show remaining fields
  for (const [key, value] of Object.entries(obj)) {
    if (!priorityFields.includes(key) && value !== undefined && value !== null) {
      lines.push(`${formatFieldName(key)}: ${formatValue(value)}`);
    }
  }
  
  return lines.join('\n');
}

function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function formatValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  }
  
  if (typeof value === 'string') {
    // Check if it's a date string
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric',
          year: 'numeric'
        });
      }
    }
    return value;
  }
  
  if (Array.isArray(value)) {
    return value.map(formatValue).join(', ');
  }
  
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  
  return String(value);
}

/**
 * Build the user message with context from tools
 */
export function buildUserMessageWithContext(
  originalQuery: string,
  parsedQuery: ParsedQuery,
  context: string
): string {
  return `## User Query
"${originalQuery}"

## Query Understanding
- Intent: ${parsedQuery.intent}
- Entity Types: ${parsedQuery.entityTypes.join(', ')}
${parsedQuery.dateRange ? `- Date Range: ${parsedQuery.dateRange.start || '*'} to ${parsedQuery.dateRange.end || '*'} (${parsedQuery.dateRange.field})` : ''}
${parsedQuery.filters ? `- Filters: ${JSON.stringify(parsedQuery.filters)}` : ''}

## Retrieved Data
${context || 'No data retrieved.'}

## Instructions
Based on the data above, provide a helpful response to the user's query. If no relevant data was found, explain that and suggest alternatives.`;
}

/**
 * Few-shot examples for query understanding
 * Returns dynamic examples with dates relative to current date
 */
export function getQueryExamples(): Array<{ query: string; response: string }> {
  const dates = getExampleDates();

  return [
    {
      query: "What events do we have next week?",
      response: `Here are the events scheduled for next week (${dates.nextWeekStart}-${dates.nextWeekEnd}):\n\n• **Annual Strategy Summit** - Monday at ECSSR Main Hall\n• **Partnership Review Meeting** - Wednesday at Conference Room B\n• **AI Workshop** - Friday at Training Center\n\nWould you like more details about any of these events?`,
    },
    {
      query: "Show me overdue tasks",
      response: `You have 3 overdue tasks that need attention:\n\n🚫 **Finalize keynote speaker contract** - Due ${dates.overdueDate1} (5 days overdue)\n  Priority: High | Event: Annual Strategy Summit\n\n🚫 **Send venue confirmation** - Due ${dates.overdueDate2} (9 days overdue)\n  Priority: Medium | Event: Partnership Review Meeting\n\n🚫 **Update attendee list** - Due ${dates.overdueDate3} (7 days overdue)\n  Priority: Low | Event: AI Workshop\n\nWould you like me to help prioritize these or provide more details?`,
    },
    {
      query: "How many active partnerships do we have?",
      response: "You currently have **12 active partnerships**.\n\nHere's a quick breakdown:\n• Academic partnerships: 5\n• Corporate partnerships: 4\n• Government partnerships: 3\n\nWould you like to see the list of active partnerships or get details on a specific one?",
    },
  ];
}

// Backward compatibility export (deprecated - use getQueryExamples() instead)
export const QUERY_EXAMPLES = getQueryExamples();

/**
 * Error response templates
 */
export const ERROR_RESPONSES = {
  noResults: (entityType: string, suggestion?: string) => 
    `I couldn't find any ${entityType} matching your criteria.${suggestion ? ` ${suggestion}` : ' Would you like me to search with different filters?'}`,
  
  searchError: (entityType: string) =>
    `I encountered an issue while searching for ${entityType}. Please try again in a moment.`,
  
  unclear: (options: string[]) =>
    `I'm not sure what you're looking for. Are you asking about:\n${options.map(o => `• ${o}`).join('\n')}`,
  
  offTopic: 
    `I'm designed to help with EventVue event management tasks. I can help you find events, tasks, contacts, and partnerships. What would you like to know?`,
};

/**
 * Prompt for intake/suggestions parsing
 */
export function getIntakeParsingPrompt(): string {
  return `You are analyzing user input to extract potential event-related information.

## Task
Extract any actionable suggestions, concerns, or event ideas from the user's input.

## Response Format
Return a JSON object with:
- suggestions: Array of extracted suggestions/ideas
- category: The main topic category (event, task, partnership, feedback, other)
- sentiment: positive, negative, or neutral
- priority: low, medium, or high based on urgency indicators

## Example
Input: "We should organize a workshop on AI before the end of Q1. It's urgent because the technology is evolving fast."
Output: {
  "suggestions": ["Organize AI workshop before end of Q1"],
  "category": "event",
  "sentiment": "positive",
  "priority": "high"
}`;
}
