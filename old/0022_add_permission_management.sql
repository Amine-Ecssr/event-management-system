-- Migration: Add Permission Management System
-- Date: 2026-01-29
-- Description: Adds granular permission management with role-based defaults and user overrides

-- 1. Permissions catalog table
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  is_dangerous BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Role-based default permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role VARCHAR(50) NOT NULL,
  permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  granted BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(role, permission_id)
);

-- 3. User-specific permission overrides
CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL,
  granted_by INTEGER REFERENCES users(id),
  reason TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, permission_id)
);

-- 4. Permission audit log
CREATE TABLE IF NOT EXISTS permission_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  permission_id INTEGER REFERENCES permissions(id),
  action VARCHAR(20) NOT NULL,
  granted BOOLEAN,
  granted_by INTEGER REFERENCES users(id),
  reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON user_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_expires ON user_permissions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_permission_audit_user ON permission_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_time ON permission_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);

-- Seed permissions catalog
INSERT INTO permissions (name, resource, action, description, category, is_dangerous) VALUES
  -- Events
  ('events.create', 'events', 'create', 'Create new events', 'events', false),
  ('events.read', 'events', 'read', 'View events', 'events', false),
  ('events.update', 'events', 'update', 'Edit events', 'events', false),
  ('events.delete', 'events', 'delete', 'Delete events', 'events', true),
  ('events.import', 'events', 'import', 'Import events via CSV', 'events', false),
  ('events.export', 'events', 'export', 'Export events', 'events', false),
  ('events.manage_media', 'events', 'manage_media', 'Manage event photos/media', 'events', false),
  
  -- Tasks
  ('tasks.create', 'tasks', 'create', 'Create tasks', 'tasks', false),
  ('tasks.read', 'tasks', 'read', 'View tasks', 'tasks', false),
  ('tasks.update', 'tasks', 'update', 'Update task status', 'tasks', false),
  ('tasks.delete', 'tasks', 'delete', 'Delete tasks', 'tasks', true),
  ('tasks.assign', 'tasks', 'assign', 'Assign tasks to users', 'tasks', false),
  ('tasks.comment', 'tasks', 'comment', 'Comment on tasks', 'tasks', false),
  
  -- Partnerships
  ('partnerships.create', 'partnerships', 'create', 'Create partnerships', 'partnerships', false),
  ('partnerships.read', 'partnerships', 'read', 'View partnerships', 'partnerships', false),
  ('partnerships.update', 'partnerships', 'update', 'Edit partnerships', 'partnerships', false),
  ('partnerships.delete', 'partnerships', 'delete', 'Delete partnerships', 'partnerships', true),
  ('partnerships.export', 'partnerships', 'export', 'Export partnerships', 'partnerships', false),
  
  -- Contacts
  ('contacts.create', 'contacts', 'create', 'Create contacts', 'contacts', false),
  ('contacts.read', 'contacts', 'read', 'View contacts', 'contacts', false),
  ('contacts.update', 'contacts', 'update', 'Edit contacts', 'contacts', false),
  ('contacts.delete', 'contacts', 'delete', 'Delete contacts', 'contacts', true),
  ('contacts.import', 'contacts', 'import', 'Import contacts', 'contacts', false),
  ('contacts.export', 'contacts', 'export', 'Export contacts', 'contacts', false),
  
  -- Leads
  ('leads.create', 'leads', 'create', 'Create leads', 'leads', false),
  ('leads.read', 'leads', 'read', 'View leads', 'leads', false),
  ('leads.update', 'leads', 'update', 'Edit leads', 'leads', false),
  ('leads.delete', 'leads', 'delete', 'Delete leads', 'leads', true),
  
  -- Analytics
  ('analytics.view', 'analytics', 'view', 'View analytics dashboards', 'analytics', false),
  ('analytics.export', 'analytics', 'export', 'Export analytics data', 'analytics', false),
  ('analytics.executive', 'analytics', 'executive', 'View executive dashboard', 'analytics', false),
  
  -- Users
  ('users.create', 'users', 'create', 'Create users', 'users', true),
  ('users.read', 'users', 'read', 'View users', 'users', false),
  ('users.update', 'users', 'update', 'Edit users', 'users', true),
  ('users.delete', 'users', 'delete', 'Delete users', 'users', true),
  ('users.manage_permissions', 'users', 'manage_permissions', 'Manage user permissions', 'users', true),
  ('users.reset_password', 'users', 'reset_password', 'Reset user passwords', 'users', true),
  
  -- Settings
  ('settings.read', 'settings', 'read', 'View settings', 'settings', false),
  ('settings.update', 'settings', 'update', 'Modify system settings', 'settings', true),
  ('settings.email', 'settings', 'email', 'Configure email settings', 'settings', true),
  ('settings.whatsapp', 'settings', 'whatsapp', 'Configure WhatsApp settings', 'settings', true),
  
  -- Departments
  ('departments.create', 'departments', 'create', 'Create departments', 'departments', false),
  ('departments.read', 'departments', 'read', 'View departments', 'departments', false),
  ('departments.update', 'departments', 'update', 'Edit departments', 'departments', false),
  ('departments.delete', 'departments', 'delete', 'Delete departments', 'departments', true),
  
  -- Workflows
  ('workflows.create', 'workflows', 'create', 'Create workflows', 'workflows', false),
  ('workflows.read', 'workflows', 'read', 'View workflows', 'workflows', false),
  ('workflows.update', 'workflows', 'update', 'Edit workflows', 'workflows', false),
  ('workflows.delete', 'workflows', 'delete', 'Delete workflows', 'workflows', true),
  
  -- Reminders
  ('reminders.read', 'reminders', 'read', 'View reminders', 'reminders', false),
  ('reminders.trigger', 'reminders', 'trigger', 'Manually trigger reminders', 'reminders', false),
  ('reminders.delete', 'reminders', 'delete', 'Delete reminders', 'reminders', true),
  
  -- Updates (Weekly/Monthly)
  ('updates.create', 'updates', 'create', 'Create updates', 'updates', false),
  ('updates.read', 'updates', 'read', 'View updates', 'updates', false),
  ('updates.update', 'updates', 'update', 'Edit updates', 'updates', false),
  ('updates.delete', 'updates', 'delete', 'Delete updates', 'updates', true),
  ('updates.send', 'updates', 'send', 'Send updates to recipients', 'updates', false),
  
  -- Archive
  ('archive.read', 'archive', 'read', 'View archive', 'archive', false),
  ('archive.manage', 'archive', 'manage', 'Manage archive settings', 'archive', false),
  
  -- System
  ('elasticsearch.manage', 'elasticsearch', 'manage', 'Manage Elasticsearch', 'system', true),
  ('scrapers.manage', 'scrapers', 'manage', 'Manage scrapers', 'system', false),
  ('files.manage', 'files', 'manage', 'Manage file uploads', 'system', false)
