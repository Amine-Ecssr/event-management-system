# Event Invitation Email Feature

This document describes the implementation of the event invitation email feature.

## Overview

The invitation email feature allows administrators to send invitation emails to event invitees. It supports both:
1. **Generic Template Emails** - Uses system-wide template with dynamic event data
2. **Custom Emails** - Fully customizable per-event emails with no variable replacement

## Key Features

### 1. Dual Email Types

#### Generic Template
- Uses the system-wide "invitation" email template
- Dynamically fills in event details (name, date, location, etc.)
- Supports bilingual templates (English/Arabic)
- Maintains consistent branding across all events

#### Custom Email
- Fully customizable subject and body per event
- No variable replacement - sent as-is
- Admin has complete control over content
- Ideal for special events requiring unique messaging

### 2. Rate-Limited Email Sending

- Emails are sent one-by-one with configurable wait times (1-60 seconds)
- Prevents overwhelming email servers
- Configurable per job to adjust for different scenarios
- Default wait time: 2 seconds

### 3. Job-Based Processing

- All bulk email sending is handled through background jobs
- Job tracks:
  - Total recipients
  - Emails sent/failed
  - Progress percentage
  - Start/completion timestamps
  - Error messages
- Jobs can be monitored in real-time
- Jobs can be cancelled mid-process

### 4. Test Email Functionality

- Send test emails before bulk sending
- Works with both generic and custom templates
- Helps verify email content and deliverability

### 5. Invitee Tracking

- Tracks which invitees have received invitation emails
- Updates `invite_email_sent` and `invite_email_sent_at` flags
- Prevents duplicate email sends
- Integrates with engagement analytics

## Architecture

### Database Schema

#### `email_config` (extended)
```sql
- invitation_from_email: Dedicated sender email for invitations
- invitation_from_name: Dedicated sender name for invitations
```

#### `email_templates` (extended)
```sql
- New type: 'invitation' for invitation email templates
- Supports both English and Arabic
```

#### `event_custom_emails`
```sql
- id: Primary key
- event_id: Foreign key to events
- subject: Email subject
- body: Email body (HTML)
- is_active: Only one active per event
- created_at, updated_at: Timestamps
- created_by_user_id: User who created the template
```

#### `invitation_email_jobs`
```sql
- id: Primary key
- event_id: Foreign key to events
- status: pending | in_progress | completed | failed | cancelled
- total_recipients: Number of invitees
- emails_sent: Successfully sent count
- emails_failed: Failed send count
- wait_time_seconds: Wait time between emails
- use_custom_email: Whether to use custom or generic template
- started_at, completed_at: Job lifecycle timestamps
- error_message: Error details if failed
- created_by_user_id: User who started the job
```

### Backend Components

#### `invitationEmailService.ts`
- Main service for managing invitation email jobs
- Handles job creation, processing, and cancellation
- Implements rate limiting via sleep function
- Tracks active jobs in memory
- Processes jobs asynchronously

#### Email Service Extensions (`email.ts`)
- `sendInvitationEmail()`: Sends generic template email
- `sendCustomInvitationEmail()`: Sends custom email
- `formatInvitationEmail()`: Formats generic template with data

#### Storage Extensions (`storage.ts`)
- `getEmailTemplate()`: Retrieves email template
- `getEventCustomEmail()`: Gets active custom email for event
- `createEventCustomEmail()`: Creates/updates custom email
- `updateEventCustomEmail()`: Updates existing custom email
- `deleteEventCustomEmail()`: Deletes custom email

#### API Endpoints

##### Custom Email Management
- `GET /api/events/:eventId/custom-email` - Get custom email
- `POST /api/events/:eventId/custom-email` - Create/update custom email
- `DELETE /api/events/:eventId/custom-email/:id` - Delete custom email

##### Email Sending
- `POST /api/events/:eventId/send-test-invitation` - Send test email
- `POST /api/events/:eventId/send-invitations` - Start bulk send job

##### Job Management
- `GET /api/events/:eventId/invitation-jobs` - Get all jobs for event
- `GET /api/invitation-jobs/:jobId` - Get single job details
- `POST /api/invitation-jobs/:jobId/cancel` - Cancel running job

### Frontend Component

#### `InvitationEmailManager.tsx`
A comprehensive React component with three tabs:

1. **Generic Template Tab**
   - Test email input
   - Wait time configuration
   - Bulk send button

