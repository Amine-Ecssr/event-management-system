import { Resend } from 'resend';
import nodemailer from 'nodemailer';

/**
 * Email provider interface for sending emails
 */
export interface EmailProvider {
  send(params: {
    from: string;
    to: string | string[];
    cc?: string | string[];
    subject: string;
    html: string;
    attachments?: EmailAttachment[];
  }): Promise<void>;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

/**
 * Resend email provider implementation
 */
export class ResendProvider implements EmailProvider {
  private resend: Resend;

  constructor(apiKey: string) {
    this.resend = new Resend(apiKey);
  }

  async send(params: {
    from: string;
    to: string | string[];
    cc?: string | string[];
    subject: string;
    html: string;
    attachments?: EmailAttachment[];
  }): Promise<void> {
    const toArray = Array.isArray(params.to) ? params.to : [params.to];
    const ccArray = params.cc ? (Array.isArray(params.cc) ? params.cc : [params.cc]) : undefined;

    try {
      console.log('[Resend] Attempting to send email:', {
        from: params.from,
        to: toArray,
        cc: ccArray,
        subject: params.subject,
      });
      
      const result = await this.resend.emails.send({
        from: params.from,
        to: toArray,
        cc: ccArray,
        subject: params.subject,
        html: params.html,
        attachments: params.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: typeof attachment.content === 'string'
            ? Buffer.from(attachment.content).toString('base64')
            : attachment.content.toString('base64'),
          contentType: attachment.contentType,
        })),
      });
      
      console.log('[Resend] API Response:', JSON.stringify(result, null, 2));
      
      // Check if the response contains an error
      if (result.error) {
        console.error('[Resend] ❌ API returned error:', result.error);
        throw new Error(`Resend API error: ${result.error.message || JSON.stringify(result.error)}`);
      }
      
      // Check if we have data (successful response)
      if (!result.data) {
        console.error('[Resend] ❌ No data in API response');
        throw new Error('Resend API returned no data');
      }
      
      console.log(`[Resend] ✅ Email sent successfully to ${toArray.join(', ')}. Email ID: ${result.data.id}`);
    } catch (error) {
      console.error('[Resend] ❌ Email failed - Full error:', error);
      console.error('[Resend] Error type:', error instanceof Error ? error.constructor.name : typeof error);
      if (error instanceof Error) {
        console.error('[Resend] Error message:', error.message);
        console.error('[Resend] Error stack:', error.stack);
      }
      throw new Error(`Failed to send email via Resend: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * SMTP email provider implementation using Nodemailer
 */
export class SMTPProvider implements EmailProvider {
  private transporter: nodemailer.Transporter;

  constructor(settings: any) {
    if (!settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPassword) {
      throw new Error('SMTP configuration is incomplete');
    }

    this.transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure ?? true, // true for 465, false for other ports
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPassword,
      },
    });
  }

  async send(params: {
    from: string;
    to: string | string[];
    cc?: string | string[];
    subject: string;
    html: string;
    attachments?: EmailAttachment[];
  }): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: params.from,
        to: params.to,
        cc: params.cc,
        subject: params.subject,
        html: params.html,
        attachments: params.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          contentType: attachment.contentType,
        })),
      });
      console.log(`SMTP email sent: ${info.messageId}`);
    } catch (error) {
      console.error('SMTP email failed:', error);
      throw new Error(`Failed to send email via SMTP: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Factory function to create the appropriate email provider based on settings
 */
export function createEmailProvider(settings: any): EmailProvider {
  if (!settings.emailEnabled) {
    throw new Error('Email notifications are not enabled');
  }

  const provider = settings.emailProvider || 'resend';

  if (provider === 'smtp') {
    return new SMTPProvider(settings);
  } else if (provider === 'resend') {
    if (!settings.emailApiKey) {
      throw new Error('Resend API key is required');
    }
    return new ResendProvider(settings.emailApiKey);
  } else {
    throw new Error(`Unsupported email provider: ${provider}`);
  }
}
