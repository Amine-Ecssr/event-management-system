import { db } from './db';
import { 
  invitationEmailJobs, 
  eventInvitees, 
  events, 
  eventCustomEmails,
  contacts,
  type InvitationEmailJob,
  type Event,
  type EventInvitee,
  type Contact,
  type EventCustomEmail
} from '@shared/schema.mssql';
import { eq, and, sql } from 'drizzle-orm';
import { emailService } from './email';
import { storage } from './storage';

class InvitationEmailService {
  private activeJobs = new Map<number, boolean>(); // Track running jobs

  /**
   * Create a new invitation email job
   */
  async createJob(
    eventId: string,
    useCustomEmail: boolean,
    waitTimeSeconds: number,
    userId?: number
  ): Promise<InvitationEmailJob> {
    // Get total recipients count
    const invitees = await db
      .select()
      .from(eventInvitees)
      .where(eq(eventInvitees.eventId, eventId));

    const [job] = await db
      .insert(invitationEmailJobs)
      .values({
        eventId,
        useCustomEmail,
        waitTimeSeconds,
        totalRecipients: invitees.length,
        createdByUserId: userId,
      })
      .returning();

    return job;
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: number): Promise<InvitationEmailJob | undefined> {
    const [job] = await db
      .select()
      .from(invitationEmailJobs)
      .where(eq(invitationEmailJobs.id, jobId))
      .offset(1);

    return job;
  }

  /**
   * Get jobs for an event
   */
  async getEventJobs(eventId: string): Promise<InvitationEmailJob[]> {
    return db
      .select()
      .from(invitationEmailJobs)
      .where(eq(invitationEmailJobs.eventId, eventId))
      .orderBy(sql`${invitationEmailJobs.createdAt} DESC`);
  }

  /**
   * Update job status
   */
  async updateJob(jobId: number, updates: Partial<InvitationEmailJob>): Promise<void> {
    await db
      .update(invitationEmailJobs)
      .set(updates)
      .where(eq(invitationEmailJobs.id, jobId));
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: number): Promise<void> {
    await this.updateJob(jobId, {
      status: 'cancelled',
      completedAt: new Date(),
    });
    this.activeJobs.delete(jobId);
  }

  /**
   * Process invitation email job
   */
  async processJob(jobId: number): Promise<void> {
    // Check if job is already running
    if (this.activeJobs.has(jobId)) {
      console.log(`[InvitationEmailService] Job ${jobId} is already running`);
      return;
    }

    const job = await this.getJob(jobId);
    if (!job) {
      console.error(`[InvitationEmailService] Job ${jobId} not found`);
      return;
    }

    // Only process pending jobs
    if (job.status !== 'pending') {
      console.log(`[InvitationEmailService] Job ${jobId} status is ${job.status}, skipping`);
      return;
    }

    // Mark job as running
    this.activeJobs.set(jobId, true);

    try {
      // Update status to in_progress
      await this.updateJob(jobId, {
        status: 'in_progress',
        startedAt: new Date(),
      });

      // Get event
      const [event] = await db
        .select()
        .from(events)
        .where(eq(events.id, job.eventId))
        .offset(1);

      if (!event) {
        throw new Error(`Event ${job.eventId} not found`);
      }

      // Get email template or custom email
      let emailTemplate: { subject: string; body: string } | null = null;
      if (job.useCustomEmail) {
        const [customEmail] = await db
          .select()
          .from(eventCustomEmails)
          .where(
            and(
              eq(eventCustomEmails.eventId, job.eventId),
              eq(eventCustomEmails.isActive, true)
            )
          )
          .offset(1);

        if (customEmail) {
          emailTemplate = {
            subject: customEmail.subject,
            body: customEmail.body,
          };
        }
      }

      // Get invitees who haven't received the email
      const inviteesList = await db
        .select({
          invitee: eventInvitees,
          contact: contacts,
        })
        .from(eventInvitees)
        .innerJoin(contacts, eq(eventInvitees.contactId, contacts.id))
        .where(
          and(
            eq(eventInvitees.eventId, job.eventId),
            eq(eventInvitees.inviteEmailSent, false)
          )
        );

      let emailsSent = job.emailsSent || 0;
      let emailsFailed = job.emailsFailed || 0;

      console.log(`[InvitationEmailService] Processing job ${jobId} with ${inviteesList.length} invitees`);

      // Send emails one by one with wait time
      for (const { invitee, contact } of inviteesList) {
        // Check if job was cancelled
        if (!this.activeJobs.has(jobId)) {
          console.log(`[InvitationEmailService] Job ${jobId} was cancelled`);
          break;
        }

        try {
          // Send invitation email
          if (job.useCustomEmail && emailTemplate) {
            await emailService.sendCustomInvitationEmail(
              event,
              contact,
              emailTemplate.subject,
              emailTemplate.body
            );
          } else {
            await emailService.sendInvitationEmail(event, contact);
          }

          // Mark email as sent in invitees table
          await db
            .update(eventInvitees)
            .set({
              inviteEmailSent: true,
              inviteEmailSentAt: new Date(),
            })
            .where(eq(eventInvitees.id, invitee.id));

          emailsSent++;

          console.log(`[InvitationEmailService] Sent invitation to ${contact.email} (${emailsSent}/${inviteesList.length})`);
        } catch (error) {
          emailsFailed++;
          console.error(`[InvitationEmailService] Failed to send to ${contact.email}:`, error);
        }

        // Update job progress
        await this.updateJob(jobId, {
          emailsSent,
          emailsFailed,
        });

        // Wait before sending next email (if not the last one)
        if (emailsSent + emailsFailed < inviteesList.length) {
          await this.sleep(job.waitTimeSeconds * 1000);
        }
      }

      // Mark job as completed
      await this.updateJob(jobId, {
        status: 'completed',
        completedAt: new Date(),
        emailsSent,
        emailsFailed,
      });

      console.log(`[InvitationEmailService] Job ${jobId} completed: ${emailsSent} sent, ${emailsFailed} failed`);
    } catch (error) {
      console.error(`[InvitationEmailService] Job ${jobId} failed:`, error);
      
      await this.updateJob(jobId, {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      // Remove from active jobs
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Start processing a job in the background
   */
  startJob(jobId: number): void {
    // Process job asynchronously without blocking
    this.processJob(jobId).catch((error) => {
      console.error(`[InvitationEmailService] Failed to process job ${jobId}:`, error);
    });
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if a job is currently running
   */
  isJobRunning(jobId: number): boolean {
    return this.activeJobs.has(jobId);
  }
}

export const invitationEmailService = new InvitationEmailService();
