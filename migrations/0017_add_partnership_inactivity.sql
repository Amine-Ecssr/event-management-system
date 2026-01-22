-- Migration: Add partnership inactivity monitoring fields
-- Description: Adds fields to track and notify on inactive partnerships

-- Add inactivity monitoring fields to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS inactivity_threshold_months INTEGER DEFAULT 6,
ADD COLUMN IF NOT EXISTS last_activity_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS notify_on_inactivity BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS last_inactivity_notification_sent TIMESTAMP;

-- Create index for efficient inactivity queries
CREATE INDEX IF NOT EXISTS IDX_organizations_last_activity ON organizations(last_activity_date);
CREATE INDEX IF NOT EXISTS IDX_organizations_inactivity_threshold ON organizations(inactivity_threshold_months) WHERE is_partner = true;

-- Update last_activity_date for existing partnerships based on their latest activity
UPDATE organizations o
SET last_activity_date = (
  SELECT MAX(pa.start_date)::timestamp
  FROM partnership_activities pa
  WHERE pa.organization_id = o.id
)
WHERE o.is_partner = true
AND o.last_activity_date IS NULL;

-- If no activities exist, use partnership start date as fallback
UPDATE organizations o
SET last_activity_date = (
  CASE 
    WHEN o.partnership_start_date IS NOT NULL THEN o.partnership_start_date::timestamp
    ELSE o.created_at
  END
)
WHERE o.is_partner = true
AND o.last_activity_date IS NULL;

COMMENT ON COLUMN organizations.inactivity_threshold_months IS 'Number of months of inactivity before notifications are sent (default: 6)';
COMMENT ON COLUMN organizations.last_activity_date IS 'Timestamp of the most recent partnership activity';
COMMENT ON COLUMN organizations.notify_on_inactivity IS 'Whether to send notifications when partnership is inactive';
COMMENT ON COLUMN organizations.last_inactivity_notification_sent IS 'Timestamp of the last inactivity notification sent';
