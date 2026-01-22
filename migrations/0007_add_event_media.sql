-- Migration: Add event_media table for event images
-- This table stores media for regular events (similar to archive_media for archived events)
-- When an event is archived, these media references are preserved and linked to the archive

CREATE TABLE IF NOT EXISTS "event_media" (
  "id" SERIAL PRIMARY KEY,
  "event_id" VARCHAR NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  
  -- MinIO storage info
  "object_key" TEXT NOT NULL UNIQUE,
  "thumbnail_key" TEXT,
  
  -- File metadata
  "original_file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  
  -- Display info
  "caption" TEXT,
  "caption_ar" TEXT,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  "uploaded_by_user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "uploaded_at" TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "IDX_event_media_event_id" ON "event_media"("event_id");
CREATE INDEX IF NOT EXISTS "IDX_event_media_display_order" ON "event_media"("event_id", "display_order");

-- Add a reference field to archive_media to link back to original event media
-- This allows us to track which event media was copied to archive
ALTER TABLE "archive_media" ADD COLUMN IF NOT EXISTS "original_event_media_id" INTEGER REFERENCES "event_media"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "IDX_archive_media_original_event_media_id" ON "archive_media"("original_event_media_id");
