/**
 * Reminder Repository
 * Handles all reminder queue database operations
 */
import { BaseRepository } from './base';
import { reminderQueue, events, type ReminderQueue, type InsertReminderQueue, type Event } from '@shared/schema';
import { eq, and, lte, sql } from 'drizzle-orm';

export class ReminderRepository extends BaseRepository {
  async enqueueReminder(insertReminder: InsertReminderQueue): Promise<ReminderQueue> {
    // Use onConflictDoNothing to handle duplicate reminders gracefully
    const [reminder] = await this.db
      .insert(reminderQueue)
      .values(insertReminder)
      .onConflictDoNothing()
      .returning();
    
    // If no reminder was inserted (due to conflict), query for the existing one
    if (!reminder) {
      const [existing] = await this.db
        .select()
        .from(reminderQueue)
        .where(
          and(
            eq(reminderQueue.eventId, insertReminder.eventId),
            eq(reminderQueue.scheduledFor, insertReminder.scheduledFor),
            eq(reminderQueue.reminderType, insertReminder.reminderType)
          )
        )
        .limit(1);
      return existing;
    }
    
    return reminder;
  }

  async getPendingReminders(beforeTime: Date): Promise<ReminderQueue[]> {
    // Mark reminders older than 24 hours as expired to avoid sending stale reminders
    const oneDayAgo = new Date(beforeTime.getTime() - 24 * 60 * 60 * 1000);
    
    await this.db
      .update(reminderQueue)
      .set({ 
        status: 'expired',
        errorMessage: 'Reminder expired - more than 24 hours old'
      })
      .where(
        and(
          eq(reminderQueue.status, 'pending'),
          lte(reminderQueue.scheduledFor, oneDayAgo)
        )
      );
    
    // Return only pending reminders that are due but not expired
    return await this.db
      .select()
      .from(reminderQueue)
      .where(
        and(
          eq(reminderQueue.status, 'pending'),
          lte(reminderQueue.scheduledFor, beforeTime)
        )
      );
  }

  async markReminderSent(id: number): Promise<void> {
    await this.db
      .update(reminderQueue)
      .set({ 
        status: 'sent', 
        sentAt: new Date(),
        attempts: sql`${reminderQueue.attempts} + 1`
      })
      .where(eq(reminderQueue.id, id));
  }

  async markReminderError(id: number, errorMessage: string, isFinal: boolean = false): Promise<void> {
    await this.db
      .update(reminderQueue)
      .set({ 
        status: isFinal ? 'error' : 'pending', // Keep pending for retry unless max attempts exceeded
        errorMessage,
        lastAttempt: new Date(),
        attempts: sql`${reminderQueue.attempts} + 1`
      })
      .where(eq(reminderQueue.id, id));
  }

  async deleteRemindersForEvent(eventId: string): Promise<void> {
    await this.db
      .delete(reminderQueue)
      .where(eq(reminderQueue.eventId, eventId));
  }

  async getAllRemindersWithEvents(): Promise<Array<ReminderQueue & { event: Event }>> {
    const results = await this.db
      .select()
      .from(reminderQueue)
      .leftJoin(events, eq(reminderQueue.eventId, events.id))
      .orderBy(reminderQueue.scheduledFor);
    
    return results.map(row => ({
      ...row.reminder_queue,
      event: row.events!
    }));
  }

  async getReminder(id: number): Promise<ReminderQueue | undefined> {
    const [reminder] = await this.db
      .select()
      .from(reminderQueue)
      .where(eq(reminderQueue.id, id));
    return reminder || undefined;
  }

  async resetReminderForResend(id: number, scheduledFor: Date): Promise<ReminderQueue | undefined> {
    const [reminder] = await this.db
      .update(reminderQueue)
      .set({
        status: 'pending',
        scheduledFor,
        attempts: 0,
        lastAttempt: null,
        sentAt: null,
        errorMessage: null,
      })
      .where(eq(reminderQueue.id, id))
      .returning();

    return reminder || undefined;
  }

  async deleteReminder(id: number): Promise<boolean> {
    const result = await this.db
      .delete(reminderQueue)
      .where(eq(reminderQueue.id, id))
      .returning();
    return result.length > 0;
  }
}
