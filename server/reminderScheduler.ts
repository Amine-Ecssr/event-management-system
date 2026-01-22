import { storage } from './storage';
import { emailService } from './email';
import { parseISO, startOfWeek, subDays, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';

export type ReminderType = '1_week' | '1_day' | 'weekly' | 'daily' | 'morning_of';

const REMINDER_HOUR_UTC = 4; // 8:00 AM GST

function setReminderTime(date: Date): Date {
  date = setHours(date, REMINDER_HOUR_UTC);
  date = setMinutes(date, 0);
  date = setSeconds(date, 0);
  date = setMilliseconds(date, 0);
  return date;
}

function getScheduledDate(eventDate: Date, reminderType: ReminderType, now: Date): Date | null {
  if (reminderType === '1_week') {
    const oneWeekBefore = setReminderTime(subDays(eventDate, 7));
    return oneWeekBefore.getTime() > now.getTime() ? oneWeekBefore : null;
  }

  if (reminderType === '1_day') {
    const oneDayBefore = setReminderTime(subDays(eventDate, 1));
    return oneDayBefore.getTime() > now.getTime() ? oneDayBefore : null;
  }

  if (reminderType === 'morning_of') {
    const morningOf = setReminderTime(new Date(eventDate));
    return morningOf.getTime() > now.getTime() ? morningOf : null;
  }

  if (reminderType === 'weekly') {
    let current = setReminderTime(startOfWeek(now, { weekStartsOn: 1 }));
    if (current.getTime() <= now.getTime()) {
      current.setDate(current.getDate() + 7);
    }

    return current.getTime() < eventDate.getTime() ? current : null;
  }

  if (reminderType === 'daily') {
    const sevenDaysBefore = setReminderTime(subDays(eventDate, 7));

    let startDate = setReminderTime(new Date(now));
    if (startDate.getTime() <= now.getTime()) {
      startDate.setDate(startDate.getDate() + 1);
    }

    const twoDaysBefore = setReminderTime(subDays(eventDate, 2));
    const current = new Date(Math.max(sevenDaysBefore.getTime(), startDate.getTime()));

    if (current.getTime() > twoDaysBefore.getTime() || current.getTime() >= eventDate.getTime()) {
      return null;
    }

    return current;
  }

  return null;
}

/**
 * Calculate the reminder time for an event based on the reminder type
 * @param eventStartDate - Event start date in YYYY-MM-DD format
 * @param reminderType - Type of reminder ('weekly' or 'daily')
 * @returns Date object representing when the reminder should be sent (in UTC)
 */
export function calculateReminderTime(eventStartDate: string, reminderType: ReminderType, now: Date = new Date()): Date {
  const eventDate = parseISO(eventStartDate);
  const reminderDate = getScheduledDate(eventDate, reminderType, now);

  if (!reminderDate) {
    throw new Error(`Reminder time for ${reminderType} is in the past or cannot be scheduled`);
  }

  return reminderDate;
}

class ReminderSchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_ATTEMPTS = 3;
  
  /**
   * Start the reminder scheduler
   */
  start(): void {
    if (this.intervalId) {
      console.log('Reminder scheduler is already running');
      return;
    }
    
    console.log('Starting reminder scheduler...');
    
    // Process immediately on start
    this.processReminders().catch(error => {
      console.error('Error in initial reminder processing:', error);
    });
    
    // Set up interval to poll every 5 minutes
    this.intervalId = setInterval(() => {
      this.processReminders().catch(error => {
        console.error('Error processing reminders:', error);
      });
    }, this.POLL_INTERVAL_MS);
    
    console.log(`Reminder scheduler started (polling every ${this.POLL_INTERVAL_MS / 1000}s)`);
  }
  
  /**
   * Stop the reminder scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Reminder scheduler stopped');
    }
  }
  
  /**
   * Process pending reminders
   */
  private async processReminders(): Promise<void> {
    try {
      const now = new Date();
      
      // Get settings for email notifications
      const settings = await storage.getSettings();
      
      // Process daily reminders for stakeholders with pending tasks
      // This runs every time processReminders is called (every 5 minutes)
      try {
        await emailService.scheduleStakeholderDailyReminders(storage);
      } catch (error) {
        console.error('Error processing daily reminders:', error);
      }
      
      // Get pending reminders that are due
      const reminders = await storage.getPendingReminders(now);
      
      if (reminders.length === 0) {
        return;
      }
      
      console.log(`Processing ${reminders.length} pending reminder(s)...`);
      
      for (const reminder of reminders) {
        try {
          // Check if we should retry (exponential backoff)
          if (reminder.lastAttempt) {
            const timeSinceLastAttempt = now.getTime() - reminder.lastAttempt.getTime();
            // Exponential backoff based on previous attempts: 1 min, 2 min, 4 min
            // attempts=1 (first retry) → 2^0 = 1 min
            // attempts=2 (second retry) → 2^1 = 2 min
            // attempts=3 (third retry) → 2^2 = 4 min
            const backoffTime = Math.pow(2, Math.max(0, reminder.attempts - 1)) * 60000;
            
            if (timeSinceLastAttempt < backoffTime) {
              continue; // Skip this reminder for now
            }
          }
          
          // Check max attempts
          if (reminder.attempts >= this.MAX_ATTEMPTS) {
            await storage.markReminderError(reminder.id, 'Max attempts reached', true); // Final error
            console.log(`Reminder ${reminder.id} failed after ${this.MAX_ATTEMPTS} attempts`);
            continue;
          }
          
          // Get event details
          const event = await storage.getEvent(reminder.eventId);
          if (!event) {
            await storage.markReminderError(reminder.id, 'Event not found');
            console.error(`Event ${reminder.eventId} not found for reminder ${reminder.id}`);
            continue;
          }
          
          // Send email if enabled
          let emailSent = false;
          if (settings.emailEnabled && settings.emailApiKey && settings.emailFromEmail && settings.emailRecipients) {
            try {
              const recipients = settings.emailRecipients.split(',').map((e: string) => e.trim());
              for (const recipient of recipients) {
                await emailService.sendEventNotification(event, recipient, settings, 'REMINDER: ');
              }
              emailSent = true;
              console.log(`Email sent for reminder ${reminder.id}`);
            } catch (emailError) {
              console.error(`Email failed for reminder ${reminder.id}:`, emailError);
            }
          }
          
          // Send WhatsApp if enabled
          let whatsappSent = false;
          if (settings.whatsappEnabled) {
            try {
              const { sendEventReminderNotification } = await import('./whatsappFormatter');
              await sendEventReminderNotification(event, settings.whatsappChatName || undefined);
              whatsappSent = true;
              console.log(`WhatsApp sent for reminder ${reminder.id}`);
            } catch (whatsappError) {
              console.error(`WhatsApp failed for reminder ${reminder.id}:`, whatsappError);
            }
          }
          
          // Mark as sent
          await storage.markReminderSent(reminder.id);
          const notificationTypes: string[] = [];
          if (emailSent) notificationTypes.push('Email');
          if (whatsappSent) notificationTypes.push('WhatsApp');
          const notificationType = notificationTypes.length > 0 ? notificationTypes.join(' + ') : 'None';
          console.log(`Reminder ${reminder.id} sent successfully (${notificationType}) for event ${event.name}`);
        } catch (error) {
          // Mark as error (increments attempts, keeps pending for retry)
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const isFinal = reminder.attempts + 1 >= this.MAX_ATTEMPTS;
          await storage.markReminderError(reminder.id, errorMessage, isFinal);
          console.error(`Error sending reminder ${reminder.id}:`, errorMessage);
        }
      }
    } catch (error) {
      console.error('Error processing reminders:', error);
    }
  }
}

// Singleton instance
let schedulerInstance: ReminderSchedulerService | null = null;

/**
 * Start the reminder scheduler
 * This function should be called from server/index.ts on startup
 */
export function startReminderScheduler(): void {
  if (!schedulerInstance) {
    schedulerInstance = new ReminderSchedulerService();
  }
  schedulerInstance.start();
}

/**
 * Stop the reminder scheduler (for testing or graceful shutdown)
 */
export function stopReminderScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.stop();
  }
}
