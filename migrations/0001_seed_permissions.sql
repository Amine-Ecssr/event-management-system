-- Seed Permission System Data
-- This file seeds all permissions and role-permission mappings

-- Insert all system permissions
INSERT INTO permissions (name, resource, action, description, category, is_dangerous) VALUES
  -- Events (7 permissions)
  ('events.create', 'events', 'create', 'Create new events', 'events', false),
  ('events.read', 'events', 'read', 'View events', 'events', false),
  ('events.update', 'events', 'update', 'Edit events', 'events', false),
  ('events.delete', 'events', 'delete', 'Delete events', 'events', true),
  ('events.import', 'events', 'import', 'Import events via CSV', 'events', false),
  ('events.export', 'events', 'export', 'Export events', 'events', false),
  ('events.manage_media', 'events', 'manage_media', 'Manage event photos/media', 'events', false),
  
  -- Tasks (6 permissions)
  ('tasks.create', 'tasks', 'create', 'Create tasks', 'tasks', false),
  ('tasks.read', 'tasks', 'read', 'View tasks', 'tasks', false),
  ('tasks.update', 'tasks', 'update', 'Update task status', 'tasks', false),
  ('tasks.delete', 'tasks', 'delete', 'Delete tasks', 'tasks', true),
  ('tasks.assign', 'tasks', 'assign', 'Assign tasks to users', 'tasks', false),
  ('tasks.comment', 'tasks', 'comment', 'Comment on tasks', 'tasks', false),
  
  -- Partnerships (5 permissions)
  ('partnerships.create', 'partnerships', 'create', 'Create partnerships', 'partnerships', false),
  ('partnerships.read', 'partnerships', 'read', 'View partnerships', 'partnerships', false),
  ('partnerships.update', 'partnerships', 'update', 'Edit partnerships', 'partnerships', false),
  ('partnerships.delete', 'partnerships', 'delete', 'Delete partnerships', 'partnerships', true),
  ('partnerships.export', 'partnerships', 'export', 'Export partnerships', 'partnerships', false),
  
  -- Contacts (6 permissions)
  ('contacts.create', 'contacts', 'create', 'Create contacts', 'contacts', false),
  ('contacts.read', 'contacts', 'read', 'View contacts', 'contacts', false),
  ('contacts.update', 'contacts', 'update', 'Edit contacts', 'contacts', false),
  ('contacts.delete', 'contacts', 'delete', 'Delete contacts', 'contacts', true),
  ('contacts.import', 'contacts', 'import', 'Import contacts', 'contacts', false),
  ('contacts.export', 'contacts', 'export', 'Export contacts', 'contacts', false),
  
  -- Leads (4 permissions)
  ('leads.create', 'leads', 'create', 'Create leads', 'leads', false),
  ('leads.read', 'leads', 'read', 'View leads', 'leads', false),
  ('leads.update', 'leads', 'update', 'Edit leads', 'leads', false),
  ('leads.delete', 'leads', 'delete', 'Delete leads', 'leads', true),
  
  -- Analytics (3 permissions)
  ('analytics.view', 'analytics', 'view', 'View analytics dashboards', 'analytics', false),
  ('analytics.export', 'analytics', 'export', 'Export analytics data', 'analytics', false),
  ('analytics.executive', 'analytics', 'executive', 'View executive dashboard', 'analytics', false),
  
  -- Users (6 permissions)
  ('users.create', 'users', 'create', 'Create users', 'users', true),
  ('users.read', 'users', 'read', 'View users', 'users', false),
  ('users.update', 'users', 'update', 'Edit users', 'users', true),
  ('users.delete', 'users', 'delete', 'Delete users', 'users', true),
  ('users.manage_permissions', 'users', 'manage_permissions', 'Manage user permissions', 'users', true),
  ('users.reset_password', 'users', 'reset_password', 'Reset user passwords', 'users', true),
  
  -- Settings (4 permissions)
  ('settings.read', 'settings', 'read', 'View settings', 'settings', false),
  ('settings.update', 'settings', 'update', 'Modify system settings', 'settings', true),
  ('settings.email', 'settings', 'email', 'Configure email settings', 'settings', true),
  ('settings.whatsapp', 'settings', 'whatsapp', 'Configure WhatsApp settings', 'settings', true),
  
  -- Departments (4 permissions)
  ('departments.create', 'departments', 'create', 'Create departments', 'departments', false),
  ('departments.read', 'departments', 'read', 'View departments', 'departments', false),
  ('departments.update', 'departments', 'update', 'Edit departments', 'departments', false),
  ('departments.delete', 'departments', 'delete', 'Delete departments', 'departments', true),
  
  -- Workflows (4 permissions)
  ('workflows.create', 'workflows', 'create', 'Create workflows', 'workflows', false),
  ('workflows.read', 'workflows', 'read', 'View workflows', 'workflows', false),
  ('workflows.update', 'workflows', 'update', 'Edit workflows', 'workflows', false),
  ('workflows.delete', 'workflows', 'delete', 'Delete workflows', 'workflows', true),
  
  -- Reminders (3 permissions)
  ('reminders.read', 'reminders', 'read', 'View reminders', 'reminders', false),
  ('reminders.trigger', 'reminders', 'trigger', 'Manually trigger reminders', 'reminders', false),
  ('reminders.delete', 'reminders', 'delete', 'Delete reminders', 'reminders', true),
  
  -- Updates (5 permissions)
  ('updates.create', 'updates', 'create', 'Create updates', 'updates', false),
  ('updates.read', 'updates', 'read', 'View updates', 'updates', false),
  ('updates.update', 'updates', 'update', 'Edit updates', 'updates', false),
  ('updates.delete', 'updates', 'delete', 'Delete updates', 'updates', true),
  ('updates.send', 'updates', 'send', 'Send updates to recipients', 'updates', false),
  
  -- Archive (2 permissions)
  ('archive.read', 'archive', 'read', 'View archive', 'archive', false),
  ('archive.manage', 'archive', 'manage', 'Manage archive settings', 'archive', false),
  
  -- System (3 permissions)
  ('elasticsearch.manage', 'elasticsearch', 'manage', 'Manage Elasticsearch', 'system', true),
  ('scrapers.manage', 'scrapers', 'manage', 'Manage scrapers', 'system', false),
  ('files.manage', 'files', 'manage', 'Manage file uploads', 'system', false)
ON CONFLICT (name) DO NOTHING;

-- Seed role permissions for all 8 roles

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

-- Summary
DO $$
DECLARE
    perm_count INT;
    role_perm_count INT;
BEGIN
    SELECT COUNT(*) INTO perm_count FROM permissions;
    SELECT COUNT(*) INTO role_perm_count FROM role_permissions;
    
    RAISE NOTICE '✅ Seeded % permissions', perm_count;
    RAISE NOTICE '✅ Seeded % role-permission mappings', role_perm_count;
END $$;