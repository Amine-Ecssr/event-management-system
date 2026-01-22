/**
 * AI Tools Module
 * 
 * Defines specialized tools for the agentic RAG architecture.
 * Each tool is a discrete capability that the AI can invoke to
 * retrieve data from different sources.
 * 
 * @module services/ai/tools
 */

import { 
  AiTool, 
  ToolResult, 
  ToolSchemas,
  SearchEventsParams,
  SearchTasksParams,
} from './types';
import { storage } from '../../repositories';

// ============================================================================
// Tool Result Helpers
// ============================================================================

function successResult(data: unknown, summary?: string): ToolResult {
  return {
    success: true,
    data,
    summary: summary || `Found ${Array.isArray(data) ? data.length : 1} result(s)`,
  };
}

function errorResult(error: string): ToolResult {
  return {
    success: false,
    data: null,
    error,
  };
}

function formatEventForContext(event: any): Record<string, unknown> {
  return {
    id: event.id,
    title: event.name || event.title,
    description: event.description?.substring(0, 300),
    startDate: event.startDate,
    endDate: event.endDate,
    location: event.location,
    status: event.status,
    category: event.category,
    eventType: event.eventType,
    isExternal: event.isExternal,
  };
}

function formatTaskForContext(task: any): Record<string, unknown> {
  return {
    id: task.id,
    title: task.title,
    description: task.description?.substring(0, 200),
    dueDate: task.dueDate,
    status: task.status,
    priority: task.priority,
    eventTitle: task.eventTitle,
    departmentName: task.departmentName,
    taskType: task.taskType,
  };
}

function formatContactForContext(contact: any): Record<string, unknown> {
  return {
    id: contact.id,
    name: contact.nameEn || contact.name,
    email: contact.email,
    organization: contact.organization?.nameEn || contact.organizationId,
    type: contact.type,
  };
}

function formatPartnershipForContext(partnership: any): Record<string, unknown> {
  return {
    id: partnership.id,
    name: partnership.nameEn || partnership.name,
    status: partnership.partnershipStatus || partnership.status,
    type: partnership.partnershipType?.nameEn || partnership.type,
    lastActivityDate: partnership.lastActivityDate,
  };
}

function formatLeadForContext(lead: any): Record<string, unknown> {
  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    status: lead.status,
    organizationName: lead.organizationName,
    notes: lead.notes?.substring(0, 200),
    createdAt: lead.createdAt,
  };
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Search Events Tool
 * Searches events with proper date filtering
 */
