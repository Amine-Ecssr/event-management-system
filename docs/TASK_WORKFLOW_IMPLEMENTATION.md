# Task Workflow Dependencies - Implementation Plan

> **Status**: ✅ Core Implementation Complete  
> **Created**: December 7, 2025  
> **Last Updated**: December 7, 2025

## Executive Summary

This feature introduces **task template prerequisites** allowing departments to define task dependencies that form **workflows**. When tasks with prerequisites are added to events, the system automatically manages the workflow lifecycle, including status transitions and notifications.

---

## Implementation Progress

### Phase 1: Database Schema Changes ✅
- [x] 1.1 Create `task_template_prerequisites` table
- [x] 1.2 Create `event_workflows` table
- [x] 1.3 Create `workflow_tasks` table
- [x] 1.4 Add "waiting" status to tasks
- [x] 1.5 Update Drizzle schema (`shared/schema.ts`)
- [x] 1.6 Create migration file (`migrations/0005_add_workflow_tables.sql`)
- [x] 1.7 Update `migrations/meta/_journal.json` (CRITICAL!)

### Phase 2: Backend Implementation ✅
- [x] 2.1 Storage layer methods for prerequisites
- [x] 2.2 Storage layer methods for workflows
- [x] 2.3 WorkflowService implementation (`server/services/workflowService.ts`)
- [x] 2.4 Circular dependency validation
- [x] 2.5 API routes for prerequisites
- [x] 2.6 API routes for workflows
- [x] 2.7 Update task completion logic (activates dependent tasks)
- [x] 2.8 Update task deletion logic (blocks if prerequisite)
- [x] 2.9 Email notification for task activation (`sendTaskActivatedNotification`)

### Phase 3: Frontend Implementation ✅
- [x] 3.1 PrerequisiteSelector component
- [x] 3.2 Update Stakeholders page (prerequisite management)
  - ✅ Fixed field name mismatch (`prerequisiteId` → `prerequisiteTemplateId`)
  - ✅ Fixed delete endpoint to use correct ID
  - ✅ Added loading state for prerequisites
  - ✅ Fixed dropdown scrolling
- [x] 3.3 Update EventForm (auto-prerequisite selection)
- [x] 3.4 WorkflowVisualization component
- [x] 3.5 WorkflowTaskCard component (merged into WorkflowVisualization)
- [x] 3.6 New Workflows page
- [x] 3.7 Update Tasks page ("waiting" status)
- [x] 3.8 Update StakeholderDashboard ("waiting" status)
- [x] 3.9 Navigation updates (already configured)

### Phase 4: Internationalization ✅
- [x] 4.1 English translations (`workflows.json`)
- [x] 4.2 Arabic translations (`workflows.json`)
- [x] 4.3 Update existing translation files (tasks.json - waiting status)

### Phase 4.5: Sample Data ✅
- [x] 4.5.1 Update seed data with workflow imports
- [x] 4.5.2 Add cross-departmental prerequisite definitions to task templates
- [x] 4.5.3 Create `seedTaskTemplatePrerequisites()` function
- [x] 4.5.4 Create `createEventWorkflows()` function for sample events
- [x] 4.5.5 Update task creation to set 'waiting' status for tasks with unmet prerequisites

### Phase 5: Testing
- [ ] 5.1 Unit tests for WorkflowService
- [ ] 5.2 Integration tests for workflow API
- [ ] 5.3 Manual testing checklist

---

## Feature Requirements (from User)

1. **Task Template Prerequisites**
   - Select another task template as a prerequisite
   - Support multiple prerequisites (AND logic)
   - Support cross-department prerequisites
   - Prevent circular dependencies

2. **Workflow Behavior**
   - Tasks with prerequisites start as "waiting" (not "pending")
   - When prerequisite completes → dependent task becomes "pending"
   - Email notification sent when task becomes active
   - Support chains of dependencies (A→B→C)

3. **Event Task Creation**
   - Show confirmation dialog when selecting task with prerequisites
   - Auto-add all prerequisite tasks
   - Create workflow entry grouping related tasks

4. **Workflows Page**
   - New page showing all workflows per event
   - Toggle between list and diagram views
   - Department members see workflows they're part of
   - View-only access to other departments' tasks
   - Can comment on any task in visible workflows

5. **Task Deletion Rules**
   - Block deletion if task is a prerequisite
   - Superadmin can delete with warning (deletes full chain)

6. **Scope**
   - Only affects new events (no migration of existing data)

---

## Database Schema

### New Tables

#### `task_template_prerequisites`
Links task templates to their prerequisites.

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| task_template_id | INTEGER | NOT NULL, FK → department_requirements |
| prerequisite_template_id | INTEGER | NOT NULL, FK → department_requirements |
| created_at | TIMESTAMP | DEFAULT NOW() |

**Constraints**: UNIQUE(task_template_id, prerequisite_template_id)

#### `event_workflows`
Groups related tasks within an event.

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| event_id | VARCHAR | NOT NULL, FK → events |
| created_at | TIMESTAMP | DEFAULT NOW() |
| created_by_user_id | INTEGER | FK → users |

#### `workflow_tasks`
Links tasks to workflows (junction table).

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PRIMARY KEY |
| workflow_id | INTEGER | NOT NULL, FK → event_workflows |
| task_id | INTEGER | NOT NULL, FK → tasks |
| prerequisite_task_id | INTEGER | FK → tasks |
| order_index | INTEGER | NOT NULL, DEFAULT 0 |
| created_at | TIMESTAMP | DEFAULT NOW() |

**Constraints**: UNIQUE(workflow_id, task_id)

### Schema Modifications

#### `tasks` table
- Add "waiting" to status enum: `('pending', 'in_progress', 'completed', 'cancelled', 'waiting')`

