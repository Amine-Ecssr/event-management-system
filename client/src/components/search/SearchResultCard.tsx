/**
 * SearchResultCard Component
 * 
 * Displays a single search result with entity-specific styling,
 * highlighting, and navigation.
 * 
 * @module components/search/SearchResultCard
 */

import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { 
  Calendar, 
  CheckSquare, 
  User, 
  Building2, 
  Target, 
  FileText,
  Users,
  Layers,
  FileEdit,
  Archive,
  MessageSquare,
  CalendarDays,
  Phone
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SearchHit, EntityType } from '@/types/search';

interface SearchResultCardProps {
  hit: SearchHit;
  query: string;
}

interface EntityConfig {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  route: string;
  labelKey: string;
}

const ENTITY_CONFIG: Record<EntityType, EntityConfig> = {
  'events': { 
    icon: Calendar, 
    color: 'bg-blue-500', 
    route: '/admin/events',
    labelKey: 'search.entities.events'
  },
  'archived-events': { 
    icon: Archive, 
    color: 'bg-slate-500', 
    route: '/archive',
    labelKey: 'search.entities.archivedEvents'
  },
  'tasks': { 
    icon: CheckSquare, 
    color: 'bg-green-500', 
    route: '/admin/tasks',
    labelKey: 'search.entities.tasks'
  },
  'contacts': { 
    icon: User, 
    color: 'bg-purple-500', 
    route: '/admin/contacts',
    labelKey: 'search.entities.contacts'
  },
  'organizations': { 
    icon: Building2, 
    color: 'bg-orange-500', 
    route: '/admin/partnerships',
    labelKey: 'search.entities.organizations'
  },
  'leads': { 
    icon: Target, 
    color: 'bg-pink-500', 
    route: '/admin/leads',
    labelKey: 'search.entities.leads'
  },
  'agreements': { 
    icon: FileText, 
    color: 'bg-cyan-500', 
    route: '/admin/partnerships',
    labelKey: 'search.entities.agreements'
  },
  'attendees': { 
    icon: Users, 
    color: 'bg-indigo-500', 
    route: '/admin/events',
    labelKey: 'search.entities.attendees'
  },
  'invitees': { 
    icon: Users, 
    color: 'bg-teal-500', 
    route: '/admin/events',
    labelKey: 'search.entities.invitees'
  },
  'departments': { 
    icon: Layers, 
    color: 'bg-amber-500', 
    route: '/admin/stakeholders',
    labelKey: 'search.entities.departments'
  },
  'partnerships': { 
    icon: Building2, 
    color: 'bg-emerald-500', 
    route: '/admin/partnerships',
    labelKey: 'search.entities.partnerships'
  },
  'updates': { 
    icon: FileEdit, 
    color: 'bg-violet-500', 
    route: '/admin/updates',
    labelKey: 'search.entities.updates'
  },
  'lead-interactions': {
    icon: MessageSquare,
    color: 'bg-rose-500',
    route: '/admin/leads',
    labelKey: 'search.entities.leadInteractions'
  },
  'partnership-activities': {
    icon: CalendarDays,
    color: 'bg-lime-500',
    route: '/admin/partnerships',
    labelKey: 'search.entities.partnershipActivities'
  },
  'partnership-interactions': {
    icon: Phone,
    color: 'bg-sky-500',
    route: '/admin/partnerships',
    labelKey: 'search.entities.partnershipInteractions'
  },
};

/**
 * Get display fields based on entity type
 */
function getDisplayFields(hit: SearchHit) {
  const source = hit.source as Record<string, unknown>;
  const highlight = hit.highlight || {};

  // Get title based on entity type (prioritize highlighted version)
  let title: string;
  
  // For interactions, use description as the title since they don't have a title field
  if (hit.entityType === 'lead-interactions' || hit.entityType === 'partnership-interactions') {
    title = 
      highlight.description?.[0] || 
      (source.description as string)?.substring(0, 100) ||
      `${(source.type as string)?.replace('_', ' ')} interaction` ||
      'Interaction';
  } else {
    // Check various field names used across different entities:
    // - nameEn/nameAr: used in DB schema for contacts, organizations
    // - name: used in ES documents for contacts, organizations, leads
    // - titleEn/titleAr: used in events, partnership activities
    // - title: used in ES documents for events, activities
    title = 
      highlight.name?.[0] ||
      highlight.nameEn?.[0] || 
      highlight.titleEn?.[0] ||
      highlight.title?.[0] ||
      (source.name as string) ||
      (source.nameEn as string) || 
      (source.titleEn as string) ||
      (source.title as string) ||
      'Untitled';
  }

  // Get Arabic title/description
  const titleAr = hit.entityType === 'lead-interactions' || hit.entityType === 'partnership-interactions'
    ? (source.descriptionAr as string)
    : (source.nameAr as string) || (source.titleAr as string);

  // Get subtitle based on entity type
  const subtitle = getSubtitle(hit.entityType, source);

  // Get description (prioritize highlighted version) - skip for interactions since we use it as title
  let description: string | undefined;
  if (hit.entityType === 'lead-interactions' || hit.entityType === 'partnership-interactions') {
    description = (source.outcome as string)?.substring(0, 200);
  } else {
    description = 
      highlight.description?.[0] || 
      highlight.notes?.[0] ||
      (source.description as string)?.substring(0, 200) ||
      (source.notes as string)?.substring(0, 200);
  }

  // Get badges
  const badges = getBadges(hit.entityType, source);

  return { title, titleAr, subtitle, description, badges };
}

