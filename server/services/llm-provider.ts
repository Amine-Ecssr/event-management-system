/**
 * LLM Provider Abstraction
 *
 * Unified interface for different LLM providers (OpenAI, Anthropic, etc.)
 * Makes it easy to switch or add new providers in the future.
 *
 * Features:
 * - Automatic retry with exponential backoff for transient failures
 * - Request timeout handling
 * - Rate limit detection and handling
 * - Detailed error classification
 *
 * @module services/llm-provider
 */

import OpenAI from 'openai';

// ============================================================
// Error Types
// ============================================================

export type LLMErrorType =
  | 'rate_limit'      // Rate limit exceeded, should retry after delay
  | 'timeout'         // Request timed out
  | 'api_error'       // API returned an error
  | 'network_error'   // Network connectivity issue
  | 'invalid_request' // Bad request (shouldn't retry)
  | 'auth_error'      // Authentication failed
  | 'unknown';        // Unknown error

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly type: LLMErrorType,
    public readonly retryable: boolean = false,
    public readonly retryAfterMs?: number,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

// ============================================================
// Retry Configuration
// ============================================================

const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  timeoutMs: 60000, // 60 second default timeout
};

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateBackoff(attempt: number, config: typeof DEFAULT_RETRY_CONFIG): number {
  const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // Add up to 30% jitter
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Classify error and determine if it's retryable
 */
function classifyError(error: unknown): LLMError {
  if (error instanceof LLMError) {
    return error;
  }

  // OpenAI specific error handling
  if (error instanceof OpenAI.APIError) {
    const statusCode = error.status;

    // Rate limit
    if (statusCode === 429) {
      const retryAfter = parseInt(error.headers?.['retry-after'] || '5', 10) * 1000;
      return new LLMError(
        'Rate limit exceeded. Please try again shortly.',
        'rate_limit',
        true,
        retryAfter,
        statusCode
      );
    }

    // Server errors (5xx) - retryable
    if (statusCode && statusCode >= 500) {
      return new LLMError(
        `OpenAI server error: ${error.message}`,
        'api_error',
        true,
        undefined,
        statusCode
      );
    }

    // Auth errors
    if (statusCode === 401 || statusCode === 403) {
      return new LLMError(
        'Authentication failed. Please check your API key.',
        'auth_error',
        false,
        undefined,
        statusCode
      );
    }

    // Bad request
    if (statusCode === 400) {
      return new LLMError(
        `Invalid request: ${error.message}`,
        'invalid_request',
        false,
        undefined,
        statusCode
      );
    }

    return new LLMError(
      error.message,
      'api_error',
      false,
      undefined,
      statusCode
    );
  }

  // Timeout errors
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return new LLMError(
        'Request timed out. Please try again.',
        'timeout',
        true
      );
    }

    if (error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('network')) {
      return new LLMError(
        'Network error. Please check your connection.',
        'network_error',
        true
      );
    }
  }

  return new LLMError(
    error instanceof Error ? error.message : 'Unknown error occurred',
    'unknown',
    false
  );
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Request timeout in milliseconds (default: 60000) */
  timeoutMs?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
}

/**
 * Base LLM Provider Interface
 */
export interface LLMProvider {
  name: string;
  chat(messages: LLMMessage[], config?: LLMConfig): Promise<LLMResponse>;
  isAvailable(): boolean;
}

/**
 * OpenAI Provider Implementation
 */
class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private client: OpenAI | null = null;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async chat(messages: LLMMessage[], config?: LLMConfig): Promise<LLMResponse> {
    if (!this.client) {
      throw new LLMError('OpenAI API key not configured', 'auth_error', false);
    }

    const maxRetries = config?.maxRetries ?? DEFAULT_RETRY_CONFIG.maxRetries;
    const timeoutMs = config?.timeoutMs ?? DEFAULT_RETRY_CONFIG.timeoutMs;

    let lastError: LLMError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();

        // Create abort controller for timeout
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

        try {
          const response = await this.client.chat.completions.create(
            {
              model: config?.model || 'gpt-4o-mini',
              messages: messages.map(m => ({
                role: m.role,
                content: m.content,
              })),
              temperature: config?.temperature ?? 0.3,
              max_tokens: config?.maxTokens ?? 1000,
            },
            { signal: abortController.signal }
          );

          clearTimeout(timeoutId);

          const choice = response.choices[0];
          if (!choice?.message?.content) {
            throw new LLMError('Empty response from OpenAI', 'api_error', true);
          }

          const duration = Date.now() - startTime;
          const usage = response.usage ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          } : undefined;

          // Log token usage for cost monitoring
          if (usage) {
            console.log('[OpenAI Usage]', {
              model: response.model,
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              totalTokens: usage.totalTokens,
              durationMs: duration,
              attempt: attempt + 1,
              // Approximate cost calculation (prices as of 2025)
              // gpt-4o-mini: $0.150 / 1M input, $0.600 / 1M output
              estimatedCostUSD: response.model.includes('gpt-4o-mini')
                ? ((usage.promptTokens * 0.15 + usage.completionTokens * 0.60) / 1_000_000).toFixed(6)
                : 'N/A',
            });
          }

          return {
            content: choice.message.content,
            model: response.model,
            usage,
          };
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        lastError = classifyError(error);

        // Log retry attempt
        if (lastError.retryable && attempt < maxRetries) {
          const delay = lastError.retryAfterMs || calculateBackoff(attempt, DEFAULT_RETRY_CONFIG);
          console.warn(`[OpenAI Retry] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${lastError.message}. Retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        // Don't retry non-retryable errors
        if (!lastError.retryable) {
          throw lastError;
        }
      }
    }

    // All retries exhausted
    throw lastError || new LLMError('All retry attempts failed', 'unknown', false);
  }
}

/**
 * Anthropic Provider Implementation (Placeholder for future)
 */
class AnthropicProvider implements LLMProvider {
  name = 'anthropic';

  isAvailable(): boolean {
    return false; // Not implemented yet
  }

  async chat(messages: LLMMessage[], config?: LLMConfig): Promise<LLMResponse> {
    throw new Error('Anthropic provider not implemented yet');
  }
}

/**
 * LLM Service - Main entry point
 * 
 * Automatically selects the first available provider.
 * Easy to extend with new providers in the future.
 */
class LLMService {
  private providers: LLMProvider[];
  private activeProvider: LLMProvider | null = null;

  constructor() {
    // Initialize all providers
    this.providers = [
      new OpenAIProvider(),
      new AnthropicProvider(),
      // Add more providers here in the future
    ];

    // Select first available provider
    this.activeProvider = this.providers.find(p => p.isAvailable()) || null;
  }

  isAvailable(): boolean {
    return this.activeProvider !== null;
  }

  getProviderName(): string {
    return this.activeProvider?.name || 'none';
  }

  async chat(messages: LLMMessage[], config?: LLMConfig): Promise<LLMResponse> {
    if (!this.activeProvider) {
      throw new Error('No LLM provider available. Please configure an API key.');
    }

    return this.activeProvider.chat(messages, config);
  }

  /**
   * Helper method for simple prompts
   */
  async complete(prompt: string, config?: LLMConfig): Promise<string> {
    const response = await this.chat([
      { role: 'user', content: prompt }
    ], config);
    return response.content;
  }
}

// Export singleton instance
export const llm = new LLMService();

// Export for testing/advanced usage
export { OpenAIProvider, AnthropicProvider };
