# AI Features Setup and Configuration

This document describes the AI-powered features in EventVue and how to configure them.

## Overview

EventVue includes two main AI features:

1. **AI Chat Assistant** - RAG-powered chatbot for querying your data using natural language
2. **AI Intake Assistant** - Automatically extract structured data from pasted text to create events, tasks, partnerships, and leads

## Architecture

The AI system uses a Retrieval-Augmented Generation (RAG) architecture:

```
User Query → LLM Query Parser → Tool Selection → Elasticsearch Search → Context Building → LLM Response
```

- **LLM Provider Abstraction**: Supports OpenAI (with easy extensibility for other providers)
- **Query Parser**: Uses LLM function calling to parse natural language into structured search parameters
- **Tool System**: Modular tools for searching events, tasks, contacts, partnerships
- **Orchestrator**: Coordinates the entire workflow from query to response
- **Graceful Fallback**: Works in retrieval-only mode when OpenAI is not configured

## Environment Variables

### Required for Full AI Functionality

```bash
# OpenAI Configuration (required for LLM features)
OPENAI_API_KEY=sk-your-api-key-here

# AI Provider Selection (default: disabled)
AI_CHAT_PROVIDER=openai  # Set to 'openai' to enable AI chat

# Model Configuration (optional - sensible defaults provided)
AI_CHAT_MODEL=gpt-4o-mini              # Model for chat responses
AI_QUERY_PARSING_MODEL=gpt-4o-mini    # Model for query parsing
AI_RESPONSE_MODEL=gpt-4o-mini          # Model for response generation
```

### Optional Configuration

```bash
# If not set, AI features will operate in "retrieval-only" mode
# This mode still works but provides only Elasticsearch results without AI-generated responses
```

## Setup Instructions

### 1. Obtain an OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an account or sign in
3. Navigate to API Keys section
4. Create a new API key
5. **Important**: Keep this key secure - never commit it to version control

### 2. Configure Environment Variables

#### For Development (docker-compose.dev.yml)

