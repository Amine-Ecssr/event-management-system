/**
 * AI Assistant Service
 *
 * Provides retrieval-augmented chat responses and shared helpers for AI endpoints.
 *
 * @module services/ai-assistant
 */

import { searchService } from './elasticsearch-search.service';
import type { SearchHit } from '../elasticsearch/types/search.types';
import { isElasticsearchEnabled } from '../elasticsearch/client';

export type AiSource = {
  id: string;
  entityType: string;
  title: string;
  snippet: string;
  score: number;
};

export type AiChatResponse = {
  answer: string;
  sources: AiSource[];
  provider: string;
  model: string;
};

const AI_CHAT_PROVIDER = process.env.AI_CHAT_PROVIDER ?? 'disabled';
const AI_CHAT_MODEL = process.env.AI_CHAT_MODEL ?? 'gpt-4o-mini';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';

export function isAiChatEnabled(): boolean {
  return AI_CHAT_PROVIDER === 'openai' && !!OPENAI_API_KEY;
}

function buildSourceTitle(hit: SearchHit): string {
  const source = hit.source as Record<string, unknown>;
  return (
    (source.name as string) ||
    (source.nameEn as string) ||
    (source.title as string) ||
    (source.titleEn as string) ||
    (source.organizationName as string) ||
    `Record ${hit.id}`
  );
}

function buildSourceSnippet(hit: SearchHit): string {
  const highlight = hit.highlight || {};
  const source = hit.source as Record<string, unknown>;

  return (
    highlight.description?.[0] ||
    highlight.notes?.[0] ||
    highlight.content?.[0] ||
    (source.description as string) ||
    (source.notes as string) ||
    (source.content as string) ||
    ''
  );
}

export function formatSources(hits: SearchHit[]): AiSource[] {
  return hits.map((hit) => ({
    id: hit.id,
    entityType: hit.entityType,
    title: buildSourceTitle(hit),
    snippet: buildSourceSnippet(hit),
    score: hit.score,
  }));
}

export async function fetchRagSources(query: string, limit = 6): Promise<AiSource[]> {
  if (!isElasticsearchEnabled()) {
    return [];
  }

  try {
    const result = await searchService.globalSearch(query, {
      pagination: { page: 1, pageSize: limit },
      includeAggregations: false,
      highlight: true,
      fuzzy: true,
    });

    return formatSources(result.hits);
  } catch (error) {
    console.warn('[AI] Failed to fetch RAG sources:', error);
    return [];
  }
}

function buildContextBlock(sources: AiSource[]): string {
  if (sources.length === 0) {
    return 'No relevant records were found in Elasticsearch.';
  }

  return sources
    .map(
      (source, index) =>
        `[${index + 1}] (${source.entityType} #${source.id}) ${source.title}\n${source.snippet || 'No snippet available.'}`,
    )
    .join('\n\n');
}

async function callOpenAiChat(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  sources: AiSource[],
): Promise<string> {
  const systemPrompt = [
    'You are the EventCal AI assistant.',
    'Answer the user using the provided context. If you are unsure, say so clearly.',
    'Cite sources inline using bracketed numbers like [1], [2].',
    'Prefer short, actionable responses tailored to event operations.',
  ].join(' ');

  const contextBlock = buildContextBlock(sources);

  const messages = [
    { role: 'system', content: `${systemPrompt}\n\nContext:\n${contextBlock}` },
    ...history.map((entry) => ({ role: entry.role, content: entry.content })),
    { role: 'user', content: message },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_CHAT_MODEL,
      messages,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || 'No response generated.';
}

function buildFallbackAnswer(message: string, sources: AiSource[]): string {
  if (sources.length === 0) {
    return [
      "I couldn't find any matching records in Elasticsearch yet.",
      'Try adding more context such as an event name, department, or date range.',
    ].join(' ');
  }

  const bullets = sources
    .map((source, index) => `${index + 1}. ${source.title} (${source.entityType})`)
    .join('\n');

  return [
    `Here are the most relevant records I found for "${message}":`,
    bullets,
    'Tell me which record to drill into or ask a follow-up question.',
  ].join('\n');
}

export async function getChatResponse(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<AiChatResponse> {
  const sources = await fetchRagSources(message);

  if (isAiChatEnabled()) {
    const answer = await callOpenAiChat(message, history, sources);
    return {
      answer,
      sources,
      provider: AI_CHAT_PROVIDER,
      model: AI_CHAT_MODEL,
    };
  }

  return {
    answer: buildFallbackAnswer(message, sources),
    sources,
    provider: 'retrieval-only',
    model: 'n/a',
  };
}