/**
 * Get subtitle based on entity type
 * Shows organization name for contacts, email/phone as secondary info
 */
function getSubtitle(type: EntityType, source: Record<string, unknown>): string {
  switch (type) {
    case 'events':
    case 'archived-events':
      if (source.startDate) {
        return new Date(source.startDate as string).toLocaleDateString();
      }
      return '';
    case 'tasks':
      return (source.status as string) || '';
    case 'contacts': {
      // Show organization name first (most useful for identifying contacts)
      const orgName = source.organizationName as string;
      const email = source.email as string;
      const phone = source.phone as string;
      const title = source.title as string;
      
      const parts: string[] = [];
      if (orgName) parts.push(orgName);
      if (title) parts.push(title);
      if (email) parts.push(email);
      else if (phone) parts.push(phone);
      
      return parts.slice(0, 2).join(' • ');
    }
    case 'organizations':
    case 'partnerships':
      return (source.website as string) || '';
    case 'leads':
      return (source.organizationName as string) || (source.email as string) || '';
    case 'departments':
      return '';
    case 'updates':
      if (source.periodStart) {
        return new Date(source.periodStart as string).toLocaleDateString();
      }
      return '';
    case 'lead-interactions':
      // Show interaction date and type
      if (source.interactionDate) {
        const date = new Date(source.interactionDate as string).toLocaleDateString();
        const interactionType = (source.type as string)?.replace('_', ' ');
        return interactionType ? `${interactionType} • ${date}` : date;
      }
      return (source.type as string)?.replace('_', ' ') || '';
    case 'partnership-activities':
      // Show activity type and date
      if (source.startDate) {
        const date = new Date(source.startDate as string).toLocaleDateString();
        const activityType = (source.activityType as string)?.replace('_', ' ');
        return activityType ? `${activityType} • ${date}` : date;
      }
      return (source.activityType as string)?.replace('_', ' ') || '';
    case 'partnership-interactions':
      // Show interaction date and type
      if (source.interactionDate) {
        const date = new Date(source.interactionDate as string).toLocaleDateString();
        const interactionType = (source.type as string)?.replace('_', ' ');
        return interactionType ? `${interactionType} • ${date}` : date;
      }
      return (source.type as string)?.replace('_', ' ') || '';
    default:
      return '';
  }
}

/**
 * Get badges based on entity type
 */
function getBadges(type: EntityType, source: Record<string, unknown>): string[] {
  const badges: string[] = [];

  if (source.category) badges.push(source.category as string);
  if (source.eventType) badges.push(source.eventType as string);
  if (source.eventScope) badges.push(source.eventScope as string);
  if (source.status && type === 'tasks') badges.push(source.status as string);
  if (source.priority) badges.push(source.priority as string);
  if (source.type && type === 'leads') badges.push(source.type as string);
  if (source.partnershipStatus) badges.push(source.partnershipStatus as string);
  
  // For interactions - show type as badge
  if (type === 'lead-interactions' || type === 'partnership-interactions') {
    if (source.type) badges.push((source.type as string).replace('_', ' '));
  }
  
  // For partnership activities - show activity type and impact score
  if (type === 'partnership-activities') {
    if (source.activityType) badges.push((source.activityType as string).replace('_', ' '));
    if (source.impactScore) badges.push(`Impact: ${source.impactScore}/5`);
  }

  return badges.slice(0, 3);
}

/**
 * Get link based on entity type
 */
