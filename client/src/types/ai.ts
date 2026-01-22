export type AiSource = {
  id: string;
  entityType: string;
  title: string;
  snippet?: string;
  score?: number;
  relevanceScore?: number;
  metadata?: {
    startDate?: string;
    endDate?: string;
    location?: string;
    category?: string;
    eventType?: string;
    dueDate?: string;
    priority?: string;
    status?: string;
    eventTitle?: string;
    departmentName?: string;
    [key: string]: unknown;
  };
};

export type AiChatResponse = {
  answer: string;
  sources: AiSource[];
  provider: string;
  model: string;
};

export type AiIntakeType = 'event' | 'task' | 'partnership' | 'lead' | 'contact' | 'unknown';

export type AiIntakeResponse = {
  type: AiIntakeType;
  confidence: number;
  summary: string;
  fields: Record<string, string | null>;
  missingFields: string[];
  suggestions: string[];
  similar: AiSource[];
};

export type AiChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  sources?: AiSource[];
};
