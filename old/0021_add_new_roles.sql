-- Migration: Add new user roles
-- Date: 2026-01-29
-- Description: Adds events_lead, division_head, employee, and viewer roles

-- Add comment to document new roles
COMMENT ON COLUMN users.role IS 'User role: superadmin, admin, department, department_admin, events_lead, division_head, employee, viewer';

-- Note: No ALTER TABLE needed since role column is text type
-- This migration documents the new allowed role values
