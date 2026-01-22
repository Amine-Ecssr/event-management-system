/**
 * AI Orchestrator Service
 * 
 * The main service that coordinates the entire AI workflow:
 * 1. Parse user query with LLM
 * 2. Select and execute appropriate tools
 * 3. Format context for response generation
 * 4. Generate and optionally stream the response
 * 
 * This is the production-grade replacement for the naive ai-assistant.service.ts
 * 
 * @module services/ai/orchestrator
 */

import { 
  AiChatResponse, 
  AiSource, 
  ParsedQuery, 
  ToolResult,
  AiConfig,
  DEFAULT_AI_CONFIG,
  StreamingChunk,
} from './types';
import { parseQueryWithLLM, formatParsedQuery } from './query-parser';
import { TOOLS, getToolsForOpenAI, executeTool } from './tools';
import { 
  getMainSystemPrompt, 
  formatToolResultsAsContext, 
  buildUserMessageWithContext,
  getCurrentDateContext,
} from './prompts';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const RESPONSE_MODEL = process.env.AI_RESPONSE_MODEL ?? 'gpt-4o-mini';

/**
 * Determine which tools to use based on parsed query
 */
function selectToolsForQuery(parsed: ParsedQuery): string[] {
  const tools: string[] = [];

  // Map entity types to tools
  for (const entityType of parsed.entityTypes) {
    switch (entityType) {
      case 'events':
        tools.push('search_events');
        break;
      case 'tasks':
        tools.push('search_tasks');
        break;
      case 'contacts':
        tools.push('search_contacts');
        break;
      case 'partnerships':
        tools.push('search_partnerships');
        break;
      case 'leads':
        tools.push('search_leads'); // Use dedicated leads search tool
        break;
      case 'archived-events':
        tools.push('search_archived_events');
        break;
    }
  }

  // Special handling for certain intents
  if (parsed.intent === 'summarize' && parsed.entityTypes.length === 0) {
    tools.push('get_dashboard_summary');
  }

  if (parsed.intent === 'count') {
    tools.push('get_count');
  }

  // Ensure we have at least one tool
  if (tools.length === 0) {
    tools.push('search_events', 'search_tasks');
  }

  return Array.from(new Set(tools)); // Remove duplicates
}

/**
 * Build tool parameters from parsed query
 */
function buildToolParams(toolName: string, parsed: ParsedQuery): Record<string, unknown> {
  const baseParams: Record<string, unknown> = {
    query: parsed.searchText || undefined,
    limit: parsed.limit || 10,
  };

  // Add date range if present
  if (parsed.dateRange) {
    baseParams.dateRange = parsed.dateRange;
  }

  // Add filters based on tool type
  if (parsed.filters) {
    if (parsed.filters.status) {
      baseParams.status = parsed.filters.status;
    }
    if (parsed.filters.priority) {
      baseParams.priority = parsed.filters.priority;
    }
    if (parsed.filters.category) {
      baseParams.category = parsed.filters.category;
    }
  }

  // Add sort if present
  if (parsed.sortBy) {
    baseParams.sortBy = parsed.sortBy;
  }

  // Special handling for count tool
  if (toolName === 'get_count') {
    return {
      entityType: parsed.entityTypes[0] || 'events',
      status: parsed.filters?.status,
      dateRange: parsed.dateRange ? {
        start: parsed.dateRange.start,
        end: parsed.dateRange.end,
      } : undefined,
    };
  }

  return baseParams;
}

/**
 * Execute selected tools and gather results
 */
async function executeToolsForQuery(
  parsed: ParsedQuery
): Promise<Array<{ toolName: string; result: ToolResult }>> {
  const toolNames = selectToolsForQuery(parsed);
  const results: Array<{ toolName: string; result: ToolResult }> = [];

  console.log(`[AI Orchestrator] Executing tools: ${toolNames.join(', ')}`);

  // Execute tools in parallel
  const toolPromises = toolNames.map(async (toolName) => {
    const params = buildToolParams(toolName, parsed);
    console.log(`[AI Orchestrator] Tool ${toolName} params:`, JSON.stringify(params));
    
    const result = await executeTool(toolName, params);
    return { toolName, result };
  });

  const toolResults = await Promise.all(toolPromises);
  
  // Log results summary
  for (const { toolName, result } of toolResults) {
    if (result.success) {
      console.log(`[AI Orchestrator] ${toolName}: ${result.summary}`);
    } else {
      console.log(`[AI Orchestrator] ${toolName}: ERROR - ${result.error}`);
    }
  }

  return toolResults;
}

/**
 * Extract sources from tool results for citation
 * Maps tool names to frontend-compatible entity types (plural form)
 */
