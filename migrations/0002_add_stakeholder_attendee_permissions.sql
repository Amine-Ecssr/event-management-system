-- Add stakeholder attendee upload permission fields to settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS allow_stakeholder_attendee_upload BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS stakeholder_upload_permissions JSONB;

-- Comment for documentation
COMMENT ON COLUMN settings.allow_stakeholder_attendee_upload IS 'Global toggle to allow stakeholders to upload/download event attendees';
COMMENT ON COLUMN settings.stakeholder_upload_permissions IS 'JSON object mapping stakeholder IDs to upload permissions {stakeholderId: boolean}';
