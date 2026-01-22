/**
 * AI Services Module
 * 
 * Main export file for the AI service layer.
 * Provides a clean, production-ready API for AI operations.
 * 
 * @module services/ai
 */

// Types
export * from './types';

// Query parsing
export { parseQueryWithLLM, formatParsedQuery } from './query-parser';

// Tools
export { TOOLS, getToolsForOpenAI, executeTool } from './tools';

// Prompts
export { 
  getMainSystemPrompt, 
  formatToolResultsAsContext, 
  buildUserMessageWithContext,
  getCurrentDateContext,
  getIntakeParsingPrompt,
  QUERY_EXAMPLES,
  ERROR_RESPONSES,
} from './prompts';

// Orchestrator - main entry points
export { 
  chat, 
  agenticChat, 
  streamChatResponse,
} from './orchestrator';

// Re-export main functions under a namespace for backwards compatibility
import { chat, agenticChat, streamChatResponse } from './orchestrator';
import { parseQueryWithLLM } from './query-parser';
import type { AiChatResponse, AiConfig, ParsedQuery } from './types';

/**
 * AI Assistant Service - Production API
 * 
 * This provides a clean interface to the AI functionality.
 * Use this instead of direct function imports when possible.
 */
export const AiAssistant = {
  /**
   * Process a chat message and return a response
   * Uses LLM query parsing → tool execution → response generation
   */
  chat,
  
  /**
   * Process a chat message using the agentic approach
   * Allows the LLM to decide which tools to call dynamically
   */
  agenticChat,
  
  /**
   * Stream a chat response for real-time output
   * Yields chunks that can be sent via SSE or WebSocket
   */
  streamChatResponse,
  
  /**
   * Parse a query without executing tools or generating a response
   * Useful for understanding what the user is asking
   */
  parseQuery: parseQueryWithLLM,
};

export default AiAssistant;
