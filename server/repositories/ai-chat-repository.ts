import { eq, desc, and } from 'drizzle-orm';
import { BaseRepository } from './base';
import { 
  aiChatConversations, 
  aiChatMessages,
  InsertAiChatMessage,
  AiChatConversation,
  AiChatMessage,
} from '@shared/schema.mssql';

export class AiChatRepository extends BaseRepository {

  async createConversation(userId: number, title?: string): Promise<AiChatConversation> {
    const [conversation] = await this.db
      .insert(aiChatConversations)
      .values({
        userId,
        title: title || 'New conversation',
      })
      .returning(); // INSERT returning works in MSSQL
    return conversation;
  }

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

  async updateConversationTitle(conversationId: string, userId: number, title: string): Promise<AiChatConversation | undefined> {
    await this.db
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
      );

    // MSSQL: must re‑select manually
    return this.getConversation(conversationId, userId);
  }

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
      );

    return result.rowsAffected > 0;
  }

  async deleteConversation(conversationId: string, userId: number): Promise<boolean> {
    const result = await this.db
      .delete(aiChatConversations)
      .where(
        and(
          eq(aiChatConversations.id, conversationId),
          eq(aiChatConversations.userId, userId)
        )
      );

    return result.rowsAffected > 0;
  }

  async addMessage(
    conversationId: string, 
    message: Omit<InsertAiChatMessage, 'conversationId'>
  ): Promise<AiChatMessage> {

    const [newMessage] = await this.db
      .insert(aiChatMessages)
      .values({
        conversationId,
        ...message,
      })
      .returning(); // INSERT returning works

    if (message.role === 'user') {
      const existingMessages = await this.db
        .select()
        .from(aiChatMessages)
        .where(eq(aiChatMessages.conversationId, conversationId))
        .limit(2);

      if (existingMessages.length === 1) {
        const sentenceMatch = message.content.match(/^[^.!?\n]+[.!?]?/);
        const firstSentence = sentenceMatch ? sentenceMatch[0].trim() : message.content;

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

  async getMessages(conversationId: string, userId: number): Promise<AiChatMessage[]> {
    const conversation = await this.getConversation(conversationId, userId);
    if (!conversation) return [];

    return this.db
      .select()
      .from(aiChatMessages)
      .where(eq(aiChatMessages.conversationId, conversationId))
      .orderBy(aiChatMessages.createdAt);
  }

  async getRecentMessages(conversationId: string, limit = 10): Promise<AiChatMessage[]> {
    return this.db
      .select()
      .from(aiChatMessages)
      .where(eq(aiChatMessages.conversationId, conversationId))
      .orderBy(desc(aiChatMessages.createdAt))
      .limit(limit);
  }

  async getOrCreateActiveConversation(userId: number): Promise<AiChatConversation> {
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

    if (recent) return recent;

    return this.createConversation(userId);
  }
}

export const aiChatRepository = new AiChatRepository();