---

## API Endpoints

### Task Template Prerequisites

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stakeholders/:id/requirements/:reqId/prerequisites` | Get prerequisites for a template |
| POST | `/api/stakeholders/:id/requirements/:reqId/prerequisites` | Add prerequisite |
| DELETE | `/api/stakeholders/:id/requirements/:reqId/prerequisites/:prereqId` | Remove prerequisite |
| GET | `/api/stakeholders/:id/requirements/available-prerequisites` | Get templates available as prerequisites |

### Event Workflows

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events/:eventId/workflows` | Get workflows for an event |
| GET | `/api/workflows/:workflowId` | Get workflow details |
| GET | `/api/workflows/:workflowId/tasks` | Get tasks in a workflow |

### Department Workflows

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/departments/:departmentId/workflows` | Get workflows for department |
| GET | `/api/my-workflows` | Get workflows for current user's department |

### Task Template Resolution

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/task-templates/resolve-prerequisites` | Resolve all prerequisites for selected templates |

---

## Component Structure

```
client/src/
├── pages/
│   └── Workflows.tsx                 # New workflows page
├── components/
│   ├── workflows/
│   │   ├── WorkflowVisualization.tsx # List/diagram view toggle
│   │   ├── WorkflowTaskCard.tsx      # Individual task card
│   │   ├── WorkflowDiagram.tsx       # Visual flow diagram
│   │   └── WorkflowList.tsx          # Table/list view
│   └── PrerequisiteSelector.tsx      # Prerequisite selection in dept form
└── i18n/locales/
    ├── en/workflows.json             # English translations
    └── ar/workflows.json             # Arabic translations
```

---

## Service Architecture

### WorkflowService (`server/services/workflowService.ts`)

```typescript
class WorkflowService {
  // Prerequisite resolution
  resolvePrerequisiteChain(taskTemplateId: number): Promise<DepartmentRequirement[]>
  validateNoCycle(taskTemplateId: number, prerequisiteTemplateId: number): Promise<boolean>
  getRequiredTaskTemplates(selectedTemplateIds: number[]): Promise<ResolvedTemplates>

  // Workflow management
  createTasksWithWorkflows(eventId, eventDepartmentId, templateIds, userId): Promise<WorkflowResult>
  handleTaskCompletion(taskId: number): Promise<ActivationResult>
  
  // Task deletion
  canDeleteTask(taskId, userId, userRole): Promise<DeletionValidation>
  deleteTaskWithChain(taskId: number, deleteChain: boolean): Promise<boolean>
}
```

---

## Email Templates

### Task Activated Notification

Sent when a prerequisite task is completed and dependent task becomes active.

**Variables**:
- `{{taskTitle}}` - Activated task title
- `{{eventName}}` - Event name
- `{{completedPrerequisiteTask}}` - Name of completed prerequisite
- `{{completedByDepartment}}` - Department that completed prerequisite

---

## Migration File

`migrations/0005_add_workflow_tables.sql`

```sql
-- Add 'waiting' to task status
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
  CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'waiting'));

-- Create prerequisite templates table
CREATE TABLE task_template_prerequisites (
  id SERIAL PRIMARY KEY,
  task_template_id INTEGER NOT NULL REFERENCES department_requirements(id) ON DELETE CASCADE,
  prerequisite_template_id INTEGER NOT NULL REFERENCES department_requirements(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(task_template_id, prerequisite_template_id)
);

-- Create workflows table
CREATE TABLE event_workflows (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Create workflow tasks junction
CREATE TABLE workflow_tasks (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES event_workflows(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  prerequisite_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(workflow_id, task_id)
);

-- Add indexes
CREATE INDEX idx_prerequisite_task_template ON task_template_prerequisites(task_template_id);
CREATE INDEX idx_prerequisite_template ON task_template_prerequisites(prerequisite_template_id);
CREATE INDEX idx_event_workflows_event_id ON event_workflows(event_id);
CREATE INDEX idx_workflow_tasks_workflow_id ON workflow_tasks(workflow_id);
CREATE INDEX idx_workflow_tasks_task_id ON workflow_tasks(task_id);
CREATE INDEX idx_workflow_tasks_prerequisite ON workflow_tasks(prerequisite_task_id);
```

---

## Testing Checklist

### Unit Tests
- [ ] Circular dependency detection (A→B→A blocked)
- [ ] Multi-level chain detection (A→B→C→A blocked)
- [ ] Cross-department prerequisite resolution
- [ ] Task status transition (waiting → pending)

### Integration Tests
- [ ] Create template with prerequisite
- [ ] Add task to event (workflow created)
- [ ] Complete prerequisite (dependent activated)
- [ ] Email sent on activation
- [ ] Delete prerequisite task (blocked)
- [ ] Superadmin chain deletion

### Manual Tests
- [ ] Circular dependency UI feedback
- [ ] Event form prerequisite confirmation
- [ ] Workflows page list view
- [ ] Workflows page diagram view
- [ ] Cross-department workflow visibility
- [ ] Comment on other department's task
- [ ] "Waiting" status display in Tasks page

---

## Rollback Plan

```sql
-- Rollback migration
DROP TABLE IF EXISTS workflow_tasks;
DROP TABLE IF EXISTS event_workflows;
DROP TABLE IF EXISTS task_template_prerequisites;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
  CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'));

-- Convert any 'waiting' tasks back to 'pending'
UPDATE tasks SET status = 'pending' WHERE status = 'waiting';
```

---

## Notes

- This feature only affects **new events**. Existing events are not migrated.
- Department requirement templates are used as the basis for task templates (reusing `department_requirements` table).
- The "workflow" concept groups tasks that share dependency relationships, not a separate named entity.