function extractSources(
  toolResults: Array<{ toolName: string; result: ToolResult }>
): AiSource[] {
  const sources: AiSource[] = [];

  for (const { toolName, result } of toolResults) {
    if (!result.success || !result.data) continue;

    const data = Array.isArray(result.data) ? result.data : [result.data];
    
    for (const item of data) {
      if (typeof item !== 'object' || !item) continue;
      
      const itemObj = item as Record<string, unknown>;
      
      // Determine entity type from tool name - use PLURAL form for frontend compatibility
      let entityType: AiSource['entityType'] = 'event';
      if (toolName.includes('archived')) entityType = 'event'; // archived-events handled by ID
      else if (toolName.includes('task')) entityType = 'task';
      else if (toolName.includes('contact')) entityType = 'contact';
      else if (toolName.includes('partnership')) entityType = 'partnership';
      else if (toolName.includes('lead')) entityType = 'lead';

      sources.push({
        id: String(itemObj.id || ''),
        title: String(itemObj.title || itemObj.name || 'Unknown'),
        entityType,
        relevanceScore: 1.0, // Tools return relevant results
        snippet: itemObj.description 
          ? String(itemObj.description).substring(0, 150) 
          : undefined,
        metadata: {
          // Event fields
          startDate: itemObj.startDate,
          endDate: itemObj.endDate,
          location: itemObj.location,
          category: itemObj.category,
          eventType: itemObj.eventType,
          // Task fields
          dueDate: itemObj.dueDate,
          priority: itemObj.priority,
          // Common fields
          status: itemObj.status,
          eventTitle: itemObj.eventTitle,
          departmentName: itemObj.departmentName,
        },
      });
    }
  }

  return sources.slice(0, 10); // Limit sources
}

/**
 * Generate the final response using the LLM
 */
async function generateResponse(
  userQuery: string,
  parsed: ParsedQuery,
  context: string,
  config: AiConfig = DEFAULT_AI_CONFIG
): Promise<string> {
  if (!OPENAI_API_KEY) {
    return generateFallbackResponse(parsed, context);
  }

  const systemPrompt = getMainSystemPrompt(config.language);
  const userMessage = buildUserMessageWithContext(userQuery, parsed, context);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: RESPONSE_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI Orchestrator] OpenAI error:', errorText);
      return generateFallbackResponse(parsed, context);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || generateFallbackResponse(parsed, context);
  } catch (error) {
    console.error('[AI Orchestrator] Response generation failed:', error);
    return generateFallbackResponse(parsed, context);
  }
}

/**
 * Generate a basic response when LLM is unavailable
 */
function generateFallbackResponse(parsed: ParsedQuery, context: string): string {
  if (!context || context.includes('No results found') || context.includes('No data retrieved')) {
    return `I searched for ${parsed.entityTypes.join(' and ')} but couldn't find any matching your criteria. Would you like me to search with different filters?`;
  }

  return `Here's what I found:\n\n${context}`;
}

/**
 * Stream the response for real-time output
 */
export async function* streamChatResponse(
  userQuery: string,
  config: AiConfig = DEFAULT_AI_CONFIG
): AsyncGenerator<StreamingChunk> {
  // Step 1: Parse the query
  yield { type: 'status', content: 'Understanding your question...' };
  
  const parsed = await parseQueryWithLLM(userQuery);
  console.log(`[AI Orchestrator] Parsed query: ${formatParsedQuery(parsed)}`);
  
  yield { 
    type: 'status', 
    content: `Searching ${parsed.entityTypes.join(', ')}...`,
    metadata: { parsed },
  };

  // Step 2: Execute tools
  const toolResults = await executeToolsForQuery(parsed);
  
  // Step 3: Format context
  const context = formatToolResultsAsContext(toolResults);
  
  // Step 4: Extract sources
  const sources = extractSources(toolResults);
  
  yield { 
    type: 'sources', 
    content: '',
    metadata: { sources },
  };

  // Step 5: Generate response (non-streaming for simplicity, can be enhanced)
  if (!OPENAI_API_KEY) {
    yield { type: 'content', content: generateFallbackResponse(parsed, context) };
    yield { type: 'done', content: '' };
    return;
  }

  const systemPrompt = getMainSystemPrompt(config.language);
  const userMessage = buildUserMessageWithContext(userQuery, parsed, context);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: RESPONSE_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      yield { type: 'content', content: generateFallbackResponse(parsed, context) };
      yield { type: 'done', content: '' };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'content', content: generateFallbackResponse(parsed, context) };
      yield { type: 'done', content: '' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            yield { type: 'done', content: '' };
            return;
          }

          try {
            const streamData = JSON.parse(data);
            const content = streamData.choices?.[0]?.delta?.content;
            if (content) {
              yield { type: 'content', content };
            }
          } catch {
            // Ignore JSON parse errors for incomplete chunks
          }
        }
      }
    }

    yield { type: 'done', content: '' };
  } catch (error) {
    console.error('[AI Orchestrator] Streaming error:', error);
    yield { type: 'content', content: generateFallbackResponse(parsed, context) };
    yield { type: 'done', content: '' };
  }
}

