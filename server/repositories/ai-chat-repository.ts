/**
 * AI Chat Repository
 * Handles persistence of chat conversations and messages per user
 */
import { eq, desc, and, sql } from 'drizzle-orm';
import { BaseRepository } from './base';
import { 
  aiChatConversations, 
  aiChatMessages,
  InsertAiChatConversation,
  InsertAiChatMessage,
  AiChatConversation,
  AiChatMessage,
} from '../../shared/schema';

export class AiChatRepository extends BaseRepository {
  /**
   * Create a new conversation for a user
   */
  async createConversation(userId: number, title?: string): Promise<AiChatConversation> {
    const [conversation] = await this.db
      .insert(aiChatConversations)
      .values({
        userId,
        title: title || 'New conversation',
      })
      .returning();
    return conversation;
  }

  /**
   * Get all conversations for a user (most recent first)
   */
  async getConversations(userId: number, includeArchived = false): Promise<AiChatConversation[]> {
    const conditions = [eq(aiChatConversations.userId, userId)];
    
    if (!includeArchived) {
      conditions.push(eq(aiChatConversations.isArchived, false));
    }
    
    return this.db
      .select()
      .from(aiChatConversations)
      .where(and(...conditions))
      .orderBy(desc(aiChatConversations.updatedAt))
      .limit(50);
  }

  /**
   * Get a specific conversation by ID (with user verification)
   */
  async getConversation(conversationId: string, userId: number): Promise<AiChatConversation | undefined> {
    const [conversation] = await this.db
      .select()
      .from(aiChatConversations)
      .where(
        and(
          eq(aiChatConversations.id, conversationId),
          eq(aiChatConversations.userId, userId)
        )
      )
      .limit(1);
    return conversation;
  }

  /**
   * Update conversation title
   */
  async updateConversationTitle(conversationId: string, userId: number, title: string): Promise<AiChatConversation | undefined> {
    const [updated] = await this.db
      .update(aiChatConversations)
      .set({ 
        title,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(aiChatConversations.id, conversationId),
          eq(aiChatConversations.userId, userId)
        )
      )
      .returning();
    return updated;
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(conversationId: string, userId: number): Promise<boolean> {
    const result = await this.db
      .update(aiChatConversations)
      .set({ 
        isArchived: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(aiChatConversations.id, conversationId),
          eq(aiChatConversations.userId, userId)
        )
      )
      .returning();
    return result.length > 0;
  }

  /**
   * Delete a conversation and all its messages
   */
  async deleteConversation(conversationId: string, userId: number): Promise<boolean> {
    const result = await this.db
      .delete(aiChatConversations)
      .where(
        and(
          eq(aiChatConversations.id, conversationId),
          eq(aiChatConversations.userId, userId)
        )
      )
      .returning();
    return result.length > 0;
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(
    conversationId: string, 
    message: Omit<InsertAiChatMessage, 'conversationId'>
  ): Promise<AiChatMessage> {
    // Add the message
    const [newMessage] = await this.db
      .insert(aiChatMessages)
      .values({
        conversationId,
        ...message,
      })
      .returning();

    // Update conversation's updatedAt and auto-generate title if first user message
    if (message.role === 'user') {
      const existingMessages = await this.db
        .select()
        .from(aiChatMessages)
        .where(eq(aiChatMessages.conversationId, conversationId))
        .limit(2);
      
      // If this is the first message, generate a title from the first sentence
      if (existingMessages.length === 1) {
        // Extract first sentence (split by . ! ? or newline)
        const sentenceMatch = message.content.match(/^[^.!?\n]+[.!?]?/);
        const firstSentence = sentenceMatch ? sentenceMatch[0].trim() : message.content;
        // Limit to 100 chars but prefer complete words
        const title = firstSentence.length > 100 
          ? firstSentence.substring(0, 97).trim() + '...'
          : firstSentence;
        await this.db
          .update(aiChatConversations)
          .set({ 
            title,
            updatedAt: new Date(),
          })
          .where(eq(aiChatConversations.id, conversationId));
      } else {
        await this.db
          .update(aiChatConversations)
          .set({ updatedAt: new Date() })
          .where(eq(aiChatConversations.id, conversationId));
      }
    }

    return newMessage;
  }

  /**
   * Get all messages in a conversation
   */
  async getMessages(conversationId: string, userId: number): Promise<AiChatMessage[]> {
    // First verify user owns the conversation
    const conversation = await this.getConversation(conversationId, userId);
    if (!conversation) {
      return [];
    }

    return this.db
      .select()
      .from(aiChatMessages)
      .where(eq(aiChatMessages.conversationId, conversationId))
      .orderBy(aiChatMessages.createdAt);
  }

  /**
   * Get recent messages from a conversation (for context window)
   */
  async getRecentMessages(conversationId: string, limit = 10): Promise<AiChatMessage[]> {
    return this.db
      .select()
      .from(aiChatMessages)
      .where(eq(aiChatMessages.conversationId, conversationId))
      .orderBy(desc(aiChatMessages.createdAt))
      .limit(limit);
  }

  /**
   * Get or create the most recent active conversation for a user
   */
  async getOrCreateActiveConversation(userId: number): Promise<AiChatConversation> {
    // Try to find an existing active conversation (updated in last 24 hours)
    const [recent] = await this.db
      .select()
      .from(aiChatConversations)
      .where(
        and(
          eq(aiChatConversations.userId, userId),
          eq(aiChatConversations.isArchived, false)
        )
      )
      .orderBy(desc(aiChatConversations.updatedAt))
      .limit(1);

    if (recent) {
      return recent;
    }

    // Create a new conversation
    return this.createConversation(userId);
  }
}

export const aiChatRepository = new AiChatRepository();