2. **Custom Email Tab**
   - Subject and body editors
   - Save custom template button
   - Test email functionality
   - Bulk send with custom template

3. **Email Jobs Tab**
   - Real-time job status monitoring
   - Progress bars for in-progress jobs
   - Job cancellation
   - Error display

## Configuration

### Email Settings

Add invitation-specific sender configuration in Email Config:

```typescript
{
  invitationFromEmail: "invitations@ecssr.ae",
  invitationFromName: "ECSSR Events Team"
}
```

If not configured, falls back to regular email settings.

### Default Templates

The migration creates default English and Arabic invitation templates:

**English:**
- Subject: "You are invited: {{eventName}}"
- Body: Event details with styling
- Greeting: "Dear {{contactName}},"

**Arabic:**
- Subject: "دعوة للحضور: {{eventName}}"
- Body: Event details RTL formatted
- Greeting: "عزيزي {{contactName}}،"

## Usage Flow

### For Generic Template Emails

1. Admin navigates to event invitees management
2. Opens invitation email manager
3. Goes to "Generic Template" tab
4. (Optional) Sends test email to verify content
5. Configures wait time between emails
6. Clicks "Send Invitations to All Invitees"
7. Job is created and starts processing
8. Monitor progress in "Email Jobs" tab

### For Custom Emails

1. Admin navigates to event invitees management
2. Opens invitation email manager
3. Goes to "Custom Email" tab
4. Writes custom subject and HTML body
5. Clicks "Save Custom Email"
6. (Optional) Sends test email
7. Configures wait time
8. Clicks "Send Custom Invitations to All Invitees"
9. Job is created and processes using custom template
10. Monitor progress in "Email Jobs" tab

### Monitoring and Management

- Real-time progress updates every 2 seconds for active jobs
- View detailed statistics (sent, failed, progress %)
- Cancel jobs if needed
- Review error messages for failed jobs
- Historical job records preserved

## Security Considerations

- All endpoints require admin or superadmin role
- Custom emails are sanitized on display (not in storage)
- Email addresses validated before sending
- Rate limiting prevents email server abuse
- Job cancellation immediately stops processing

## Error Handling

- Failed individual emails logged but don't stop job
- Failed email count tracked separately
- Job status set to 'failed' if critical error occurs
- Error messages captured for debugging
- Invitees with failed sends can be retried

## Performance

- Asynchronous job processing doesn't block API
- Configurable wait times balance speed vs server load
- Memory-efficient job tracking
- Database queries optimized with indexes
- Real-time updates throttled to 2-second intervals

## Future Enhancements

Potential improvements:
- Email preview before sending
- Scheduled sending (send at specific time)
- Retry failed sends automatically
- Email open/click tracking
- A/B testing different templates
- Rich text editor for custom emails
- Template variables in custom emails
- Bulk actions (pause, resume jobs)
- Email delivery reports

## Template Variables

Generic template supports these variables:
- `{{eventName}}` - Event name
- `{{description}}` - Event description
- `{{startDate}}` - Start date formatted
- `{{endDate}}` - End date formatted
- `{{startTime}}` - Start time
- `{{endTime}}` - End time
- `{{location}}` - Event location
- `{{organizers}}` - Event organizers
- `{{category}}` - Event category
- `{{eventType}}` - Event type
- `{{url}}` - Event URL
- `{{contactName}}` - Invitee name
- `{{brandColor}}` - Template brand color

## Integration Points

- **Invitees System**: Uses event_invitees table for recipient list
- **Email Config**: Uses dedicated invitation sender settings
- **Email Templates**: Leverages template system for generic emails
- **Engagement Analytics**: Updates tracking flags for analytics
- **ICS Attachments**: Includes calendar file with all invitations

## Troubleshooting

### Emails Not Sending
1. Check email configuration is enabled
2. Verify invitation sender email is configured
3. Check SMTP/Resend credentials
4. Review job error messages

### Custom Email Not Available
1. Ensure custom email was saved successfully
2. Check that `isActive` flag is true
3. Verify no conflicts with event ID

### Job Stuck in Progress
1. Check application logs for errors
2. Verify job service is running
3. Cancel and restart if needed

### Rate Limiting Issues
1. Increase wait time between emails
2. Check email provider rate limits
3. Verify SMTP server capacity

## Database Migration

Run migration `0004_add_invitation_email_features.sql` to:
- Add invitation email config columns
- Create event_custom_emails table
- Create invitation_email_jobs table
- Add default invitation templates (EN/AR)