/**
 * Main chat function - non-streaming version
 */
export async function chat(
  userQuery: string,
  config: AiConfig = DEFAULT_AI_CONFIG
): Promise<AiChatResponse> {
  const startTime = Date.now();
  
  try {
    // Step 1: Parse the query with LLM
    console.log(`[AI Orchestrator] Processing query: "${userQuery}"`);
    const parsed = await parseQueryWithLLM(userQuery);
    console.log(`[AI Orchestrator] Parsed: ${formatParsedQuery(parsed)}`);

    // Step 2: Execute appropriate tools
    const toolResults = await executeToolsForQuery(parsed);

    // Step 3: Format context for response generation
    const context = formatToolResultsAsContext(toolResults);

    // Step 4: Extract sources for citation
    const sources = extractSources(toolResults);

    // Step 5: Generate the response
    const response = await generateResponse(userQuery, parsed, context, config);

    const processingTime = Date.now() - startTime;
    console.log(`[AI Orchestrator] Completed in ${processingTime}ms`);

    return {
      message: response,
      sources,
      metadata: {
        model: RESPONSE_MODEL,
        processingTime,
        tokensUsed: undefined, // Would need to track from API response
        intent: parsed.intent,
        parsedQuery: parsed,
      },
    };
  } catch (error) {
    console.error('[AI Orchestrator] Chat failed:', error);
    
    return {
      message: 'I encountered an error processing your request. Please try again.',
      sources: [],
      metadata: {
        model: RESPONSE_MODEL,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Agentic chat with tool use - allows LLM to decide which tools to call
 * This is more advanced and lets the LLM make tool selections dynamically
 */
export async function agenticChat(
  userQuery: string,
  config: AiConfig = DEFAULT_AI_CONFIG
): Promise<AiChatResponse> {
  const startTime = Date.now();
  
  if (!OPENAI_API_KEY) {
    return chat(userQuery, config); // Fall back to basic chat
  }

  const systemPrompt = getMainSystemPrompt(config.language);
  const tools = getToolsForOpenAI();
  
  const messages: Array<{ role: string; content: string; tool_call_id?: string; name?: string }> = [
    { role: 'system', content: systemPrompt + '\n\n' + getCurrentDateContext() },
    { role: 'user', content: userQuery },
  ];

  const allToolResults: Array<{ toolName: string; result: ToolResult }> = [];
  let iterations = 0;
  const maxIterations = 3;

  try {
    while (iterations < maxIterations) {
      iterations++;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: RESPONSE_MODEL,
          messages,
          tools,
          tool_choice: iterations === 1 ? 'auto' : 'auto',
          temperature: config.temperature,
          max_tokens: config.maxTokens,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message;

      if (!message) {
        throw new Error('No message in response');
      }

      // Check if the model wants to use tools
      if (message.tool_calls && message.tool_calls.length > 0) {
        // Add assistant's message with tool calls
        messages.push({
          role: 'assistant',
          content: message.content || '',
          ...message,
        });

        // Execute each tool call
        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          const toolParams = JSON.parse(toolCall.function.arguments);
          
          console.log(`[AI Agentic] Calling tool: ${toolName}`, toolParams);
          
          const result = await executeTool(toolName, toolParams);
          allToolResults.push({ toolName, result });

          // Add tool result to messages
          messages.push({
            role: 'tool',
            content: JSON.stringify(result.data),
            tool_call_id: toolCall.id,
            name: toolName,
          });
        }
      } else {
        // Model is done with tools, return the response
        const sources = extractSources(allToolResults);
        
        return {
          message: message.content || 'I processed your request but have no response.',
          sources,
          metadata: {
            model: RESPONSE_MODEL,
            processingTime: Date.now() - startTime,
            toolsUsed: allToolResults.map(r => r.toolName),
            iterations,
          },
        };
      }
    }

    // Max iterations reached, generate final response
    const finalResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: RESPONSE_MODEL,
        messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
    });

    const finalData = await finalResponse.json();
    const finalMessage = finalData.choices?.[0]?.message?.content || 'Request processed.';
    const sources = extractSources(allToolResults);

    return {
      message: finalMessage,
      sources,
      metadata: {
        model: RESPONSE_MODEL,
        processingTime: Date.now() - startTime,
        toolsUsed: allToolResults.map(r => r.toolName),
        iterations,
      },
    };
  } catch (error) {
    console.error('[AI Agentic] Error:', error);
    return {
      message: 'I encountered an error. Please try again.',
      sources: [],
      metadata: {
        model: RESPONSE_MODEL,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}
