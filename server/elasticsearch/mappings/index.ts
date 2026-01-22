/**
 * Mappings Index
 * 
 * Re-exports all index mappings for easy importing.
 * 
 * @module elasticsearch/mappings
 */

export * from './common-fields';
export { eventsMapping, archivedEventsMapping } from './events.mapping';
export { tasksMapping } from './tasks.mapping';
export { contactsMapping } from './contacts.mapping';
export { organizationsMapping } from './organizations.mapping';
export { agreementsMapping } from './agreements.mapping';
export { leadsMapping } from './leads.mapping';
export { departmentsMapping } from './departments.mapping';
export { attendeesMapping } from './attendees.mapping';
export { inviteesMapping } from './invitees.mapping';
export { interactionsMapping } from './interactions.mapping';
export { activitiesMapping } from './activities.mapping';
export { updatesMapping } from './updates.mapping';