ON CONFLICT (name) DO NOTHING;

-- Seed role permissions (default permissions for each role)

-- Superadmin: Gets ALL permissions (handled in code)

-- Admin: Most permissions except user deletion and some system settings
INSERT INTO role_permissions (role, permission_id, granted) 
SELECT 'admin', id, true FROM permissions 
WHERE name NOT IN (
  'users.delete', 
  'users.manage_permissions',
  'settings.update'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Division Head: Partnerships, analytics, events, contacts
INSERT INTO role_permissions (role, permission_id, granted)
SELECT 'division_head', id, true FROM permissions
WHERE name IN (
  'events.create', 'events.read', 'events.update', 'events.manage_media',
  'tasks.create', 'tasks.read', 'tasks.update', 'tasks.assign', 'tasks.comment',
  'partnerships.create', 'partnerships.read', 'partnerships.update', 'partnerships.export',
  'contacts.create', 'contacts.read', 'contacts.update', 'contacts.export',
  'leads.create', 'leads.read', 'leads.update',
  'analytics.view', 'analytics.export', 'analytics.executive',
  'departments.read',
  'reminders.read',
  'updates.read',
  'archive.read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Events Lead: Event and task management
INSERT INTO role_permissions (role, permission_id, granted)
SELECT 'events_lead', id, true FROM permissions
WHERE name IN (
  'events.create', 'events.read', 'events.update', 'events.export', 'events.manage_media',
  'tasks.create', 'tasks.read', 'tasks.update', 'tasks.assign', 'tasks.comment',
  'contacts.create', 'contacts.read', 'contacts.update', 'contacts.export',
  'leads.create', 'leads.read', 'leads.update',
  'departments.read',
  'reminders.read',
  'updates.read',
  'archive.read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Department Admin: Department-scoped management
INSERT INTO role_permissions (role, permission_id, granted)
SELECT 'department_admin', id, true FROM permissions
WHERE name IN (
  'events.read',
  'tasks.read', 'tasks.update', 'tasks.comment',
  'contacts.read',
  'departments.read', 'departments.update',
  'updates.create', 'updates.read', 'updates.update', 'updates.send',
  'archive.read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Department: View and task updates only
INSERT INTO role_permissions (role, permission_id, granted)
SELECT 'department', id, true FROM permissions
WHERE name IN (
  'events.read',
  'tasks.read', 'tasks.update', 'tasks.comment',
  'contacts.read',
  'departments.read',
  'updates.read',
  'archive.read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Employee: Task execution
INSERT INTO role_permissions (role, permission_id, granted)
SELECT 'employee', id, true FROM permissions
WHERE name IN (
  'events.read',
  'tasks.read', 'tasks.update', 'tasks.comment',
  'contacts.read',
  'archive.read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Viewer: Read-only
INSERT INTO role_permissions (role, permission_id, granted)
SELECT 'viewer', id, true FROM permissions
WHERE name IN (
  'events.read',
  'tasks.read',
  'partnerships.read',
  'contacts.read',
  'leads.read',
  'departments.read',
  'updates.read',
  'archive.read'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Add comment to document the permission system
COMMENT ON TABLE permissions IS 'Catalog of all available permissions in the system';
COMMENT ON TABLE role_permissions IS 'Default permissions granted to each role';
COMMENT ON TABLE user_permissions IS 'User-specific permission overrides (grant or deny)';
COMMENT ON TABLE permission_audit_log IS 'Audit trail of permission changes';
