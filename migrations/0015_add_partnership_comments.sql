-- Migration: Add partnership comments table
-- Description: Adds a commenting system to partnerships for team collaboration

CREATE TABLE partnership_comments (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  body_ar TEXT,
  author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IDX_partnership_comments_org_id ON partnership_comments(organization_id);
CREATE INDEX IDX_partnership_comments_author ON partnership_comments(author_user_id);
CREATE INDEX IDX_partnership_comments_created_at ON partnership_comments(created_at DESC);
