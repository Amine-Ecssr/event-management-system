# USER:

/plan 

Prepare a plan to do the following:

When defining a task template under departments, we can select another task template (from the same department or otherwise), as a prerequisite.

If a task template has a prequisite it means the following:
- That task cannot be added to an event without adding its prerequisite as well (Should be handled automatically and in a user friendly way)
- That task will start as "waiting" and not "pending"
- Once added to an event, a new entry will be added under that event with the label "workflow", it will include all the tasks that are tied in this fashion for that event, but here we are linking IDs, and keeping the original storage in tact.
- When a prerequisite task is marked as done, the dependant task is moved automatically from "waiting" to "pending", with an email alert sent to the department emails related to the now "pending" task.
- We should support chains of dependencies, such as three stages of tasks all relying on each other and potentially under different departments
- For department members, and admins who are part of departments, this will be reflected in a new page, how this differs from the existing "my tasks" and "tasks" pages is that it will show all the flows per event, and which task is currently the active task and which ones are waiting. This should be viewable by all departments who have any task within that workflow. This means that the department members can view the relevant tasks, comments etc.. To allow for better collaboration. 

Ask if you have any questions.


# Agent:

I'll analyze this feature request carefully and ask some clarifying questions before preparing a comprehensive plan.

## Clarifying Questions

### 1. **Task Template Prerequisites**
- Should a task template be able to have **multiple prerequisites** (e.g., Task C requires both Task A AND Task B to be completed)? Or is it strictly linear (one prerequisite per task)?
- Can prerequisites form **parallel branches** that merge? (e.g., Task D waits for both Task B and Task C, which both depend on Task A)

### 2. **Workflow Behavior**
- When adding a task with a prerequisite to an event, should the system:
  - **Option A**: Automatically add all prerequisite tasks in the chain silently?
  - **Option B**: Show a confirmation dialog listing all tasks that will be added?
  - **Option C**: Prevent adding unless prerequisites are manually added first?

### 3. **Task Status Model**
- Currently, what are the existing task statuses? I see references to task management but need to confirm:
  - Are you adding "waiting" as a **new status**, alongside existing ones like "pending", "in_progress", "completed"?
  - Should "waiting" tasks be visible in the regular task lists, or hidden until they become "pending"?

### 4. **Workflow Entry Storage**
- When you say "a new entry will be added under that event with the label 'workflow'":
  - Is this a **new database table** (e.g., `event_workflows`) that groups related tasks?
  - Should one event support **multiple independent workflows**? (e.g., Event X has Workflow 1: A→B→C and Workflow 2: D→E)

### 5. **Email Notifications**
- For the email alert when a task moves from "waiting" to "pending":
  - Should this use the existing email templates system?
  - Should it include context about the completed prerequisite task?

### 6. **Workflow Visualization Page**
- For the new "Workflows" page:
  - Should it show a **visual diagram** (like a flowchart/Kanban) of the task chain?
  - Or a **list/table view** with status indicators?
  - Should users be able to **interact** with tasks directly from this view (mark complete, add comments)?

### 7. **Permissions**
- You mentioned department members can view relevant tasks in workflows they're part of. Should they:
  - **View only** tasks from other departments?
  - **Comment** on tasks from other departments?
  - Have any ability to **modify** tasks from other departments?

### 8. **Circular Dependency Prevention**
- Should the system validate and prevent circular dependencies (A→B→C→A) at the template level?

### 9. **Existing Events**
- If a task template is updated to add a prerequisite, should this affect:
  - Only **new** event tasks going forward?
  - Or should existing events be updated/migrated?

### 10. **Breaking the Chain**
- If someone manually deletes a task that is a prerequisite for another task:
  - Should the dependent task automatically become "pending"?
  - Should deletion be blocked?
  - Should it require confirmation with a warning?

---

Please answer these questions so I can prepare a detailed implementation plan that covers:
1. Database schema changes
2. Backend API modifications
3. Frontend UI components
4. Workflow logic and state management
5. Email notification integration
6. Migration strategy


# User:
1. yes to both, but handle gracefully in the UI

2. option B, but in our current UI we have check boxes, so that check must be done and then the user will submit to save the event

3. Yes, waiting is a new status, and the tasks should be visible, the user will still be able to see why it is waiting in the workflow page

4. I would rely on you for the cleanest implementation, my opinion is yes, a new table could prove useful
Yes, one event can have multople flows
Note that we don't necessarily need to name the flows if we can see all the tasks under it it should be self explanatory

5. Yes, there should already be an email sent to a configured email per task, if that feature isn't working you need to fix and improve it

6. Allow the user to toggle view, and to interact with the tasks, perhaps similar to what we did in the events page where clicking on a task takes you to the tasks page

7. Only view and comment and view the comments, not modify such as change state

8. Yes, good catch

9. New events only to avoid any issues

10. Deletion should be blocked, if it is a superadmin they should be warned and in that case they can delete the full chain
