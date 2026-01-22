# Lead Management System

## Overview

The **Lead Management System** is a simple, lightweight feature for tracking leads and managing interactions with them. Unlike a full sales pipeline, this system focuses on:

- **Tracking Leads**: Leads, partners, customers, and other external entities
- **Logging Interactions**: Record communications (emails, calls, meetings)
- **Managing Tasks**: Assign follow-up tasks to departments (stakeholders)

This feature is available to **Admin** and **Superadmin** users only.

---

## 📊 Data Model

### Database Tables

The feature uses two main tables plus the unified `tasks` table:

#### 1. `leads` Table

Stores leads being tracked:

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `name` | TEXT | Contact/organization name (required) |
| `name_ar` | TEXT | Arabic name (optional) |
| `email` | TEXT | Email address |
| `phone` | TEXT | Phone number |
| `type` | TEXT | Contact type: `lead`, `partner`, `customer`, `vendor`, `other` |
| `status` | TEXT | Status: `active`, `in_progress`, `inactive` |
| `organization_id` | INTEGER | Optional FK to organizations |
| `organization_name` | TEXT | Organization name for display |
| `notes` | TEXT | General notes |
| `notes_ar` | TEXT | Arabic notes |
| `created_by_user_id` | INTEGER | FK to users |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

#### 2. `lead_interactions` Table

Logs all interactions with a lead:

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `lead_id` | INTEGER | FK to leads (CASCADE delete) |
| `type` | TEXT | Type: `email`, `phone_call`, `meeting`, `other` |
| `description` | TEXT | Interaction description (required) |
| `description_ar` | TEXT | Arabic description |
| `outcome` | TEXT | Optional outcome notes |
| `outcome_ar` | TEXT | Arabic outcome |
| `interaction_date` | TIMESTAMP | When the interaction occurred |
| `created_by_user_id` | INTEGER | FK to users |
| `created_at` | TIMESTAMP | Creation timestamp |

#### 3. `tasks` Table (Lead Tasks)

Lead-related tasks use the unified `tasks` table with `lead_id` set instead of `event_department_id`:

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `lead_id` | INTEGER | FK to leads (CASCADE delete) - set for lead tasks |
| `event_department_id` | INTEGER | FK to event_departments - NULL for lead tasks |
| `title` | TEXT | Task title (required) |
| `title_ar` | TEXT | Arabic title |
| `description` | TEXT | Task description |
| `description_ar` | TEXT | Arabic description |
| `status` | TEXT | Status: `pending`, `in_progress`, `completed`, `cancelled`, `waiting` |
| `priority` | TEXT | Priority: `high`, `medium`, `low` |
| `due_date` | DATE | Due date |
| `department_id` | INTEGER | FK to departments (stakeholder assignment) |
| `completed_at` | TIMESTAMP | When task was completed |
| `created_by_user_id` | INTEGER | FK to users |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |
| `notification_emails` | TEXT[] | Emails to notify on completion |

---

## 🔌 API Endpoints

### Leads

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leads` | List all leads (with optional `?search=` filter) |
| GET | `/api/leads/:id` | Get single lead |
| POST | `/api/leads` | Create new lead |
| PUT | `/api/leads/:id` | Update lead |
| DELETE | `/api/leads/:id` | Delete lead (cascades to interactions/tasks) |

### Interactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leads/:id/interactions` | Get all interactions for a lead |
| POST | `/api/leads/:id/interactions` | Create new interaction |
| PUT | `/api/lead-interactions/:id` | Update interaction |
| DELETE | `/api/lead-interactions/:id` | Delete interaction |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leads/:id/tasks` | Get all tasks for a lead (with department info) |
| POST | `/api/leads/:id/tasks` | Create new task |
| PUT | `/api/lead-tasks/:id` | Update task |
| DELETE | `/api/lead-tasks/:id` | Delete task |
| PUT | `/api/lead-tasks/:id/complete` | Complete a task |

---

## 🖥️ Frontend Pages

### 1. Lead List (`/admin/leads`)

**File**: `client/src/pages/LeadManagement.tsx`

Features:
- Grid view of all leads as cards
- Search leads by name
- Filter by type (lead, partner, customer)
- Filter by status (active, in_progress, inactive)
- Create/edit lead modal
- Delete confirmation dialog
- Click card to view details

### 2. Lead Detail (`/admin/leads/:id`)

**File**: `client/src/pages/LeadDetail.tsx`

Features:
- Lead information display
- Summary statistics (total interactions, pending tasks)
- **Interactions Tab**:
  - Timeline of all interactions
  - Add/edit/delete interactions
  - Type icons (email, phone, meeting)
  - Outcome display
- **Tasks Tab**:
  - List of tasks with status indicators
  - Checkbox to toggle completion
  - Priority badges (high=red, medium=default, low=gray)
  - Due date display
  - Department assignment dropdown
  - Add/edit/delete tasks

---

## 📁 File Structure

```
client/src/
├── pages/
│   ├── LeadManagement.tsx       # Lead list page
│   └── LeadDetail.tsx           # Lead detail page
├── i18n/locales/
│   ├── en/leads.json           # English translations
│   └── ar/leads.json           # Arabic translations

server/
├── routes/                      # Route modules
│   └── lead.routes.ts           # API endpoints
├── repositories/                # Data access
│   └── lead-repository.ts       # Database methods

shared/
└── schema.ts                    # Table definitions and Zod schemas

migrations/
├── 0009_add_contact_workflow.sql  # Initial creation (old table names)
└── 0010_rename_lead_tables.sql    # Renamed tables to leads/lead_interactions
```

---

## 🌐 Navigation

The feature is accessible from the admin sidebar:
- **Menu Item**: "Lead Management" (English) / "إدارة العملاء المحتملين" (Arabic)
- **Icon**: Users icon
- **Path**: `/admin/leads`
- **Access**: Admin and Superadmin only

---

## 🎨 i18n Translations

Translation keys are in `client/src/i18n/locales/{en,ar}/leads.json`:

Key areas:
- `leads.title` - Page title
- `leads.types.*` - Contact types (lead, partner, customer)
- `leads.statuses.*` - Contact statuses
- `leads.interactions.*` - Interaction-related strings
- `leads.tasks.*` - Task-related strings
- `leads.messages.*` - Toast notifications

---

## 🔑 Key Design Decisions

1. **Tasks Assigned to Departments**: Unlike a sales pipeline where tasks are assigned to individual users, lead tasks are assigned to **departments** (stakeholders). This aligns with EventVue's existing task assignment pattern.

2. **Simple Status Model**: Leads have three statuses (`active`, `in_progress`, `inactive`) rather than a complex pipeline with multiple stages.

3. **No Pipeline/Kanban**: This is a simple list-based workflow, not a sales pipeline with stages.

4. **Cascading Deletes**: Deleting a lead automatically deletes all its interactions and tasks.

5. **Department Integration**: Tasks use the existing `departments` table for assignment, allowing stakeholders to see their lead-related tasks.

---

## 🚀 Future Enhancements

Potential additions if needed:
- [ ] Kanban board view for leads
- [ ] Lead import/export (CSV)
- [ ] Email integration for logging interactions
- [ ] File attachments on interactions
- [ ] Conversion to Partner (link to Partnerships feature)
- [ ] Task reminders/notifications
- [ ] Activity analytics/reports