Add to `.env.development.local` (create if doesn't exist):

```bash
OPENAI_API_KEY=sk-your-actual-key-here
AI_CHAT_PROVIDER=openai
```

**Note**: `.env.development.local` is gitignored and safe for secrets.

#### For Production (docker-compose.yml)

Add to your secure secrets management system or `.env.production.local`:

```bash
OPENAI_API_KEY=sk-your-actual-key-here
AI_CHAT_PROVIDER=openai
```

### 3. Install Dependencies

Dependencies are already included in `package.json`:
- `openai` - Official OpenAI SDK
- `dompurify` - XSS protection for markdown rendering

Run:
```bash
npm install
```

### 4. Database Migrations

The AI chat history tables are automatically created via migration `0020_add_ai_chat_history.sql`:
- `ai_chat_conversations` - Stores conversation threads per user
- `ai_chat_messages` - Stores individual messages with sources

No manual action needed - migrations run on server start.

### 5. Start the Application

```bash
# Development
npm run dev

# Production
docker-compose up -d
```

## Features

### AI Chat Assistant

**Location**: `/admin/ai`

**Capabilities**:
- Natural language queries over your events, tasks, partnerships, contacts
- Temporal queries: "What events are coming up next week?"
- Filter queries: "Show me high priority tasks"
- Summarization: "Summarize this month's events"
- Conversation history persisted per user
- Source citation with direct links to records

**Example Queries**:
```
- "What events are scheduled for next week?"
- "Show me overdue tasks"
- "List partnerships signed in Q4"
- "Find contacts who are eligible speakers"
- "Summarize upcoming conferences"
```

**Rate Limiting**: 20 requests per minute per user (in-memory)

### AI Intake Assistant

**Location**: `/admin/ai/intake`

**Capabilities**:
- Paste unstructured text (emails, notes, messages)
- Select entity type (Event, Task, Partnership, Lead, Contact)
- AI extracts and pre-fills form fields
- Supports bilingual extraction (English ↔ Arabic)
- Validates and suggests missing fields
- One-click creation with confirmation

**Example Input**:
```
Annual Technology Summit on March 15, 2025 at Dubai Convention Center. 
Expected 500 attendees. Topics include AI, Cloud Computing, and Digital Transformation. 
Organized by TechHub UAE. The event will run from 9:00 AM to 5:00 PM.
```

**Output**: Pre-filled event form with name, date, location, time, attendees, etc.

## Security

### XSS Protection
- All AI-generated markdown is sanitized using DOMPurify
- Text content is escaped before rendering
- React's built-in XSS protection for JSX elements
- Structured data blocks are validated and sanitized

### API Key Security
- API keys stored in environment variables only
- Never exposed to client-side code
- Not logged in production
- Passed securely in Authorization headers

### Authentication & Authorization
- All AI endpoints require authentication (`isAuthenticated` middleware)
- User-scoped data access (users can only access their own conversations)
- Foreign key constraints prevent data leakage
- Input validation with Zod schemas

### Rate Limiting
- 20 requests per minute per user
- In-memory implementation (suitable for single-instance deployments)
- Returns HTTP 429 with Retry-After header when exceeded
- **Note**: For multi-instance production deployments, consider Redis-backed rate limiting

## Cost Monitoring

Token usage is automatically logged to console with cost estimates:

```json
{
  "model": "gpt-4o-mini",
  "promptTokens": 450,
  "completionTokens": 200,
  "totalTokens": 650,
  "durationMs": 1250,
  "estimatedCostUSD": "0.000188"
}
```

**Model Pricing** (as of Dec 2024):
- gpt-4o-mini: $0.150 / 1M input tokens, $0.600 / 1M output tokens
- Average cost per query: ~$0.0002 - $0.0005

**Monthly Estimate** (1000 queries/month): ~$0.20 - $0.50

## Fallback Behavior

When `OPENAI_API_KEY` is not configured:

1. **AI Chat**: Operates in "retrieval-only" mode
   - Still searches Elasticsearch
   - Returns formatted source lists
   - No AI-generated summaries or answers
   - Status indicator shows "degraded" mode

2. **AI Intake**: Uses heuristic extraction
   - Basic regex patterns for dates, names, emails
   - No bilingual translation
   - No smart field mapping
   - Manual form filling required

## Troubleshooting

### "AI service temporarily unavailable"

**Cause**: OpenAI API key invalid or quota exceeded

**Solution**:
1. Verify `OPENAI_API_KEY` is set correctly
2. Check OpenAI dashboard for quota/billing issues
3. Ensure API key has not expired

### "Too many requests"

**Cause**: Rate limit exceeded (20 req/min)

**Solution**:
1. Wait for the rate limit window to reset
2. Check `Retry-After` header in response
3. For higher limits, implement Redis-backed rate limiting

### Empty or Missing Responses

**Cause**: Elasticsearch not properly configured or indexed

**Solution**:
1. Verify Elasticsearch is running
2. Check indexing status: `GET /api/admin/elasticsearch/status`
3. Trigger full reindex if needed
4. Review Elasticsearch logs

### Chat History Not Saving

**Cause**: Database migration not applied

**Solution**:
1. Check migration status in database
2. Manually run: `npm run migrate`
3. Verify tables exist: `ai_chat_conversations`, `ai_chat_messages`

## API Endpoints

### Chat Endpoints

```bash
# Send a chat message
POST /api/ai/chat
Body: {
  "message": "What events are coming up?",
  "history": [...],  # Optional
  "mode": "standard", # "standard" | "agentic"
  "stream": false    # Enable SSE streaming
}

# Health check
GET /api/ai/health

# List conversations
GET /api/ai/conversations

# Get conversation with messages
GET /api/ai/conversations/:id

# Create new conversation
POST /api/ai/conversations
Body: { "title": "Optional title" }

# Delete conversation
DELETE /api/ai/conversations/:id
```

### Intake Endpoint

```bash
# Parse intake text
POST /api/ai/intake/parse
Body: {
  "text": "Your unstructured text...",
  "type": "event"  # "event" | "task" | "partnership" | "lead"
}
```

## Performance

- **Query Parsing**: ~500-800ms (LLM call)
- **Tool Execution**: ~100-300ms (Elasticsearch)
- **Response Generation**: ~800-1500ms (LLM call)
- **Total**: ~1.5-2.5 seconds per query

**Optimization Tips**:
- Use streaming mode for faster perceived response time
- Cache frequent queries (not yet implemented)
- Batch requests when possible
- Consider using faster models (gpt-3.5-turbo) for parsing

## Future Enhancements

- [ ] Redis-backed distributed rate limiting
- [ ] Response caching layer
- [ ] Multi-provider support (Anthropic Claude, Google Gemini)
- [ ] Fine-tuned models for domain-specific queries
- [ ] Conversation summarization for long threads
- [ ] Export conversations to PDF/Markdown
- [ ] Admin dashboard for usage analytics
- [ ] Cost budgets and alerts

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f app`
2. Review Elasticsearch status
3. Verify environment variables are set
4. Check OpenAI API status: https://status.openai.com

## Additional Resources

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Elasticsearch Documentation](./ELASTICSEARCH_SETUP.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [AI Agent Guide](./AI_AGENT_GUIDE.md)
