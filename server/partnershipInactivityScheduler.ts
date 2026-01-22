import { storage } from './storage';
import { emailService } from './email';
import type { Organization } from '@shared/schema';
import type { AppSettings } from './services/configService';
import { format, differenceInDays, differenceInMonths } from 'date-fns';

// How often to check for inactive partnerships (daily at 8 AM GST = 4 AM UTC)
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_INACTIVITY_THRESHOLD_MONTHS = 6;

// Prevent sending notifications more than once per week to the same partnership
const MIN_NOTIFICATION_INTERVAL_DAYS = 7;

interface InactivePartnership extends Organization {
  daysSinceLastActivity: number;
}

class PartnershipInactivitySchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;
  
  /**
   * Start the partnership inactivity scheduler
   */
  start(): void {
    if (this.intervalId) {
      console.log('Partnership inactivity scheduler is already running');
      return;
    }
    
    console.log('Starting partnership inactivity scheduler...');
    
    // Process after a short delay on startup (5 minutes)
    setTimeout(() => {
      this.processInactivePartnerships().catch(error => {
        console.error('Error in initial partnership inactivity check:', error);
      });
    }, 5 * 60 * 1000);
    
    // Set up interval to check daily
    this.intervalId = setInterval(() => {
      this.processInactivePartnerships().catch(error => {
        console.error('Error processing inactive partnerships:', error);
      });
    }, CHECK_INTERVAL_MS);
    
    console.log(`Partnership inactivity scheduler started (checking every ${CHECK_INTERVAL_MS / (60 * 60 * 1000)} hours)`);
  }
  
  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Partnership inactivity scheduler stopped');
    }
  }
  
  /**
   * Process inactive partnerships and send notifications
   */
  async processInactivePartnerships(): Promise<{ processed: number; notified: number }> {
    if (this.isProcessing) {
      console.log('Partnership inactivity check already in progress, skipping...');
      return { processed: 0, notified: 0 };
    }
    
    this.isProcessing = true;
    let processed = 0;
    let notified = 0;
    
    try {
      const settings = await storage.getSettings();
      
      // Check if email is enabled
      if (!settings.emailEnabled || !settings.emailFromEmail) {
        console.log('Email is not enabled, skipping partnership inactivity notifications');
        return { processed: 0, notified: 0 };
      }
      
      // Get default threshold date (for fallback)
      const defaultThresholdDate = new Date();
      defaultThresholdDate.setMonth(defaultThresholdDate.getMonth() - DEFAULT_INACTIVITY_THRESHOLD_MONTHS);
      
      // Get all inactive partnerships
      const inactivePartnerships = await storage.getInactivePartnerships(defaultThresholdDate);
      
      if (inactivePartnerships.length === 0) {
        console.log('No inactive partnerships found');
        return { processed: 0, notified: 0 };
      }
      
      console.log(`Found ${inactivePartnerships.length} inactive partnership(s)`);
      processed = inactivePartnerships.length;
      
      for (const partnership of inactivePartnerships) {
        try {
          // Check if we should send a notification (respect cooldown period)
          if (partnership.lastInactivityNotificationSent) {
            const daysSinceLastNotification = differenceInDays(
              new Date(),
              partnership.lastInactivityNotificationSent
            );
            
            if (daysSinceLastNotification < MIN_NOTIFICATION_INTERVAL_DAYS) {
              console.log(`Skipping notification for ${partnership.nameEn} - last notification sent ${daysSinceLastNotification} days ago`);
              continue;
            }
          }
          
          // Send notification email
          await this.sendInactivityNotification(partnership, settings);
          
          // Mark notification as sent
          await storage.markInactivityNotificationSent(partnership.id);
          
          notified++;
          console.log(`Inactivity notification sent for partnership: ${partnership.nameEn}`);
        } catch (error) {
          console.error(`Failed to send inactivity notification for ${partnership.nameEn}:`, error);
        }
      }
      
      console.log(`Partnership inactivity check complete: ${processed} checked, ${notified} notified`);
      return { processed, notified };
    } catch (error) {
      console.error('Error in partnership inactivity processing:', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Send inactivity notification email for a partnership
   */
  private async sendInactivityNotification(
    partnership: InactivePartnership,
    settings: AppSettings
  ): Promise<void> {
    if (!settings.emailFromEmail) {
      throw new Error('Email from address is required');
    }
    
    const { createEmailProvider } = await import('./emailProvider');
    const provider = createEmailProvider(settings);
    const fromName = settings.emailFromName || 'ECSSR Events';
    
    // Determine language from global settings
    const language = settings.emailLanguage || 'en';
    const isArabic = language === 'ar';
    
    // Calculate activity info
    const lastActivityDate = partnership.lastActivityDate 
      ? format(partnership.lastActivityDate, 'MMMM d, yyyy')
      : 'Never';
    const monthsSinceActivity = partnership.lastActivityDate
      ? differenceInMonths(new Date(), partnership.lastActivityDate)
      : 'N/A';
    const threshold = partnership.inactivityThresholdMonths || DEFAULT_INACTIVITY_THRESHOLD_MONTHS;
    
    // Build email content
    const subject = isArabic
      ? `⚠️ تنبيه عدم نشاط الشراكة: ${partnership.nameAr || partnership.nameEn}`
      : `⚠️ Partnership Inactivity Alert: ${partnership.nameEn}`;
    
    const partnershipStatus = partnership.partnershipStatus 
      ? (isArabic 
          ? getStatusLabelAr(partnership.partnershipStatus)
          : getStatusLabel(partnership.partnershipStatus))
      : (isArabic ? 'غير محدد' : 'Unknown');
    
    // Get app URL from settings for the partnership link
    const appUrl = process.env.APP_URL || process.env.VITE_API_BASE_URL || 'http://localhost:5000';
    const partnershipLink = `${appUrl}/partnerships/${partnership.id}`;
    
    const html = isArabic ? `
<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="background-color: #ffffff; font-family: Arial, sans-serif; font-size: 16px; color: #333333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; direction: rtl; text-align: right;">
  <div style="background-color: #FEF3CD; border: 1px solid #FFEEBA; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
    <h2 style="color: #856404; margin: 0 0 8px 0; font-size: 18px;">⚠️ تنبيه عدم نشاط الشراكة</h2>
    <p style="margin: 0; color: #856404;">لم يسجل أي نشاط للشراكة مع <strong>${partnership.nameAr || partnership.nameEn}</strong> منذ <strong>${monthsSinceActivity}</strong> شهر(أشهر).</p>
  </div>
  
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
    <h3 style="margin: 0 0 12px 0; color: #495057;">تفاصيل الشراكة</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold;">اسم الشريك:</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${partnership.nameAr || partnership.nameEn}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold;">آخر نشاط:</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${lastActivityDate}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold;">الأيام منذ آخر نشاط:</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${partnership.daysSinceLastActivity} يوم</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold;">حالة الشراكة:</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${partnershipStatus}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">حد الإشعار:</td>
        <td style="padding: 8px 0;">${threshold} شهر(أشهر)</td>
      </tr>
    </table>
  </div>
  
  <div style="background-color: #e7f5ff; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
    <h3 style="margin: 0 0 12px 0; color: #1971c2;">الإجراءات المقترحة</h3>
    <ul style="margin: 0; padding-right: 20px;">
      <li style="margin-bottom: 8px;">جدولة اجتماع متابعة مع الشريك</li>
      <li style="margin-bottom: 8px;">مراجعة حالة اتفاقية الشراكة</li>
      <li style="margin-bottom: 8px;">توثيق أي تفاعلات غير رسمية حديثة</li>
      <li>التخطيط لأنشطة أو فعاليات مشتركة</li>
    </ul>
  </div>
  
  <div style="text-align: center; margin-top: 24px;">
    <a href="${partnershipLink}" style="display: inline-block; background-color: #BC9F6D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">عرض الشراكة</a>
  </div>
  
  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #E0E0E0; color: #666666; font-size: 14px;">
    <p>مع أطيب التحيات،<br/>فريق إدارة الشراكات - المركز</p>
  </div>
</body>
</html>
    ` : `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="background-color: #ffffff; font-family: Arial, sans-serif; font-size: 16px; color: #333333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #FEF3CD; border: 1px solid #FFEEBA; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
    <h2 style="color: #856404; margin: 0 0 8px 0; font-size: 18px;">⚠️ Partnership Inactivity Alert</h2>
    <p style="margin: 0; color: #856404;">The partnership with <strong>${partnership.nameEn}</strong> has had no recorded activities for <strong>${monthsSinceActivity}</strong> month(s).</p>
  </div>
  
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
    <h3 style="margin: 0 0 12px 0; color: #495057;">Partnership Details</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold;">Partner Name:</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${partnership.nameEn}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold;">Last Activity:</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${lastActivityDate}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold;">Days Since Last Activity:</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${partnership.daysSinceLastActivity} days</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; font-weight: bold;">Partnership Status:</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${partnershipStatus}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Notification Threshold:</td>
        <td style="padding: 8px 0;">${threshold} month(s)</td>
      </tr>
    </table>
  </div>
  
  <div style="background-color: #e7f5ff; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
    <h3 style="margin: 0 0 12px 0; color: #1971c2;">Suggested Actions</h3>
    <ul style="margin: 0; padding-left: 20px;">
      <li style="margin-bottom: 8px;">Schedule a check-in meeting with the partner</li>
      <li style="margin-bottom: 8px;">Review partnership agreement status</li>
      <li style="margin-bottom: 8px;">Document any recent informal interactions</li>
      <li>Plan joint activities or events</li>
    </ul>
  </div>
  
  <div style="text-align: center; margin-top: 24px;">
    <a href="${partnershipLink}" style="display: inline-block; background-color: #BC9F6D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Partnership</a>
  </div>
  
  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #E0E0E0; color: #666666; font-size: 14px;">
    <p>Best regards,<br/>Partnership Management Team - ECSSR</p>
  </div>
</body>
</html>
    `;
    
    // Send to configured recipients (use management summary recipients or a specific partnerships notification list)
    const recipients = settings.managementSummaryRecipients || settings.emailRecipients;
    if (!recipients) {
      console.log('No recipients configured for partnership inactivity notifications');
      return;
    }
    
    const recipientList = recipients.split(',').map((e: string) => e.trim()).filter(Boolean);
    
    await provider.send({
      from: `${fromName} <${settings.emailFromEmail}>`,
      to: recipientList,
      subject,
      html,
    });
  }
  
  /**
   * Manually trigger an inactivity check (for API endpoint)
   */
  async triggerCheck(): Promise<{ processed: number; notified: number }> {
    return this.processInactivePartnerships();
  }
}

// Helper functions for status labels
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'Active',
    pending: 'Pending',
    suspended: 'Suspended',
    terminated: 'Terminated',
  };
  return labels[status] || status;
}

function getStatusLabelAr(status: string): string {
  const labels: Record<string, string> = {
    active: 'نشط',
    pending: 'قيد الانتظار',
    suspended: 'معلق',
    terminated: 'منتهي',
  };
  return labels[status] || status;
}

// Singleton instance
let schedulerInstance: PartnershipInactivitySchedulerService | null = null;

/**
 * Start the partnership inactivity scheduler
 */
export function startPartnershipInactivityScheduler(): void {
  if (!schedulerInstance) {
    schedulerInstance = new PartnershipInactivitySchedulerService();
  }
  schedulerInstance.start();
}

/**
 * Stop the partnership inactivity scheduler
 */
export function stopPartnershipInactivityScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.stop();
  }
}

/**
 * Manually trigger an inactivity check
 */
export async function triggerPartnershipInactivityCheck(): Promise<{ processed: number; notified: number }> {
  if (!schedulerInstance) {
    schedulerInstance = new PartnershipInactivitySchedulerService();
  }
  return schedulerInstance.triggerCheck();
}

export { PartnershipInactivitySchedulerService };