async function searchEvents(params: SearchEventsParams): Promise<ToolResult> {
  try {
    console.log('[AI Tool] searchEvents called with:', JSON.stringify(params));
    
    // Get all events from storage
    let events: any[] = await storage.getAllEvents();
    const totalEvents = events.length;
    
    // Apply date range filter - includes ongoing events that overlap with the range
    if (params.dateRange) {
      const { start, end, field = 'startDate' } = params.dateRange;
      const rangeStart = start ? new Date(start) : null;
      const rangeEnd = end ? new Date(end) : null;
      
      events = events.filter((e: any) => {
        const eventStart = e.startDate ? new Date(e.startDate) : null;
        const eventEnd = e.endDate ? new Date(e.endDate) : null;
        
        // If no event dates, exclude
        if (!eventStart) return false;
        
        // For events, check if they OVERLAP with the date range (not just start within it)
        // An event overlaps if: eventStart <= rangeEnd AND eventEnd >= rangeStart
        // This catches: events starting in range, events ending in range, and events spanning the range
        
        if (field === 'startDate') {
          // Check for overlap with the date range
          const effectiveEventEnd = eventEnd || eventStart; // Single-day event if no end date
          
          // Event overlaps if it starts before range ends AND ends after range starts
          if (rangeStart && effectiveEventEnd < rangeStart) return false; // Event ends before range starts
          if (rangeEnd && eventStart > rangeEnd) return false; // Event starts after range ends
          
          return true;
        } else {
          // For other fields (endDate, dueDate), use exact matching
          const eventDate = e[field] ? new Date(e[field]) : null;
          if (!eventDate) return false;
          if (rangeStart && eventDate < rangeStart) return false;
          if (rangeEnd && eventDate > rangeEnd) return false;
          return true;
        }
      });
    }
    
    // Apply status filter
    if (params.status?.length) {
      events = events.filter((e: any) => params.status!.includes(e.status));
    }
    
    // Apply category filter - use flexible matching
    if (params.category) {
      const categoryLower = params.category.toLowerCase();
      // Extract keywords from category (e.g., "Energy and Environment" -> ["energy", "environment"])
      const categoryKeywords = categoryLower.split(/[\s,&]+/).filter(k => k.length > 2);
      
      events = events.filter((e: any) => {
        const eventCategory = (e.category || '').toLowerCase();
        const eventName = (e.name || e.title || '').toLowerCase();
        const eventDesc = (e.description || '').toLowerCase();
        
        // Match if category contains the filter OR any keyword matches in name/category/description
        return eventCategory.includes(categoryLower) ||
               categoryKeywords.some(k => eventCategory.includes(k) || eventName.includes(k) || eventDesc.includes(k));
      });
    }

    // Apply text search if provided - improved to handle multiple keywords
    if (params.query) {
      const lowerQuery = params.query.toLowerCase();
      // Split query into keywords and search each one
      const keywords = lowerQuery.split(/\s+/).filter(k => k.length > 2);
      
      events = events.filter((e: any) => {
        const searchableText = [
          e.name,
          e.title,
          e.description,
          e.location,
          e.category,
          e.eventType
        ].filter(Boolean).join(' ').toLowerCase();
        
        // If we have multiple keywords, require at least one to match
        // Also try matching the full query as a phrase
        const fullQueryMatch = searchableText.includes(lowerQuery);
        const keywordMatches = keywords.filter(keyword => searchableText.includes(keyword));
        
        // Match if: full phrase matches OR at least half of keywords match OR any keyword matches in name/title
        return fullQueryMatch || 
               keywordMatches.length >= Math.ceil(keywords.length / 2) ||
               keywords.some(k => (e.name || e.title || '').toLowerCase().includes(k));
      });
    }

    // Apply sort
    if (params.sortBy) {
      events.sort((a, b) => {
        const aVal = a[params.sortBy!.field];
        const bVal = b[params.sortBy!.field];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return params.sortBy!.direction === 'desc' ? -comparison : comparison;
      });
    } else {
      // Default sort by start date ascending
      events.sort((a, b) => {
        const aDate = a.startDate ? new Date(a.startDate).getTime() : 0;
        const bDate = b.startDate ? new Date(b.startDate).getTime() : 0;
        return aDate - bDate;
      });
    }

    // Apply limit
    events = events.slice(0, params.limit || 10);

    const formattedEvents = events.map(formatEventForContext);
    
    return successResult(
      formattedEvents,
      `Found ${formattedEvents.length} event(s)` + 
        (params.dateRange ? ` from ${params.dateRange.start || 'beginning'} to ${params.dateRange.end || 'end'}` : '')
    );
  } catch (error) {
    console.error('[AI Tool] searchEvents error:', error);
    return errorResult(`Failed to search events: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Search Tasks Tool
 * Searches tasks with filtering by status, priority, and due dates
 */
async function searchTasks(params: SearchTasksParams): Promise<ToolResult> {
  try {
    console.log('[AI Tool] searchTasks called with:', JSON.stringify(params));
    
    // Get all tasks for admin dashboard - returns objects with { task, eventDepartment, department, event }
    const taskData: any[] = await storage.getAllTasksForAdminDashboard();
    
    // Flatten to get just the tasks with their context
    let tasks = taskData.map(td => ({
      ...td.task,
      eventTitle: td.event?.title || td.event?.titleEn,
      departmentName: td.department?.name,
      taskType: td.taskType,
    }));

    console.log(`[AI Tool] searchTasks: Total tasks before filtering: ${tasks.length}`);
    
    // Apply date range filter
    if (params.dateRange) {
      const { start, end, field = 'dueDate' } = params.dateRange;
      console.log(`[AI Tool] searchTasks: Filtering by ${field} from ${start || '*'} to ${end || '*'}`);
      
      tasks = tasks.filter((t: any) => {
        const taskDate = t[field] ? new Date(t[field]) : null;
        if (!taskDate) return false;
        if (start && taskDate < new Date(start)) return false;
        if (end && taskDate > new Date(end)) return false;
        return true;
      });
      
      console.log(`[AI Tool] searchTasks: After date filter: ${tasks.length} tasks`);
    }
    
    // Apply status filter
    if (params.status?.length) {
      tasks = tasks.filter((t: any) => params.status!.includes(t.status));
    }
    
    // Apply priority filter
    if (params.priority?.length) {
      tasks = tasks.filter((t: any) => params.priority!.includes(t.priority));
    }

    // Apply text search if provided
    if (params.query) {
      const lowerQuery = params.query.toLowerCase();
      tasks = tasks.filter((t: any) => 
        t.title?.toLowerCase().includes(lowerQuery) ||
        t.description?.toLowerCase().includes(lowerQuery)
      );
    }

    // Sort by due date ascending by default
    tasks.sort((a, b) => {
      const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return aDate - bDate;
    });
    
    // Apply limit
    tasks = tasks.slice(0, params.limit || 10);

    const formattedTasks = tasks.map(formatTaskForContext);
    
    return successResult(
      formattedTasks,
      `Found ${formattedTasks.length} task(s)`
    );
  } catch (error) {
    console.error('[AI Tool] searchTasks error:', error);
    return errorResult(`Failed to search tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Search Contacts Tool
 */
async function searchContacts(params: { query?: string; organization?: string; limit?: number }): Promise<ToolResult> {
  try {
    console.log('[AI Tool] searchContacts called with:', JSON.stringify(params));
    
    // getAllContacts returns paginated result {contacts: [], total, page, limit}
    const result = await storage.getAllContacts({ limit: 100 });
    let contacts: any[] = result.contacts;
    
    // Apply text search
    if (params.query) {
      const lowerQuery = params.query.toLowerCase();
      contacts = contacts.filter((c: any) => 
        c.nameEn?.toLowerCase().includes(lowerQuery) ||
        c.nameAr?.toLowerCase().includes(lowerQuery) ||
        c.email?.toLowerCase().includes(lowerQuery) ||
        c.organization?.nameEn?.toLowerCase().includes(lowerQuery)
      );
    }
    
    // Apply organization filter
    if (params.organization) {
      const lowerOrg = params.organization.toLowerCase();
      contacts = contacts.filter((c: any) => 
        c.organization?.nameEn?.toLowerCase().includes(lowerOrg)
      );
    }
    
    contacts = contacts.slice(0, params.limit || 10);

    const formattedContacts = contacts.map(formatContactForContext);
    
    return successResult(formattedContacts, `Found ${formattedContacts.length} contact(s)`);
  } catch (error) {
    console.error('[AI Tool] searchContacts error:', error);
    return errorResult(`Failed to search contacts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Search Partnerships Tool
 */
async function searchPartnerships(params: { query?: string; status?: string[]; limit?: number }): Promise<ToolResult> {
  try {
    console.log('[AI Tool] searchPartnerships called with:', JSON.stringify(params));
    
    // getAllPartners returns paginated result {partners: [], total, page, limit}
    const result = await storage.getAllPartners({ limit: 100 });
    let partnerships: any[] = result.partners || [];
    
    // Apply status filter
    if (params.status?.length) {
      partnerships = partnerships.filter((p: any) => params.status!.includes(p.partnershipStatus));
    }
    
    // Apply text search
    if (params.query) {
      const lowerQuery = params.query.toLowerCase();
      partnerships = partnerships.filter((p: any) => 
        p.nameEn?.toLowerCase().includes(lowerQuery) ||
        p.nameAr?.toLowerCase().includes(lowerQuery)
      );
    }
    
    partnerships = partnerships.slice(0, params.limit || 10);

    const formattedPartnerships = partnerships.map(formatPartnershipForContext);
    
    return successResult(formattedPartnerships, `Found ${formattedPartnerships.length} partnership(s)`);
  } catch (error) {
    console.error('[AI Tool] searchPartnerships error:', error);
    return errorResult(`Failed to search partnerships: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Search Leads Tool
 * Dedicated tool for searching leads/prospects in the pipeline
 */
async function searchLeads(params: { query?: string; status?: string[]; limit?: number }): Promise<ToolResult> {
  try {
    console.log('[AI Tool] searchLeads called with:', JSON.stringify(params));

    // getAllLeads returns an array directly
    let leads: any[] = await storage.getAllLeads({});

    // Apply status filter
    if (params.status?.length) {
      leads = leads.filter((l: any) => params.status!.includes(l.status));
    }

    // Apply text search
    if (params.query) {
      const lowerQuery = params.query.toLowerCase();
      leads = leads.filter((l: any) =>
        l.name?.toLowerCase().includes(lowerQuery) ||
        l.email?.toLowerCase().includes(lowerQuery) ||
        l.organizationName?.toLowerCase().includes(lowerQuery) ||
        l.notes?.toLowerCase().includes(lowerQuery)
      );
    }

    leads = leads.slice(0, params.limit || 10);

    const formattedLeads = leads.map(formatLeadForContext);

    return successResult(formattedLeads, `Found ${formattedLeads.length} lead(s)`);
  } catch (error) {
    console.error('[AI Tool] searchLeads error:', error);
    return errorResult(`Failed to search leads: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get Event Details Tool
 */
async function getEventDetails(params: { eventId: number | string }): Promise<ToolResult> {
  try {
    console.log('[AI Tool] getEventDetails called for ID:', params.eventId);
    
    const eventId = String(params.eventId);
    const event = await storage.getEvent(eventId);
    
    if (!event) {
      return errorResult(`Event with ID ${params.eventId} not found`);
    }

    return successResult({
      event: formatEventForContext(event),
    }, `Event "${event.name}"`);
  } catch (error) {
    console.error('[AI Tool] getEventDetails error:', error);
    return errorResult(`Failed to get event details: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get Task Details Tool
 */
async function getTaskDetails(params: { taskId: number }): Promise<ToolResult> {
  try {
    console.log('[AI Tool] getTaskDetails called for ID:', params.taskId);
    
    const task = await storage.getTask(params.taskId);
    
    if (!task) {
      return errorResult(`Task with ID ${params.taskId} not found`);
    }

    return successResult(formatTaskForContext(task), `Task "${task.title}"`);
  } catch (error) {
    console.error('[AI Tool] getTaskDetails error:', error);
    return errorResult(`Failed to get task details: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get Count/Statistics Tool
 */
async function getCount(params: { 
  entityType: 'events' | 'tasks' | 'contacts' | 'partnerships' | 'leads';
  status?: string[];
  dateRange?: { start?: string; end?: string };
}): Promise<ToolResult> {
  try {
    console.log('[AI Tool] getCount called with:', JSON.stringify(params));
    
    let items: any[] = [];

    switch (params.entityType) {
      case 'events':
        items = await storage.getAllEvents();
        break;
      case 'tasks':
        items = await storage.getAllTasksForAdminDashboard();
        break;
      case 'contacts':
        const contactsResult = await storage.getAllContacts({ limit: 1000 });
        items = contactsResult.contacts;
        break;
      case 'partnerships':
        const partnersResult = await storage.getAllPartners({ limit: 1000 });
        items = partnersResult.partners || [];
        break;
      case 'leads':
        // getAllLeads returns an array directly
        items = await storage.getAllLeads({});
        break;
    }

    // Apply status filter
    if (params.status?.length) {
      items = items.filter((item: any) => params.status!.includes(item.status));
    }

    // Apply date filter
    if (params.dateRange) {
      const { start, end } = params.dateRange;
      items = items.filter((item: any) => {
        const dateField = params.entityType === 'tasks' ? 'dueDate' : 'startDate';
        const itemDate = item[dateField] ? new Date(item[dateField]) : null;
        if (!itemDate) return false;
        if (start && itemDate < new Date(start)) return false;
        if (end && itemDate > new Date(end)) return false;
        return true;
      });
    }

    const count = items.length;

    return successResult(
      { count, entityType: params.entityType },
      `Found ${count} ${params.entityType}`
    );
  } catch (error) {
    console.error('[AI Tool] getCount error:', error);
    return errorResult(`Failed to get count: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get Dashboard Summary Tool
 */
async function getDashboardSummary(): Promise<ToolResult> {
  try {
    console.log('[AI Tool] getDashboardSummary called');
    
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get various counts
    const allEvents = await storage.getAllEvents();
    const taskData = await storage.getAllTasksForAdminDashboard();
    const partnersResult = await storage.getAllPartners({ limit: 1000 });
    const allPartnerships = partnersResult.partners || [];

    // Flatten task data to access task properties
    const allTasks = taskData.map((td: any) => ({
      ...td.task,
      eventTitle: td.event?.title || td.event?.titleEn,
      departmentName: td.department?.name,
      taskType: td.taskType,
    }));

    // Calculate stats
    const upcomingEvents = allEvents.filter((e: any) => 
      e.startDate && new Date(e.startDate) >= now && new Date(e.startDate) <= weekFromNow
    );
    
    const overdueTasks = allTasks.filter((t: any) => 
      t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed'
    );
    
    const pendingTasks = allTasks.filter((t: any) => t.status === 'pending');
    const activePartnerships = allPartnerships.filter((p: any) => p.status === 'active');

    return successResult({
      overview: {
        totalEvents: allEvents.length,
        upcomingEventsThisWeek: upcomingEvents.length,
        totalTasks: allTasks.length,
        overdueTasks: overdueTasks.length,
        pendingTasks: pendingTasks.length,
        activePartnerships: activePartnerships.length,
      },
      upcomingEvents: upcomingEvents.slice(0, 5).map(formatEventForContext),
      overdueTasks: overdueTasks.slice(0, 5).map(formatTaskForContext),
    }, `Dashboard summary: ${upcomingEvents.length} upcoming events, ${overdueTasks.length} overdue tasks`);
  } catch (error) {
    console.error('[AI Tool] getDashboardSummary error:', error);
    return errorResult(`Failed to get dashboard summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Search Archived Events Tool
 */
async function searchArchivedEvents(params: { query?: string; year?: number; limit?: number }): Promise<ToolResult> {
  try {
    console.log('[AI Tool] searchArchivedEvents called with:', JSON.stringify(params));
    
    // getAllArchivedEvents returns paginated {events: [], total, page, limit}
    const result = await storage.getAllArchivedEvents({ limit: 100 });
    let archived: any[] = result.events || [];
    
    // Filter by year if provided
    if (params.year) {
      archived = archived.filter((e: any) => {
        const eventYear = e.startDate ? new Date(e.startDate).getFullYear() : null;
        return eventYear === params.year;
      });
    }
    
    // Filter by query if provided
    if (params.query) {
      const lowerQuery = params.query.toLowerCase();
      archived = archived.filter((e: any) => 
        e.name?.toLowerCase().includes(lowerQuery) ||
        e.description?.toLowerCase().includes(lowerQuery)
      );
    }
    
    archived = archived.slice(0, params.limit || 10);

    return successResult(
      archived.map(formatEventForContext),
      `Found ${archived.length} archived event(s)`
    );
  } catch (error) {
    console.error('[AI Tool] searchArchivedEvents error:', error);
    return errorResult(`Failed to search archived events: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Executive Query Tools
// ============================================================================

/**
 * Get Partnership Updates Tool
 * Retrieves recent updates, activities, and interactions for a partnership
 */
async function getPartnershipUpdates(params: {
  partnershipId?: number;
  partnershipName?: string;
  limit?: number;
}): Promise<ToolResult> {
  try {
    console.log('[AI Tool] getPartnershipUpdates called with:', JSON.stringify(params));

    let partnershipId = params.partnershipId;

    // If name provided but no ID, search for the partnership first
    if (!partnershipId && params.partnershipName) {
      const searchResult = await storage.getAllPartners({ limit: 100 });
      const partnerships = searchResult.partners || [];
      const match = partnerships.find((p: any) =>
        p.nameEn?.toLowerCase().includes(params.partnershipName!.toLowerCase()) ||
        p.nameAr?.toLowerCase().includes(params.partnershipName!.toLowerCase()) ||
        p.organizationName?.toLowerCase().includes(params.partnershipName!.toLowerCase())
      );
      if (match) {
        partnershipId = match.id;
      } else {
        return successResult([], `No partnership found matching "${params.partnershipName}"`);
      }
    }

    if (!partnershipId) {
      return errorResult('Either partnershipId or partnershipName is required');
    }

    // Get partnership details (partnerships are stored as organizations)
    const partnership = await storage.getOrganization(partnershipId);
    if (!partnership) {
      return errorResult(`Partnership with ID ${partnershipId} not found`);
    }

    // Get partnership activities (updates)
    const activities = await storage.getPartnershipActivities(partnershipId);
    const limitedActivities = activities.slice(0, params.limit || 5);

    // Get partnership interactions
    const interactions = await storage.getPartnershipInteractions(partnershipId);
    const limitedInteractions = interactions.slice(0, params.limit || 5);

    // Combine and sort by date
    const allUpdates = [
      ...limitedActivities.map((a: any) => ({
        type: 'activity',
        date: a.activityDate || a.createdAt,
        title: a.title || a.activityType,
        description: a.description || a.notes,
        activityType: a.activityType,
      })),
      ...limitedInteractions.map((i: any) => ({
        type: 'interaction',
        date: i.interactionDate || i.createdAt,
        title: i.subject || i.interactionType,
        description: i.notes || i.summary,
        interactionType: i.interactionType,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return successResult({
      partnership: {
        id: partnership.id,
        name: partnership.nameEn,
        nameAr: partnership.nameAr,
        status: partnership.partnershipStatus,
        startDate: partnership.partnershipStartDate,
        endDate: partnership.partnershipEndDate,
      },
      recentUpdates: allUpdates.slice(0, params.limit || 5),
    }, `Found ${allUpdates.length} update(s) for partnership "${partnership.nameEn}"`);
  } catch (error) {
    console.error('[AI Tool] getPartnershipUpdates error:', error);
    return errorResult(`Failed to get partnership updates: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get Contact Interactions Tool
 * Retrieves recent interactions with a contact or lead
 */
async function getContactInteractions(params: {
  contactId?: number;
  contactName?: string;
  interactionType?: string;
  limit?: number;
}): Promise<ToolResult> {
  try {
    console.log('[AI Tool] getContactInteractions called with:', JSON.stringify(params));

    let contactId = params.contactId;
    let contactInfo: any = null;

    // If name provided but no ID, search for the contact first
    if (!contactId && params.contactName) {
      const contacts = await storage.getAllContacts();
      const match = contacts.find((c: any) =>
        c.nameEn?.toLowerCase().includes(params.contactName!.toLowerCase()) ||
        c.nameAr?.toLowerCase().includes(params.contactName!.toLowerCase())
      );
      if (match) {
        contactId = match.id;
        contactInfo = match;
      } else {
        // Also search in leads
        const leads = await storage.getAllLeads({});
        const leadMatch = leads.find((l: any) =>
          l.name?.toLowerCase().includes(params.contactName!.toLowerCase())
        );
        if (leadMatch) {
          // Return lead interactions instead
          const leadInteractions = await storage.getLeadInteractions(leadMatch.id);
          return successResult({
            contact: {
              id: leadMatch.id,
              name: leadMatch.name,
              type: 'lead',
              status: leadMatch.status,
            },
            interactions: leadInteractions.slice(0, params.limit || 5).map((i: any) => ({
              date: i.interactionDate || i.createdAt,
              type: i.interactionType,
              summary: i.summary || i.notes,
            })),
          }, `Found ${leadInteractions.length} interaction(s) with lead "${leadMatch.name}"`);
        }
        return successResult([], `No contact or lead found matching "${params.contactName}"`);
      }
    }

    if (!contactId) {
      return errorResult('Either contactId or contactName is required');
    }

    // Get contact details if not already fetched
    if (!contactInfo) {
      contactInfo = await storage.getContact(contactId);
    }

    if (!contactInfo) {
      return errorResult(`Contact with ID ${contactId} not found`);
    }

    // Get contact's recent activities from various sources
    // This would typically come from a dedicated contact_interactions table
    // For now, we'll aggregate from available data

    return successResult({
      contact: {
        id: contactInfo.id,
        name: contactInfo.nameEn || contactInfo.name,
        email: contactInfo.email,
        organization: contactInfo.organizationName,
        type: 'contact',
      },
      interactions: [], // Would be populated from a contact_interactions table
      message: 'Contact interaction tracking requires a dedicated interactions table. Consider integrating with your CRM system.',
    }, `Found contact "${contactInfo.nameEn || contactInfo.name}"`);
  } catch (error) {
    console.error('[AI Tool] getContactInteractions error:', error);
    return errorResult(`Failed to get contact interactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get Speaker History Tool
 * Retrieves events where a contact was a speaker or presenter
 */
async function getSpeakerHistory(params: {
  contactId?: number;
  contactName?: string;
  limit?: number;
}): Promise<ToolResult> {
  try {
    console.log('[AI Tool] getSpeakerHistory called with:', JSON.stringify(params));

    let contactId = params.contactId;
    let contactInfo: any = null;

    // If name provided but no ID, search for the contact first
    if (!contactId && params.contactName) {
      const contacts = await storage.getAllContacts();
      const match = contacts.find((c: any) =>
        c.nameEn?.toLowerCase().includes(params.contactName!.toLowerCase()) ||
        c.nameAr?.toLowerCase().includes(params.contactName!.toLowerCase())
      );
      if (match) {
        contactId = match.id;
        contactInfo = match;
      } else {
        return successResult([], `No contact found matching "${params.contactName}"`);
      }
    }

    if (!contactId) {
      return errorResult('Either contactId or contactName is required');
    }

    // Get contact details if not already fetched
    if (!contactInfo) {
      contactInfo = await storage.getContact(contactId);
    }

    if (!contactInfo) {
      return errorResult(`Contact with ID ${contactId} not found`);
    }

    // Get all events where this contact was a speaker
    // This assumes there's an invitees/attendees table with a role field
    const allEvents = await storage.getAllEvents({ limit: 1000 });

    // Search for events where this contact appears as a speaker
    const speakerEvents: any[] = [];

    for (const event of allEvents) {
      // Check invitees for speaker role
      const invitees = await storage.getInvitees(event.id);
      const isSpeaker = invitees.some((inv: any) =>
        inv.contactId === contactId &&
        (inv.role?.toLowerCase().includes('speaker') ||
         inv.inviteeType?.toLowerCase().includes('speaker'))
      );

      if (isSpeaker) {
        speakerEvents.push({
          id: event.id,
          title: event.title || event.name,
          startDate: event.startDate,
          endDate: event.endDate,
          location: event.location,
          status: event.status,
        });
      }
    }

    // Sort by date descending
    speakerEvents.sort((a, b) =>
      new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime()
    );

    const limitedEvents = speakerEvents.slice(0, params.limit || 10);

    return successResult({
      contact: {
        id: contactInfo.id,
        name: contactInfo.nameEn || contactInfo.name,
        email: contactInfo.email,
        organization: contactInfo.organizationName,
      },
      speakingHistory: limitedEvents,
      totalEvents: speakerEvents.length,
    }, `Found ${speakerEvents.length} event(s) where "${contactInfo.nameEn || contactInfo.name}" was a speaker`);
  } catch (error) {
    console.error('[AI Tool] getSpeakerHistory error:', error);
    return errorResult(`Failed to get speaker history: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get Lead Activities Tool
 * Retrieves recent activities and status changes for a lead
 */
async function getLeadActivities(params: {
  leadId?: number;
  leadName?: string;
  limit?: number;
}): Promise<ToolResult> {
  try {
    console.log('[AI Tool] getLeadActivities called with:', JSON.stringify(params));

    let leadId = params.leadId;
    let leadInfo: any = null;

    // If name provided but no ID, search for the lead first
    if (!leadId && params.leadName) {
      const leads = await storage.getAllLeads({});
      const match = leads.find((l: any) =>
        l.name?.toLowerCase().includes(params.leadName!.toLowerCase()) ||
        l.organizationName?.toLowerCase().includes(params.leadName!.toLowerCase())
      );
      if (match) {
        leadId = match.id;
        leadInfo = match;
      } else {
        return successResult([], `No lead found matching "${params.leadName}"`);
      }
    }

    if (!leadId) {
      return errorResult('Either leadId or leadName is required');
    }

    // Get lead details if not already fetched
    if (!leadInfo) {
      leadInfo = await storage.getLead(leadId);
    }

    if (!leadInfo) {
      return errorResult(`Lead with ID ${leadId} not found`);
    }

    // Get lead interactions
    const interactions = await storage.getLeadInteractions(leadId);
    const limitedInteractions = interactions.slice(0, params.limit || 5);

    return successResult({
      lead: {
        id: leadInfo.id,
        name: leadInfo.name,
        email: leadInfo.email,
        phone: leadInfo.phone,
        organization: leadInfo.organizationName,
        status: leadInfo.status,
        source: leadInfo.source,
        createdAt: leadInfo.createdAt,
      },
      recentActivities: limitedInteractions.map((i: any) => ({
        date: i.interactionDate || i.createdAt,
        type: i.interactionType,
        subject: i.subject,
        summary: i.summary || i.notes,
        outcome: i.outcome,
      })),
    }, `Found ${interactions.length} activity(ies) for lead "${leadInfo.name}"`);
  } catch (error) {
    console.error('[AI Tool] getLeadActivities error:', error);
    return errorResult(`Failed to get lead activities: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get Event Risk Assessment Tool
 * Analyzes upcoming events and identifies potential risks
 */
async function getEventRiskAssessment(params: {
  eventId?: number;
  daysAhead?: number;
}): Promise<ToolResult> {
  try {
    console.log('[AI Tool] getEventRiskAssessment called with:', JSON.stringify(params));

    const daysAhead = params.daysAhead || 30;
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + daysAhead);

    // Get upcoming events
    let events: any[];
    if (params.eventId) {
      const event = await storage.getEvent(params.eventId);
      events = event ? [event] : [];
    } else {
      const allEvents = await storage.getAllEvents();
      events = allEvents.filter((e: any) => {
        const startDate = new Date(e.dateFrom);
        return startDate >= today && startDate <= futureDate && e.status !== 'cancelled';
      });
    }

    const assessments = await Promise.all(events.map(async (event: any) => {
      const risks: string[] = [];
      let riskScore = 0; // 0-100 scale

      // Check task completion
      const tasks = await storage.getTasksByEvent(event.id);
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t: any) => t.status === 'completed').length;
      const overdueTasks = tasks.filter((t: any) => {
        const dueDate = t.dueDate ? new Date(t.dueDate) : null;
        return dueDate && dueDate < today && t.status !== 'completed';
      }).length;

      if (totalTasks > 0) {
        const completionRate = completedTasks / totalTasks;
        if (completionRate < 0.5) {
          risks.push(`Low task completion (${Math.round(completionRate * 100)}%)`);
          riskScore += 30;
        }
        if (overdueTasks > 0) {
          risks.push(`${overdueTasks} overdue task(s)`);
          riskScore += overdueTasks * 10;
        }
      } else {
        risks.push('No tasks defined for event');
        riskScore += 20;
      }

      // Check department assignments
      const departments = await storage.getEventDepartments(event.id);
      if (departments.length === 0) {
        risks.push('No departments assigned');
        riskScore += 25;
      }

      // Check speakers
      const speakers = await storage.getEventSpeakers(event.id);
      if (speakers.length === 0 && event.scope === 'international') {
        risks.push('No speakers confirmed for international event');
        riskScore += 20;
      }

      // Days until event
      const daysUntil = Math.ceil((new Date(event.dateFrom).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 7 && riskScore > 20) {
        risks.push(`Only ${daysUntil} day(s) remaining`);
        riskScore += 15;
      }

      const riskLevel = riskScore > 50 ? 'high' : riskScore > 25 ? 'medium' : 'low';

      return {
        eventId: event.id,
        eventName: event.nameEn || event.name,
        startDate: event.dateFrom,
        daysUntil,
        riskLevel,
        riskScore: Math.min(100, riskScore),
        risks,
        taskStats: { total: totalTasks, completed: completedTasks, overdue: overdueTasks },
        departmentsAssigned: departments.length,
        speakersConfirmed: speakers.length,
      };
    }));

    // Sort by risk score descending
    assessments.sort((a, b) => b.riskScore - a.riskScore);

    const highRiskCount = assessments.filter(a => a.riskLevel === 'high').length;
    const mediumRiskCount = assessments.filter(a => a.riskLevel === 'medium').length;

    return successResult({
      assessments,
      summary: {
        totalEvents: assessments.length,
        highRisk: highRiskCount,
        mediumRisk: mediumRiskCount,
        lowRisk: assessments.length - highRiskCount - mediumRiskCount,
      },
    }, `Assessed ${assessments.length} event(s): ${highRiskCount} high risk, ${mediumRiskCount} medium risk`);
  } catch (error) {
    console.error('[AI Tool] getEventRiskAssessment error:', error);
    return errorResult(`Failed to assess event risks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get Department Workload Tool
 * Analyzes department workload based on tasks and event assignments
 */
async function getDepartmentWorkload(params: {
  departmentId?: number;
}): Promise<ToolResult> {
  try {
    console.log('[AI Tool] getDepartmentWorkload called with:', JSON.stringify(params));

    const today = new Date();
    let departments: any[];

    if (params.departmentId) {
      const dept = await storage.getStakeholder(params.departmentId);
      departments = dept ? [dept] : [];
    } else {
      departments = await storage.getAllStakeholders();
    }

    const workloads = await Promise.all(departments.map(async (dept: any) => {
      // Get pending tasks for this department
      const allTasks = await storage.getAllTasks();
      const deptTasks = allTasks.filter((t: any) => t.assignedDepartmentId === dept.id);

      const pendingTasks = deptTasks.filter((t: any) => t.status === 'pending' || t.status === 'in_progress');
      const overdueTasks = deptTasks.filter((t: any) => {
        const dueDate = t.dueDate ? new Date(t.dueDate) : null;
        return dueDate && dueDate < today && t.status !== 'completed';
      });
      const highPriorityTasks = pendingTasks.filter((t: any) => t.priority === 'high' || t.priority === 'critical');

      // Get upcoming event assignments
      const allEvents = await storage.getAllEvents();
      const upcomingEvents = allEvents.filter((e: any) => {
        const startDate = new Date(e.dateFrom);
        return startDate >= today && startDate <= new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      });

      // Count event assignments (this is approximate - would need event_departments table)
      const eventCount = upcomingEvents.length; // Simplified - actual would query event_departments

      // Calculate workload score (0-100)
      let workloadScore = 0;
      workloadScore += Math.min(50, pendingTasks.length * 5);
      workloadScore += Math.min(30, overdueTasks.length * 10);
      workloadScore += Math.min(20, highPriorityTasks.length * 5);

      const workloadLevel = workloadScore > 70 ? 'overloaded' : workloadScore > 40 ? 'busy' : 'available';

      return {
        departmentId: dept.id,
        departmentName: dept.nameEn || dept.name,
        workloadLevel,
        workloadScore: Math.min(100, workloadScore),
        stats: {
          pendingTasks: pendingTasks.length,
          overdueTasks: overdueTasks.length,
          highPriorityTasks: highPriorityTasks.length,
          upcomingEvents: eventCount,
        },
        topTasks: pendingTasks.slice(0, 3).map((t: any) => ({
          id: t.id,
          title: t.title || t.name,
          dueDate: t.dueDate,
          priority: t.priority,
        })),
      };
    }));

    // Sort by workload score descending
    workloads.sort((a, b) => b.workloadScore - a.workloadScore);

    const overloadedCount = workloads.filter(w => w.workloadLevel === 'overloaded').length;
    const busyCount = workloads.filter(w => w.workloadLevel === 'busy').length;

    return successResult({
      workloads,
      summary: {
        totalDepartments: workloads.length,
        overloaded: overloadedCount,
        busy: busyCount,
        available: workloads.length - overloadedCount - busyCount,
      },
    }, `Analyzed ${workloads.length} department(s): ${overloadedCount} overloaded, ${busyCount} busy`);
  } catch (error) {
    console.error('[AI Tool] getDepartmentWorkload error:', error);
    return errorResult(`Failed to analyze department workload: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get Expiring Agreements Tool
 * Finds partnership agreements that are expiring soon
 */
async function getExpiringAgreements(params: {
  daysAhead?: number;
  includeExpired?: boolean;
}): Promise<ToolResult> {
  try {
    console.log('[AI Tool] getExpiringAgreements called with:', JSON.stringify(params));

    const daysAhead = params.daysAhead || 90;
    const includeExpired = params.includeExpired || false;
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + daysAhead);
    const pastDate = new Date(today);
    pastDate.setDate(today.getDate() - 30); // Look back 30 days for expired

    // Get all partnerships
    const { partners } = await storage.getAllPartners({ limit: 500 });

    const expiringAgreements: any[] = [];

    for (const partner of partners) {
      const endDate = partner.partnershipEndDate ? new Date(partner.partnershipEndDate) : null;

      if (!endDate) continue; // Skip indefinite partnerships

      const isExpired = endDate < today;
      const isExpiringSoon = endDate >= today && endDate <= futureDate;

      if (isExpiringSoon || (includeExpired && isExpired && endDate >= pastDate)) {
        const daysUntil = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        expiringAgreements.push({
          partnershipId: partner.id,
          organizationName: partner.nameEn,
          organizationNameAr: partner.nameAr,
          status: partner.partnershipStatus,
          endDate: partner.partnershipEndDate,
          daysUntil,
          isExpired,
          urgency: isExpired ? 'expired' : daysUntil <= 30 ? 'urgent' : daysUntil <= 60 ? 'soon' : 'upcoming',
        });
      }
    }

    // Sort by days until expiry
    expiringAgreements.sort((a, b) => a.daysUntil - b.daysUntil);

    const expiredCount = expiringAgreements.filter(a => a.isExpired).length;
    const urgentCount = expiringAgreements.filter(a => a.urgency === 'urgent').length;

    return successResult({
      agreements: expiringAgreements,
      summary: {
        total: expiringAgreements.length,
        expired: expiredCount,
        urgent: urgentCount,
        soon: expiringAgreements.filter(a => a.urgency === 'soon').length,
        upcoming: expiringAgreements.filter(a => a.urgency === 'upcoming').length,
      },
    }, `Found ${expiringAgreements.length} agreement(s) expiring within ${daysAhead} days (${urgentCount} urgent, ${expiredCount} expired)`);
  } catch (error) {
    console.error('[AI Tool] getExpiringAgreements error:', error);
    return errorResult(`Failed to find expiring agreements: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get Stale Leads Tool
 * Finds leads that haven't been contacted recently
 */
async function getStaleLeads(params: {
  staleDays?: number;
  status?: string[];
}): Promise<ToolResult> {
  try {
    console.log('[AI Tool] getStaleLeads called with:', JSON.stringify(params));

    const staleDays = params.staleDays || 30;
    const statusFilter = params.status || ['new', 'contacted', 'qualified', 'proposal', 'negotiation'];
    const today = new Date();
    const staleDate = new Date(today);
    staleDate.setDate(today.getDate() - staleDays);

    // Get all leads
    const leads = await storage.getAllLeads({});

    const staleLeads: any[] = [];

    for (const lead of leads) {
      // Filter by status
      if (statusFilter.length > 0 && !statusFilter.includes(lead.status)) {
        continue;
      }

      // Skip won/lost leads
      if (lead.status === 'won' || lead.status === 'lost') {
        continue;
      }

      // Get last interaction
      const interactions = await storage.getLeadInteractions(lead.id);
      const lastInteraction = interactions.sort((a: any, b: any) =>
        new Date(b.interactionDate || b.createdAt).getTime() - new Date(a.interactionDate || a.createdAt).getTime()
      )[0];

      const lastContactDate = lastInteraction
        ? new Date(lastInteraction.interactionDate || lastInteraction.createdAt)
        : new Date(lead.createdAt);

      if (lastContactDate < staleDate) {
        const daysSinceContact = Math.ceil((today.getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24));

        staleLeads.push({
          leadId: lead.id,
          name: lead.name,
          organization: lead.organizationName,
          email: lead.email,
          status: lead.status,
          lastContactDate: lastContactDate.toISOString().slice(0, 10),
          daysSinceContact,
          urgency: daysSinceContact > 60 ? 'critical' : daysSinceContact > 45 ? 'high' : 'medium',
          lastInteraction: lastInteraction ? {
            type: lastInteraction.interactionType,
            subject: lastInteraction.subject,
          } : null,
        });
      }
    }

    // Sort by days since contact descending
    staleLeads.sort((a, b) => b.daysSinceContact - a.daysSinceContact);

    const criticalCount = staleLeads.filter(l => l.urgency === 'critical').length;
    const highCount = staleLeads.filter(l => l.urgency === 'high').length;

    return successResult({
      leads: staleLeads,
      summary: {
        total: staleLeads.length,
        critical: criticalCount,
        high: highCount,
        medium: staleLeads.length - criticalCount - highCount,
      },
    }, `Found ${staleLeads.length} stale lead(s) not contacted in ${staleDays}+ days (${criticalCount} critical)`);
  } catch (error) {
    console.error('[AI Tool] getStaleLeads error:', error);
    return errorResult(`Failed to find stale leads: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get Event Timeline Tool
 * Provides a comprehensive timeline view of an event
 */
async function getEventTimeline(params: {
  eventId?: number;
  eventName?: string;
}): Promise<ToolResult> {
  try {
    console.log('[AI Tool] getEventTimeline called with:', JSON.stringify(params));

    let eventId = params.eventId;

    // If name provided, search for event
    if (!eventId && params.eventName) {
      const events = await storage.getAllEvents();
      const match = events.find((e: any) =>
        e.nameEn?.toLowerCase().includes(params.eventName!.toLowerCase()) ||
        e.nameAr?.toLowerCase().includes(params.eventName!.toLowerCase())
      );
      if (match) {
        eventId = match.id;
      } else {
        return successResult([], `No event found matching "${params.eventName}"`);
      }
    }

    if (!eventId) {
      return errorResult('Either eventId or eventName is required');
    }

    const event = await storage.getEvent(eventId);
    if (!event) {
      return errorResult(`Event with ID ${eventId} not found`);
    }

    // Get all related data
    const [tasks, departments, speakers] = await Promise.all([
      storage.getTasksByEvent(eventId),
      storage.getEventDepartments(eventId),
      storage.getEventSpeakers(eventId),
    ]);

    // Build timeline entries
    const timeline: any[] = [];

    // Add task milestones
    tasks.forEach((task: any) => {
      timeline.push({
        type: 'task',
        date: task.dueDate || task.createdAt,
        title: task.title || task.name,
        status: task.status,
        priority: task.priority,
        completed: task.status === 'completed',
      });
    });

    // Add speaker confirmations
    speakers.forEach((speaker: any) => {
      timeline.push({
        type: 'speaker',
        date: speaker.createdAt,
        title: `Speaker: ${speaker.contactName || 'TBD'}`,
        role: speaker.role,
        status: 'confirmed',
      });
    });

    // Sort by date
    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate progress
    const completedTasks = tasks.filter((t: any) => t.status === 'completed').length;
    const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

    return successResult({
      event: {
        id: event.id,
        name: event.nameEn || event.name,
        nameAr: event.nameAr,
        startDate: event.dateFrom,
        endDate: event.dateTo,
        location: event.location,
        status: event.status,
        scope: event.scope,
      },
      stats: {
        totalTasks: tasks.length,
        completedTasks,
        progress,
        departments: departments.length,
        speakers: speakers.length,
      },
      timeline,
    }, `Event "${event.nameEn}" timeline: ${progress}% complete, ${speakers.length} speaker(s), ${departments.length} department(s)`);
  } catch (error) {
    console.error('[AI Tool] getEventTimeline error:', error);
    return errorResult(`Failed to get event timeline: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get Weekly Summary Tool
 * Provides a comprehensive summary for a week
 */
async function getWeeklySummary(params: {
  weekOffset?: number;
}): Promise<ToolResult> {
  try {
    console.log('[AI Tool] getWeeklySummary called with:', JSON.stringify(params));

    const weekOffset = params.weekOffset || 0;

    // Calculate week boundaries
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + (weekOffset * 7)); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Get events in this week
    const allEvents = await storage.getAllEvents();
    const weekEvents = allEvents.filter((e: any) => {
      const startDate = new Date(e.dateFrom);
      return startDate >= startOfWeek && startDate <= endOfWeek;
    });

    // Get tasks due this week
    const allTasks = await storage.getAllTasks();
    const weekTasks = allTasks.filter((t: any) => {
      const dueDate = t.dueDate ? new Date(t.dueDate) : null;
      return dueDate && dueDate >= startOfWeek && dueDate <= endOfWeek;
    });

    const completedTasks = weekTasks.filter((t: any) => t.status === 'completed');
    const overdueTasks = weekTasks.filter((t: any) =>
      t.status !== 'completed' && new Date(t.dueDate) < today
    );

    // Get partnership activities this week
    const { partners } = await storage.getAllPartners({ limit: 100 });
    let partnershipActivities = 0;
    for (const partner of partners.slice(0, 10)) {
      try {
        const activities = await storage.getPartnershipActivities(partner.id);
        partnershipActivities += activities.filter((a: any) => {
          const actDate = new Date(a.activityDate || a.createdAt);
          return actDate >= startOfWeek && actDate <= endOfWeek;
        }).length;
      } catch {
        // Ignore errors for individual partners
      }
    }

    const weekLabel = weekOffset === 0 ? 'This week' : weekOffset === -1 ? 'Last week' : weekOffset === 1 ? 'Next week' : `Week ${weekOffset > 0 ? '+' : ''}${weekOffset}`;

    return successResult({
      period: {
        label: weekLabel,
        start: startOfWeek.toISOString().slice(0, 10),
        end: endOfWeek.toISOString().slice(0, 10),
      },
      events: {
        total: weekEvents.length,
        items: weekEvents.slice(0, 5).map((e: any) => ({
          id: e.id,
          name: e.nameEn || e.name,
          date: e.dateFrom,
          status: e.status,
        })),
      },
      tasks: {
        total: weekTasks.length,
        completed: completedTasks.length,
        overdue: overdueTasks.length,
        pending: weekTasks.length - completedTasks.length,
        completionRate: weekTasks.length > 0 ? Math.round((completedTasks.length / weekTasks.length) * 100) : 0,
      },
      partnerships: {
        activitiesCount: partnershipActivities,
      },
    }, `${weekLabel}: ${weekEvents.length} event(s), ${weekTasks.length} task(s) due (${completedTasks.length} completed), ${partnershipActivities} partnership activities`);
  } catch (error) {
    console.error('[AI Tool] getWeeklySummary error:', error);
    return errorResult(`Failed to generate weekly summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get Partnership Analytics Tool
 * Analyzes partnership engagement to find most/least active partners
 */
async function getPartnershipAnalytics(params: {
  topN?: number;
  metric?: 'activity' | 'interactions' | 'events';
}): Promise<ToolResult> {
  try {
    console.log('[AI Tool] getPartnershipAnalytics called with:', JSON.stringify(params));

    const topN = params.topN || 10;
    const metric = params.metric || 'activity';

    // Get all partnerships
    const { partners } = await storage.getAllPartners({ limit: 200 });
    const activePartners = partners.filter((p: any) => p.partnershipStatus === 'active' || p.isPartner);

    const partnerAnalytics = await Promise.all(activePartners.map(async (partner: any) => {
      let activityCount = 0;
      let interactionCount = 0;
      let eventCount = 0;
      let lastActivityDate: Date | null = null;

      try {
        // Get activities
        const activities = await storage.getPartnershipActivities(partner.id);
        activityCount = activities.length;
        if (activities.length > 0) {
          const dates = activities.map((a: any) => new Date(a.activityDate || a.createdAt));
          lastActivityDate = new Date(Math.max(...dates.map(d => d.getTime())));
        }

        // Get interactions
        const interactions = await storage.getPartnershipInteractions(partner.id);
        interactionCount = interactions.length;
        if (interactions.length > 0 && !lastActivityDate) {
          const dates = interactions.map((i: any) => new Date(i.interactionDate || i.createdAt));
          const maxInteractionDate = new Date(Math.max(...dates.map(d => d.getTime())));
          if (!lastActivityDate || maxInteractionDate > lastActivityDate) {
            lastActivityDate = maxInteractionDate;
          }
        }

        // Get events (if activities have eventId)
        eventCount = activities.filter((a: any) => a.eventId).length;
      } catch {
        // Ignore errors for individual partners
      }

      // Calculate engagement score
      let engagementScore = 0;
      if (metric === 'activity') {
        engagementScore = activityCount * 3 + interactionCount * 2 + eventCount * 5;
      } else if (metric === 'interactions') {
        engagementScore = interactionCount * 5 + activityCount;
      } else {
        engagementScore = eventCount * 10 + activityCount;
      }

      return {
        partnerId: partner.id,
        name: partner.nameEn,
        nameAr: partner.nameAr,
        status: partner.partnershipStatus,
        metrics: {
          activities: activityCount,
          interactions: interactionCount,
          events: eventCount,
        },
        engagementScore,
        lastActivityDate: lastActivityDate?.toISOString().slice(0, 10) || null,
        engagementLevel: engagementScore > 50 ? 'very active' : engagementScore > 20 ? 'active' : engagementScore > 5 ? 'moderate' : 'low',
      };
    }));

    // Sort by engagement score descending
    partnerAnalytics.sort((a, b) => b.engagementScore - a.engagementScore);

    const topPartners = partnerAnalytics.slice(0, topN);
    const mostActive = topPartners[0];

    return successResult({
      topPartners,
      summary: {
        totalAnalyzed: partnerAnalytics.length,
        veryActive: partnerAnalytics.filter(p => p.engagementLevel === 'very active').length,
        active: partnerAnalytics.filter(p => p.engagementLevel === 'active').length,
        moderate: partnerAnalytics.filter(p => p.engagementLevel === 'moderate').length,
        low: partnerAnalytics.filter(p => p.engagementLevel === 'low').length,
      },
      mostActivePartner: mostActive ? {
        name: mostActive.name,
        score: mostActive.engagementScore,
        activities: mostActive.metrics.activities,
      } : null,
    }, mostActive
      ? `Most active partner: "${mostActive.name}" with ${mostActive.metrics.activities} activities and ${mostActive.metrics.interactions} interactions`
      : 'No active partnerships found');
  } catch (error) {
    console.error('[AI Tool] getPartnershipAnalytics error:', error);
    return errorResult(`Failed to analyze partnerships: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get Stale Partnerships Tool
 * Finds partnerships with no recent activity
 */
async function getStalePartnerships(params: {
  staleDays?: number;
  status?: string[];
}): Promise<ToolResult> {
  try {
    console.log('[AI Tool] getStalePartnerships called with:', JSON.stringify(params));

    const staleDays = params.staleDays || 60;
    const statusFilter = params.status || ['active'];
    const today = new Date();
    const staleDate = new Date(today);
    staleDate.setDate(today.getDate() - staleDays);

    // Get partnerships
    const { partners } = await storage.getAllPartners({ limit: 200 });

    const stalePartnerships: any[] = [];

    for (const partner of partners) {
      // Filter by status
      if (statusFilter.length > 0 && !statusFilter.includes(partner.partnershipStatus)) {
        continue;
      }

      let lastActivityDate: Date | null = null;
      let lastActivityType: string | null = null;

      try {
        // Check activities
        const activities = await storage.getPartnershipActivities(partner.id);
        if (activities.length > 0) {
          const sorted = activities.sort((a: any, b: any) =>
            new Date(b.activityDate || b.createdAt).getTime() - new Date(a.activityDate || a.createdAt).getTime()
          );
          lastActivityDate = new Date(sorted[0].activityDate || sorted[0].createdAt);
          lastActivityType = sorted[0].activityType || 'activity';
        }

        // Check interactions
        const interactions = await storage.getPartnershipInteractions(partner.id);
        if (interactions.length > 0) {
          const sorted = interactions.sort((a: any, b: any) =>
            new Date(b.interactionDate || b.createdAt).getTime() - new Date(a.interactionDate || a.createdAt).getTime()
          );
          const interactionDate = new Date(sorted[0].interactionDate || sorted[0].createdAt);
          if (!lastActivityDate || interactionDate > lastActivityDate) {
            lastActivityDate = interactionDate;
            lastActivityType = sorted[0].interactionType || 'interaction';
          }
        }
      } catch {
        // Ignore errors for individual partners
      }

      // Use partnership start date if no activities
      if (!lastActivityDate) {
        lastActivityDate = partner.partnershipStartDate
          ? new Date(partner.partnershipStartDate)
          : new Date(partner.createdAt);
        lastActivityType = 'partnership start';
      }

      if (lastActivityDate < staleDate) {
        const daysSinceActivity = Math.ceil((today.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24));

        stalePartnerships.push({
          partnerId: partner.id,
          name: partner.nameEn,
          nameAr: partner.nameAr,
          status: partner.partnershipStatus,
          lastActivityDate: lastActivityDate.toISOString().slice(0, 10),
          lastActivityType,
          daysSinceActivity,
          urgency: daysSinceActivity > 120 ? 'critical' : daysSinceActivity > 90 ? 'high' : 'medium',
        });
      }
    }

    // Sort by days since activity descending
    stalePartnerships.sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);

    const criticalCount = stalePartnerships.filter(p => p.urgency === 'critical').length;
    const highCount = stalePartnerships.filter(p => p.urgency === 'high').length;

    return successResult({
      partnerships: stalePartnerships,
      summary: {
        total: stalePartnerships.length,
        critical: criticalCount,
        high: highCount,
        medium: stalePartnerships.length - criticalCount - highCount,
      },
    }, `Found ${stalePartnerships.length} stale partnership(s) with no activity in ${staleDays}+ days (${criticalCount} critical, ${highCount} high)`);
  } catch (error) {
    console.error('[AI Tool] getStalePartnerships error:', error);
    return errorResult(`Failed to find stale partnerships: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get Contact Analysis Tool
 * Analyzes contacts to find top speakers, VIPs, or frequently engaged contacts
 */
async function getContactAnalysis(params: {
  type?: 'speakers' | 'vip' | 'frequent';
  limit?: number;
}): Promise<ToolResult> {
  try {
    console.log('[AI Tool] getContactAnalysis called with:', JSON.stringify(params));

    const analysisType = params.type || 'speakers';
    const limit = params.limit || 10;

    // Get contacts
    const { contacts } = await storage.getAllContacts({ limit: 500 });

    const contactAnalysis: any[] = [];

    for (const contact of contacts) {
      let speakingCount = 0;
      let eventAppearances = 0;
      let score = 0;

      try {
        // Check if they've been a speaker
        if (contact.eligibleSpeaker) {
          // Try to get their speaking history from events
          const allEvents = await storage.getAllEvents();
          for (const event of allEvents.slice(0, 50)) {
            try {
              const speakers = await storage.getEventSpeakers(event.id);
              if (speakers.some((s: any) => s.contactId === contact.id)) {
                speakingCount++;
              }
            } catch {
              // Ignore
            }
          }
        }

        // Calculate score based on analysis type
        if (analysisType === 'speakers') {
          score = speakingCount * 10 + (contact.eligibleSpeaker ? 5 : 0);
        } else if (analysisType === 'vip') {
          score = speakingCount * 5 + (contact.vip ? 20 : 0);
        } else {
          score = speakingCount * 10;
        }

        if (score > 0 || (analysisType === 'speakers' && contact.eligibleSpeaker)) {
          contactAnalysis.push({
            contactId: contact.id,
            name: contact.nameEn || contact.name,
            email: contact.email,
            organization: contact.organizationName,
            position: contact.position,
            isVIP: contact.vip || false,
            isSpeaker: contact.eligibleSpeaker || false,
            speakingCount,
            score,
          });
        }
      } catch {
        // Ignore errors for individual contacts
      }
    }

    // Sort by score descending
    contactAnalysis.sort((a, b) => b.score - a.score);
    const topContacts = contactAnalysis.slice(0, limit);

    const typeLabel = analysisType === 'speakers' ? 'speakers' : analysisType === 'vip' ? 'VIP contacts' : 'engaged contacts';

    return successResult({
      contacts: topContacts,
      summary: {
        total: contactAnalysis.length,
        topPerformer: topContacts[0]?.name || null,
      },
    }, `Found ${contactAnalysis.length} ${typeLabel}. Top: ${topContacts[0]?.name || 'None'} with ${topContacts[0]?.speakingCount || 0} speaking engagements`);
  } catch (error) {
    console.error('[AI Tool] getContactAnalysis error:', error);
    return errorResult(`Failed to analyze contacts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Tool Registry
// ============================================================================

/**
 * All available tools mapped by name
 *
 * Each execute function is cast to the generic signature expected by AiTool.
 * The actual typed implementations ensure correct param handling internally.
 */
export const TOOLS: Record<string, AiTool> = {
  search_events: {
    name: 'search_events',
    description: 'Search for events with filters for date range, status, and category',
    schema: ToolSchemas.search_events,
    execute: searchEvents as AiTool['execute'],
  },
  search_tasks: {
    name: 'search_tasks',
    description: 'Search for tasks with filters for status, priority, and due dates',
    schema: ToolSchemas.search_tasks,
    execute: searchTasks as AiTool['execute'],
  },
  search_contacts: {
    name: 'search_contacts',
    description: 'Search for contacts by name or organization',
    schema: ToolSchemas.search_contacts,
    execute: searchContacts as AiTool['execute'],
  },
  search_partnerships: {
    name: 'search_partnerships',
    description: 'Search for partnerships by status or query',
    schema: ToolSchemas.search_partnerships,
    execute: searchPartnerships as AiTool['execute'],
  },
  search_leads: {
    name: 'search_leads',
    description: 'Search for leads/prospects in the sales pipeline by name, organization, or status',
    schema: ToolSchemas.search_leads,
    execute: searchLeads as AiTool['execute'],
  },
  get_event_details: {
    name: 'get_event_details',
    description: 'Get detailed information about a specific event including its tasks',
    schema: ToolSchemas.get_event_details,
    execute: getEventDetails as AiTool['execute'],
  },
  get_task_details: {
    name: 'get_task_details',
    description: 'Get detailed information about a specific task',
    schema: ToolSchemas.get_task_details,
    execute: getTaskDetails as AiTool['execute'],
  },
  get_count: {
    name: 'get_count',
    description: 'Get count of entities matching criteria',
    schema: ToolSchemas.get_count,
    execute: getCount as AiTool['execute'],
  },
  get_dashboard_summary: {
    name: 'get_dashboard_summary',
    description: 'Get an overview of upcoming events, overdue tasks, and key metrics',
    schema: ToolSchemas.get_dashboard_summary,
    execute: getDashboardSummary as AiTool['execute'],
  },
  search_archived_events: {
    name: 'search_archived_events',
    description: 'Search through archived/past events',
    schema: ToolSchemas.search_archived_events,
    execute: searchArchivedEvents as AiTool['execute'],
  },

  // Executive Query Tools for multi-step reasoning
  get_partnership_updates: {
    name: 'get_partnership_updates',
    description: 'Get recent updates, activities, and interactions for a partnership. Use for questions like "what was the last update regarding partnership X?"',
    schema: ToolSchemas.get_partnership_updates,
    execute: getPartnershipUpdates as AiTool['execute'],
  },
  get_contact_interactions: {
    name: 'get_contact_interactions',
    description: 'Get recent interactions and communications with a contact or lead. Use for questions like "what was our last interaction with Y?"',
    schema: ToolSchemas.get_contact_interactions,
    execute: getContactInteractions as AiTool['execute'],
  },
  get_speaker_history: {
    name: 'get_speaker_history',
    description: 'Get the events where a contact was a speaker or presenter. Use for questions like "when was the last event that Z spoke at?"',
    schema: ToolSchemas.get_speaker_history,
    execute: getSpeakerHistory as AiTool['execute'],
  },
  get_lead_activities: {
    name: 'get_lead_activities',
    description: 'Get recent activities, interactions, and status changes for a lead. Use to track sales pipeline progress.',
    schema: ToolSchemas.get_lead_activities,
    execute: getLeadActivities as AiTool['execute'],
  },

  // Analytics & Insight Tools
  get_event_risk_assessment: {
    name: 'get_event_risk_assessment',
    description: 'Assess risk level for upcoming events based on task completion, speaker confirmation, and department engagement. Use for "which events are at risk?" or "what could go wrong?"',
    schema: ToolSchemas.get_event_risk_assessment,
    execute: getEventRiskAssessment as AiTool['execute'],
  },
  get_department_workload: {
    name: 'get_department_workload',
    description: 'Analyze department workload based on pending tasks and event assignments. Use for "which departments are overloaded?" or "who has capacity?"',
    schema: ToolSchemas.get_department_workload,
    execute: getDepartmentWorkload as AiTool['execute'],
  },
  get_expiring_agreements: {
    name: 'get_expiring_agreements',
    description: 'Find partnership agreements expiring soon. Use for "which partnerships need renewal?" or "expiring agreements this quarter"',
    schema: ToolSchemas.get_expiring_agreements,
    execute: getExpiringAgreements as AiTool['execute'],
  },
  get_stale_leads: {
    name: 'get_stale_leads',
    description: 'Find leads not contacted recently. Use for "which leads are going cold?" or "leads needing follow-up"',
    schema: ToolSchemas.get_stale_leads,
    execute: getStaleLeads as AiTool['execute'],
  },
  get_event_timeline: {
    name: 'get_event_timeline',
    description: 'Get comprehensive timeline of an event including tasks, speakers, and departments. Use for "status of event X" or "overview of the summit"',
    schema: ToolSchemas.get_event_timeline,
    execute: getEventTimeline as AiTool['execute'],
  },
  get_weekly_summary: {
    name: 'get_weekly_summary',
    description: 'Get comprehensive weekly summary. Use for "summarize this week" or "what happened last week?"',
    schema: ToolSchemas.get_weekly_summary,
    execute: getWeeklySummary as AiTool['execute'],
  },
  get_partnership_analytics: {
    name: 'get_partnership_analytics',
    description: 'Analyze partnership engagement to find most active partners. Use for "who is our most active partner?" or "which partnerships are performing well?"',
    schema: ToolSchemas.get_partnership_analytics,
    execute: getPartnershipAnalytics as AiTool['execute'],
  },
  get_stale_partnerships: {
    name: 'get_stale_partnerships',
    description: 'Find partnerships with no recent activity. Use for "which partnerships are stale?" or "partnerships needing attention"',
    schema: ToolSchemas.get_stale_partnerships,
    execute: getStalePartnerships as AiTool['execute'],
  },
  get_contact_analysis: {
    name: 'get_contact_analysis',
    description: 'Analyze contacts to find top speakers, VIPs, or frequently engaged contacts. Use for "who are our top speakers?" or "most engaged contacts"',
    schema: ToolSchemas.get_contact_analysis,
    execute: getContactAnalysis as AiTool['execute'],
  },
};

/**
 * Get tools formatted for OpenAI API
 */
export function getToolsForOpenAI(): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> {
  return Object.values(TOOLS).map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.schema,
    },
  }));
}

/**
 * Execute a tool by name with given parameters
 */
export async function executeTool(
  toolName: string, 
  params: Record<string, unknown>
): Promise<ToolResult> {
  const tool = TOOLS[toolName];
  
  if (!tool) {
    return errorResult(`Unknown tool: ${toolName}`);
  }

  try {
    return await tool.execute(params as any);
  } catch (error) {
    console.error(`[AI Tools] Error executing ${toolName}:`, error);
    return errorResult(`Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