function getLink(hit: SearchHit): string {
  const config = ENTITY_CONFIG[hit.entityType] || ENTITY_CONFIG.events;
  const source = hit.source as Record<string, unknown>;

  // Entity-specific routing logic
  switch (hit.entityType) {
    case 'events':
      return `/admin/events/${hit.id}`;
    
    case 'archived-events':
      return `/archive?id=${hit.id}`;
    
    case 'tasks':
      // Tasks are viewed within their event context
      const eventIdForTask = source.eventId;
      if (eventIdForTask) {
        return `/admin/events/${eventIdForTask}?tab=tasks&taskId=${hit.id}`;
      }
      // Check if lead task
      const leadIdForTask = source.leadId;
      if (leadIdForTask) {
        return `/admin/leads/${leadIdForTask}?tab=tasks`;
      }
      // Check if partnership task
      const partnershipIdForTask = source.partnershipId;
      if (partnershipIdForTask) {
        return `/admin/partnerships/${partnershipIdForTask}?tab=tasks`;
      }
      return `/admin/tasks`;
    
    case 'attendees':
    case 'invitees':
      // Link to the event's attendees tab
      const eventId = source.eventId;
      if (eventId) {
        return `/admin/events/${eventId}?tab=attendees`;
      }
      return config.route;
    
    case 'contacts':
      // Contacts page is a list, no detail view - return to contacts with search
      return `/admin/contacts?search=${encodeURIComponent(String(source.nameEn || source.email || ''))}`;
    
    case 'organizations':
      // Non-partner organizations - link to partnerships page with search filter
      // (since there's no dedicated org detail page yet)
      const orgName = source.name || source.nameEn;
      return `/admin/partnerships?search=${encodeURIComponent(String(orgName || ''))}`;
    
    case 'partnerships':
      // Partner organizations - link directly to partnership detail
      return `/admin/partnerships?id=${hit.id}`;
    
    case 'agreements':
      // Agreements link to the partnership they belong to
      const agreementOrgId = source.organizationId;
      if (agreementOrgId) {
        return `/admin/partnerships/${agreementOrgId}?tab=agreements`;
      }
      return `/admin/partnerships?id=${hit.id}`;
    
    case 'leads':
      return `/admin/leads/${hit.id}`;
    
    case 'lead-interactions':
      // Lead interactions should link to the lead's interactions tab
      const leadId = source.leadId;
      if (leadId) {
        return `/admin/leads/${leadId}?tab=interactions`;
      }
      return '/admin/leads';
    
    case 'partnership-activities':
      // Partnership activities should link to the partnership's activities tab
      const orgIdForActivity = source.organizationId;
      if (orgIdForActivity) {
        return `/admin/partnerships/${orgIdForActivity}?tab=activities`;
      }
      return '/admin/partnerships';
    
    case 'partnership-interactions':
      // Partnership interactions should link to the partnership's interactions tab
      const orgIdForInteraction = source.organizationId;
      if (orgIdForInteraction) {
        return `/admin/partnerships/${orgIdForInteraction}?tab=interactions`;
      }
      return '/admin/partnerships';
    
    case 'departments':
      return `/admin/stakeholders?department=${hit.id}`;
    
    case 'updates':
      return `/admin/updates?id=${hit.id}`;
    
    default:
      return `${config.route}/${hit.id}`;
  }
}

export function SearchResultCard({ hit }: SearchResultCardProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  
  const config = ENTITY_CONFIG[hit.entityType] || ENTITY_CONFIG.events;
  const Icon = config.icon;
  const fields = getDisplayFields(hit);
  const linkTo = getLink(hit);

  return (
    <Link href={linkTo}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className={cn('flex gap-4', isRTL && 'flex-row-reverse')}>
            {/* Entity Icon */}
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
              config.color
            )}>
              <Icon className="h-5 w-5 text-white" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className={cn(
                'flex items-start justify-between gap-2',
                isRTL && 'flex-row-reverse'
              )}>
                <div className={cn(isRTL && 'text-right', 'flex-1 min-w-0')}>
                  {/* Show both EN and AR titles for bilingual support */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3
                      className="font-medium text-foreground line-clamp-1"
                      dangerouslySetInnerHTML={{ __html: fields.title }}
                    />
                    {fields.titleAr && fields.titleAr !== fields.title && (
                      <span 
                        className="text-sm text-muted-foreground line-clamp-1" 
                        dir="rtl"
                      >
                        ({fields.titleAr})
                      </span>
                    )}
                  </div>
                </div>

                {/* Entity type badge */}
                <Badge variant="outline" className="shrink-0 capitalize text-xs">
                  {t(config.labelKey, (hit.entityType || 'unknown').replace('-', ' '))}
                </Badge>
              </div>

              {/* Subtitle */}
              {fields.subtitle && (
                <p className={cn(
                  'text-sm text-muted-foreground mt-1',
                  isRTL && 'text-right'
                )}>
                  {fields.subtitle}
                </p>
              )}

              {/* Description with highlighting */}
              {fields.description && (
                <p
                  className={cn(
                    'text-sm text-muted-foreground mt-2 line-clamp-2',
                    isRTL && 'text-right'
                  )}
                  dangerouslySetInnerHTML={{ __html: fields.description }}
                />
              )}

              {/* Badges */}
              {fields.badges.length > 0 && (
                <div className={cn(
                  'flex gap-1 mt-2 flex-wrap',
                  isRTL && 'flex-row-reverse'
                )}>
                  {fields.badges.map((badge) => (
                    <Badge key={badge} variant="secondary" className="text-xs">
                      {badge}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
