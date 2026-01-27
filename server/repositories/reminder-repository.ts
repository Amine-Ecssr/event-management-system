/**
 * Reminder Repository (MSSQL version)
 * Handles all reminder queue database operations
 */
import { BaseRepository } from './base';
import { reminderQueue, events, type ReminderQueue, type InsertReminderQueue, type Event } from '@shared/schema.mssql';
import { eq, and, lte, sql } from 'drizzle-orm';

export class ReminderRepository extends BaseRepository {

  async enqueueReminder(insertReminder: InsertReminderQueue): Promise<ReminderQueue> {
    // INSERT returning works on MSSQL
    const [reminder] = await this.db
      .insert(reminderQueue)
      .values(insertReminder)
      .onConflictDoNothing()
      .returning();

    // If conflict prevented insert, fetch existing row
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
    const oneDayAgo = new Date(beforeTime.getTime() - 24 * 60 * 60 * 1000);

    // Expire stale reminders
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

    // Return pending reminders that are due
    return this.db
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

  async markReminderError(id: number, errorMessage: string, isFinal = false): Promise<void> {
    await this.db
      .update(reminderQueue)
      .set({
        status: isFinal ? 'error' : 'pending',
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
    const rows = await this.db
      .select()
      .from(reminderQueue)
      .leftJoin(events, eq(reminderQueue.eventId, events.id))
      .orderBy(reminderQueue.scheduledFor);

    return rows.map((row: { reminder_queue: any; events: any; }) => ({
      ...row.reminder_queue,
      event: row.events!
    }));
  }

  async getReminder(id: number): Promise<ReminderQueue | undefined> {
    const [reminder] = await this.db
      .select()
      .from(reminderQueue)
      .where(eq(reminderQueue.id, id));

    return reminder;
  }

  async resetReminderForResend(id: number, scheduledFor: Date): Promise<ReminderQueue | undefined> {
    // MSSQL: update().returning() not supported
    await this.db
      .update(reminderQueue)
      .set({
        status: 'pending',
        scheduledFor,
        attempts: 0,
        lastAttempt: null,
        sentAt: null,
        errorMessage: null,
      })
      .where(eq(reminderQueue.id, id));

    const [reminder] = await this.db
      .select()
      .from(reminderQueue)
      .where(eq(reminderQueue.id, id));

    return reminder;
  }

  async deleteReminder(id: number): Promise<boolean> {
    // MSSQL: delete().returning() not supported
    const result = await this.db
      .delete(reminderQueue)
      .where(eq(reminderQueue.id, id));

    return result.rowsAffected > 0;
  }
}
