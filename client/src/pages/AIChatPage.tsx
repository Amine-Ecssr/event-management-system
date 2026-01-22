'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import DOMPurify from 'isomorphic-dompurify';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';

// Icons
import {
  Sparkles,
  Send,
  User,
  Loader2,
  ExternalLink,
  Calendar,
  CheckSquare,
  Handshake,
  UserPlus,
  Search,
  MessageSquare,
  Zap,
  Trash2,
  ArrowRight,
  Info,
  Lightbulb,
  Database,
  ClipboardList,
  History,
  Plus,
  MoreVertical,
  Edit2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { AiChatMessage, AiChatResponse, AiSource } from '@/types/ai';

// Types for chat persistence
interface AiConversation {
  id: string;
  userId: number;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
}

interface AiPersistedMessage {
  id: number;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: AiSource[] | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

// ============================================================================
// Constants
// ============================================================================

const ENTITY_ROUTE_MAP: Record<
  string,
  { base: string; mode: 'detail' | 'list' | 'search'; icon: typeof Calendar; color: string }
> = {
  // Plural forms (from backend entity types)
  event: { base: '/admin/events', mode: 'detail', icon: Calendar, color: 'text-blue-500' },
  task: { base: '/admin/tasks', mode: 'search', icon: CheckSquare, color: 'text-green-500' },
  contact: { base: '/admin/contacts', mode: 'search', icon: UserPlus, color: 'text-orange-500' },
  partnership: { base: '/admin/partnerships', mode: 'detail', icon: Handshake, color: 'text-purple-500' },
  lead: { base: '/admin/leads', mode: 'detail', icon: UserPlus, color: 'text-yellow-500' },
  // Legacy plural forms for backwards compatibility  
  events: { base: '/admin/events', mode: 'detail', icon: Calendar, color: 'text-blue-500' },
  'archived-events': { base: '/archive', mode: 'detail', icon: Calendar, color: 'text-slate-500' },
  tasks: { base: '/admin/tasks', mode: 'search', icon: CheckSquare, color: 'text-green-500' },
  contacts: { base: '/admin/contacts', mode: 'search', icon: UserPlus, color: 'text-orange-500' },
  organizations: { base: '/admin/partnerships', mode: 'search', icon: Handshake, color: 'text-purple-500' },
  leads: { base: '/admin/leads', mode: 'detail', icon: UserPlus, color: 'text-yellow-500' },
  agreements: { base: '/admin/partnerships', mode: 'list', icon: Handshake, color: 'text-purple-500' },
  partnerships: { base: '/admin/partnerships', mode: 'detail', icon: Handshake, color: 'text-purple-500' },
  updates: { base: '/admin/updates', mode: 'list', icon: MessageSquare, color: 'text-cyan-500' },
  departments: { base: '/admin/stakeholders', mode: 'list', icon: UserPlus, color: 'text-indigo-500' },
};

const QUICK_PROMPTS = [
  {
    id: 'upcoming',
    label: 'Upcoming events',
    prompt: 'What events are coming up in the next two weeks?',
    icon: Calendar,
  },
  {
    id: 'partnerships',
    label: 'Recent partnerships',
    prompt: 'What are the most recent partnership updates?',
    icon: Handshake,
  },
  {
    id: 'tasks',
    label: 'Pending tasks',
    prompt: 'Find tasks that need attention or are overdue',
    icon: CheckSquare,
  },
  {
    id: 'contacts',
    label: 'Key contacts',
    prompt: 'List key contacts for our latest partnerships',
    icon: UserPlus,
  },
];

const TIPS = [
  'Ask for summaries, owners, and timelines to surface key records',
  'Use dates, departments, or partner names to narrow results',
  'Try "summarize this week" for a quick overview',
  'Ask about specific events or partnerships by name',
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sanitize text content to prevent XSS attacks
 * 
 * This ensures AI-generated content cannot execute malicious scripts.
 * Uses DOMPurify to strip all HTML tags and dangerous attributes while
 * preserving the text content for safe rendering in React components.
 * 
 * Security considerations:
 * - All AI responses pass through this sanitizer before rendering
 * - React's JSX also provides built-in XSS protection
 * - Double-layer defense: DOMPurify + React escaping
 * 
 * @param text - Raw text that may contain HTML/scripts
 * @returns Sanitized plain text safe for rendering
 */
function sanitizeText(text: string): string {
  // DOMPurify configuration for text-only content
  const cleanText = DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [], // No HTML tags allowed - text only
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true, // Keep the text content
  });
  return cleanText;
}

/**
 * Parse structured data from AI response
 * Looks for ```eventvue-data JSON blocks
 */
interface EventVueData {
  type: 'events' | 'tasks' | 'contacts' | 'partnerships' | 'leads' | 'updates';
  items: Array<{
    id: number | string;
    title?: string;
    name?: string;
    nameEn?: string;
    nameAr?: string;
    startDate?: string;
    endDate?: string;
    dueDate?: string;
    location?: string;
    category?: string;
    status?: string;
    priority?: string;
    description?: string;
    // Lead-specific fields
    organization?: string;
    email?: string;
    phone?: string;
    // Partnership-specific fields
    partnershipStatus?: string;
    // Update-specific fields
    updateType?: string;
    createdAt?: string;
  }>;
}

function parseEventVueData(text: string): { cleanText: string; data: EventVueData | null } {
  const dataBlockRegex = /```eventvue-data\s*([\s\S]*?)```/g;
  let data: EventVueData | null = null;
  
  // Sanitize the input text to prevent XSS in markdown blocks
  const sanitizedText = sanitizeText(text);
  
  const cleanText = sanitizedText.replace(dataBlockRegex, (_, jsonContent) => {
    try {
      const parsed = JSON.parse(jsonContent.trim());
      if (parsed.type && parsed.items && Array.isArray(parsed.items)) {
        // Sanitize all string fields in the structured data
        data = {
          type: parsed.type,
          items: parsed.items.map((item: any) => ({
            id: item.id,
            title: item.title ? sanitizeText(String(item.title)) : undefined,
            name: item.name ? sanitizeText(String(item.name)) : undefined,
            startDate: item.startDate,
            endDate: item.endDate,
            dueDate: item.dueDate,
            location: item.location ? sanitizeText(String(item.location)) : undefined,
            category: item.category ? sanitizeText(String(item.category)) : undefined,
            status: item.status ? sanitizeText(String(item.status)) : undefined,
            priority: item.priority ? sanitizeText(String(item.priority)) : undefined,
            description: item.description ? sanitizeText(String(item.description)) : undefined,
          })),
        };
      }
    } catch (e) {
      console.warn('Failed to parse eventvue-data block:', e);
    }
    return ''; // Remove the data block from display text
  }).trim();
  
  return { cleanText, data };
}

/**
 * Render structured data as rich UI cards
 */
function renderStructuredData(data: EventVueData): React.ReactNode {
  const { type, items } = data;

  if (!items || items.length === 0) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'draft': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'suspended': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'terminated': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      // Lead status colors
      case 'new': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'contacted': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200';
      case 'qualified': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'proposal': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
      case 'negotiation': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      case 'won': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'lost': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getLink = (item: EventVueData['items'][0]) => {
    switch (type) {
      case 'events': return `/admin/events/${item.id}`;
      case 'tasks': return `/admin/tasks?search=${encodeURIComponent(item.title || item.name || '')}`;
      case 'partnerships': return `/admin/partnerships/${item.id}`;
      case 'contacts': return `/admin/contacts?search=${encodeURIComponent(item.name || '')}`;
      case 'leads': return `/admin/leads/${item.id}`;
      case 'updates': return `/admin/updates`;
      default: return '#';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'events': return Calendar;
      case 'tasks': return CheckSquare;
      case 'partnerships': return Handshake;
      case 'leads': return UserPlus;
      case 'updates': return MessageSquare;
      default: return Search;
    }
  };

  const getIconColors = () => {
    switch (type) {
      case 'events': return { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-600 dark:text-blue-400' };
      case 'tasks': return { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-600 dark:text-green-400' };
      case 'partnerships': return { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-600 dark:text-purple-400' };
      case 'leads': return { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-600 dark:text-yellow-400' };
      case 'updates': return { bg: 'bg-cyan-100 dark:bg-cyan-900', text: 'text-cyan-600 dark:text-cyan-400' };
      default: return { bg: 'bg-gray-100 dark:bg-gray-900', text: 'text-gray-600 dark:text-gray-400' };
    }
  };

  const Icon = getIcon();
  const iconColors = getIconColors();
  
  return (
    <div className="mt-4 space-y-2">
      {items.map((item, index) => (
        <Link key={item.id || index} href={getLink(item)}>
          <div className="group p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
            <div className="flex items-start gap-3">
              <div className={cn(
                "p-2 rounded-md shrink-0",
                type === 'events' ? 'bg-blue-100 dark:bg-blue-900' :
                type === 'tasks' ? 'bg-green-100 dark:bg-green-900' :
                type === 'partnerships' ? 'bg-purple-100 dark:bg-purple-900' :
                'bg-orange-100 dark:bg-orange-900'
              )}>
                <Icon className={cn(
                  "h-4 w-4",
                  type === 'events' ? 'text-blue-600 dark:text-blue-400' :
                  type === 'tasks' ? 'text-green-600 dark:text-green-400' :
                  type === 'partnerships' ? 'text-purple-600 dark:text-purple-400' :
                  'text-orange-600 dark:text-orange-400'
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                    {item.title || item.name}
                  </span>
                  {item.status && (
                    <span className={cn("px-1.5 py-0.5 text-xs rounded-full", getStatusColor(item.status))}>
                      {item.status}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                  {(item.startDate || item.dueDate) && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {item.startDate && item.endDate && item.startDate !== item.endDate
                        ? `${formatDate(item.startDate)} - ${formatDate(item.endDate)}`
                        : formatDate(item.startDate || item.dueDate)}
                    </span>
                  )}
                  {item.location && (
                    <span className="truncate max-w-[200px]">📍 {item.location}</span>
                  )}
                  {item.category && (
                    <span className="truncate max-w-[150px]">🏷️ {item.category}</span>
                  )}
                  {item.priority && (
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-xs",
                      item.priority === 'critical' ? 'bg-red-100 text-red-700' :
                      item.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                      item.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    )}>
                      {item.priority}
                    </span>
                  )}
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

/**
 * Simple markdown renderer for AI responses
 * Handles: **bold**, *italic*, `code`, bullet points, numbered lists, headers
 * Also parses and renders eventvue-data blocks as rich UI cards
 */
function renderMarkdown(text: string): React.ReactNode {
  // First, parse out any structured data blocks
  const { cleanText, data } = parseEventVueData(text);
  
  const lines = cleanText.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (listItems.length > 0) {
      if (listType === 'ul') {
        elements.push(<ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 my-2">{listItems}</ul>);
      } else {
        elements.push(<ol key={`ol-${elements.length}`} className="list-decimal list-inside space-y-1 my-2">{listItems}</ol>);
      }
      listItems = [];
      listType = null;
    }
  };

  const formatInline = (line: string): React.ReactNode => {
    // Sanitize the entire line first to prevent XSS
    const sanitizedLine = sanitizeText(line);
    
    // Split by markdown patterns and rebuild with React elements
    const parts: React.ReactNode[] = [];
    let remaining = sanitizedLine;
    let keyIndex = 0;

    while (remaining.length > 0) {
      // Match **bold**, *italic*, `code`
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);
      const codeMatch = remaining.match(/`([^`]+)`/);

      // Collect all valid matches with their positions
      const matches: Array<{ match: RegExpMatchArray; type: 'bold' | 'italic' | 'code' }> = [];
      if (boldMatch) matches.push({ match: boldMatch, type: 'bold' });
      if (italicMatch) matches.push({ match: italicMatch, type: 'italic' });
      if (codeMatch) matches.push({ match: codeMatch, type: 'code' });

      // Find the earliest match
      const earliestMatch = matches.length > 0
        ? matches.reduce((earliest, current) => 
            current.match.index! < earliest.match.index! ? current : earliest
          )
        : null;

      if (earliestMatch) {
        const { match, type } = earliestMatch;
        const beforeMatch = remaining.slice(0, match.index!);
        if (beforeMatch) {
          parts.push(beforeMatch);
        }

        if (type === 'bold') {
          // Content is already sanitized from the parent line
          parts.push(<strong key={keyIndex++} className="font-semibold">{match[1]}</strong>);
        } else if (type === 'italic') {
          parts.push(<em key={keyIndex++}>{match[1]}</em>);
        } else if (type === 'code') {
          parts.push(<code key={keyIndex++} className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">{match[1]}</code>);
        }

        remaining = remaining.slice(match.index! + match[0].length);
      } else {
        parts.push(remaining);
        remaining = '';
      }
    }

    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Empty line - flush list and add spacing
    if (!trimmedLine) {
      flushList();
      if (elements.length > 0 && i < lines.length - 1) {
        elements.push(<div key={`space-${i}`} className="h-2" />);
      }
      continue;
    }

    // Headers (## Header)
    const headerMatch = trimmedLine.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      flushList();
      const level = headerMatch[1].length;
      const content = formatInline(headerMatch[2]);
      if (level === 1) {
        elements.push(<h3 key={`h-${i}`} className="text-base font-bold mt-3 mb-1">{content}</h3>);
      } else if (level === 2) {
        elements.push(<h4 key={`h-${i}`} className="text-sm font-semibold mt-2 mb-1">{content}</h4>);
      } else {
        elements.push(<h5 key={`h-${i}`} className="text-sm font-medium mt-2 mb-1">{content}</h5>);
      }
      continue;
    }

    // Bullet points (- item, • item, * item at start)
    const bulletMatch = trimmedLine.match(/^[-•*]\s+(.+)$/);
    if (bulletMatch) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listItems.push(<li key={`li-${i}`}>{formatInline(bulletMatch[1])}</li>);
      continue;
    }

    // Numbered list (1. item, 2. item)
    const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      listItems.push(<li key={`li-${i}`}>{formatInline(numberedMatch[2])}</li>);
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(<p key={`p-${i}`} className="my-1">{formatInline(line)}</p>);
  }

  flushList();
  
  return (
    <div className="space-y-0">
      {elements}
      {data && renderStructuredData(data)}
    </div>
  );
}

function getSourceLink(source: AiSource): string {
  const routeConfig = ENTITY_ROUTE_MAP[source.entityType];
  const fallbackLink = `/admin/search?q=${encodeURIComponent(source.title)}`;

  if (!routeConfig) return fallbackLink;

  // Check if we have a valid ID for detail routes
  const hasValidId = source.id && source.id !== '' && source.id !== 'undefined';

  switch (routeConfig.mode) {
    case 'detail':
      // Only use detail route if we have a valid ID
      if (hasValidId) {
        return `${routeConfig.base}/${source.id}`;
      }
      // Fall back to search with title
      return `${routeConfig.base}?search=${encodeURIComponent(source.title)}`;
    case 'list':
      return routeConfig.base;
    case 'search':
    default:
      // For search mode, always use the search parameter with the title
      return `${routeConfig.base}?search=${encodeURIComponent(source.title)}`;
  }
}

// ============================================================================
// Sub-components
// ============================================================================

function SourceCard({ source }: { source: AiSource }) {
  const link = getSourceLink(source);
  const routeConfig = ENTITY_ROUTE_MAP[source.entityType];
  const IconComponent = routeConfig?.icon || Search;
  const iconColor = routeConfig?.color || 'text-muted-foreground';

  return (
    <Link href={link}>
      <Card className="group hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer">
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className={cn('p-2 rounded-lg bg-muted', iconColor)}>
              <IconComponent className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                  {source.title}
                </span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
              {source.snippet && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {source.snippet}
                </p>
              )}
              <Badge variant="outline" className="text-[10px] font-normal">
                {source.entityType.replace('-', ' ')}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ChatMessage({ message, isLoading = false }: { message: AiChatMessage; isLoading?: boolean }) {
  const { t } = useTranslation();
  const isUser = message.role === 'user';
  
  // Convert sources to structured data format for rich rendering
  const sourcesAsStructuredData = React.useMemo((): EventVueData | null => {
    if (!message.sources || message.sources.length === 0) return null;
    
    // Group sources by entity type
    const eventSources = message.sources.filter(s => s.entityType === 'event' || s.entityType === 'events');
    const taskSources = message.sources.filter(s => s.entityType === 'task' || s.entityType === 'tasks');
    
    // Return the largest group as structured data
    if (eventSources.length > 0) {
      return {
        type: 'events',
        items: eventSources.map(s => ({
          id: s.id,
          title: s.title,
          startDate: s.metadata?.startDate as string | undefined,
          endDate: s.metadata?.endDate as string | undefined,
          location: s.metadata?.location as string | undefined,
          category: s.metadata?.category as string | undefined,
          status: s.metadata?.status as string | undefined,
          description: s.snippet,
        })),
      };
    }
    
    if (taskSources.length > 0) {
      return {
        type: 'tasks',
        items: taskSources.map(s => ({
          id: s.id,
          title: s.title,
          dueDate: s.metadata?.dueDate as string | undefined,
          status: s.metadata?.status as string | undefined,
          priority: s.metadata?.priority as string | undefined,
          description: s.snippet,
        })),
      };
    }
    
    return null;
  }, [message.sources]);

  return (
    <div className={cn('flex gap-4', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <Avatar
        className={cn(
          'h-9 w-9 shrink-0 ring-2 ring-background shadow-sm',
          isUser ? 'bg-primary' : 'bg-gradient-to-br from-violet-500 to-purple-600'
        )}
      >
        <AvatarFallback className={cn(isUser ? 'bg-primary text-primary-foreground' : 'bg-transparent text-white')}>
          {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div className={cn('flex flex-col gap-3 max-w-[85%]', isUser ? 'items-end' : 'items-start')}>
        <Card className={cn(isUser ? 'bg-primary text-primary-foreground border-primary' : 'bg-card')}>
          <CardContent className="p-4">
            {isLoading ? (
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-current rounded-full animate-bounce" />
                </div>
                <span className="text-sm text-muted-foreground">{t('ai.thinking', 'Thinking...')}</span>
              </div>
            ) : isUser ? (
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
            ) : (
              <div className="text-sm leading-relaxed prose-sm">
                {renderMarkdown(message.content)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rich entity cards from sources - rendered below the message */}
        {!isUser && sourcesAsStructuredData && (
          <div className="w-full">
            {renderStructuredData(sourcesAsStructuredData)}
          </div>
        )}

        {/* Fallback: Show source cards only if NO structured data was rendered */}
        {!isUser && message.sources && message.sources.length > 0 && !sourcesAsStructuredData && (
          <div className="w-full space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Database className="h-3 w-3" />
              {message.sources.length} source{message.sources.length !== 1 && 's'} found
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {message.sources.slice(0, 6).map((source) => (
                <SourceCard key={`${source.entityType}-${source.id}`} source={source} />
              ))}
            </div>
            {message.sources.length > 6 && (
              <p className="text-xs text-muted-foreground text-center">
                +{message.sources.length - 6} more results
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onPromptSelect }: { onPromptSelect: (prompt: string) => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      {/* Hero icon */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/30 to-purple-500/30 rounded-full blur-3xl" />
        <div className="relative p-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 shadow-xl shadow-purple-500/20">
          <Sparkles className="h-10 w-10 text-white" />
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-2">{t('ai.chatTitle', 'AI Chat Assistant')}</h2>
      <p className="text-muted-foreground text-center max-w-md mb-8">
        {t('ai.chatEmpty', 'Ask questions about your events, tasks, partnerships, and more. Get instant answers powered by RAG.')}
      </p>

      {/* Quick prompts */}
      <div className="w-full max-w-2xl">
        <p className="text-sm font-medium text-muted-foreground mb-4 text-center">Quick questions:</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {QUICK_PROMPTS.map((item) => (
            <button
              key={item.id}
              onClick={() => onPromptSelect(item.prompt)}
              className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent hover:border-primary/20 transition-all duration-200 text-left group"
            >
              <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <item.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground truncate">{item.prompt}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TipsCard() {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-yellow-500" />
          {t('ai.chatTipsTitle', 'Tips for better results')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {TIPS.map((tip, idx) => (
          <div key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="text-primary font-medium">{idx + 1}.</span>
            <span>{tip}</span>
          </div>
        ))}
        <Separator className="my-3" />
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">RAG Mode:</span> Responses cite Elasticsearch records, so you can jump directly to details.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Sidebar Component for Conversation History
// ============================================================================

function ConversationSidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  isCollapsed,
  onToggleCollapse,
}: {
  conversations: AiConversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { t } = useTranslation();

  if (isCollapsed) {
    return (
      <div className="w-12 flex flex-col items-center py-4 border-r bg-muted/30">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onToggleCollapse}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Expand history</TooltipContent>
        </Tooltip>
        <Separator className="my-2 w-6" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onNewConversation}>
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">New chat</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="mt-1">
              <History className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{conversations.length} conversations</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="w-64 flex flex-col border-r bg-muted/30 overflow-hidden">
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t('ai.history', 'Chat History')}</span>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNewConversation}>
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New chat</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleCollapse}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Collapse</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <ScrollArea className="flex-1 overflow-hidden w-full">
        <div className="p-2 space-y-1 w-full max-w-full">
          {conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {t('ai.noConversations', 'No conversations yet')}
            </p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  'group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors w-full max-w-full',
                  conv.id === currentConversationId
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted'
                )}
                onClick={() => onSelectConversation(conv.id)}
              >
                <MessageSquare className="h-4 w-4 shrink-0 flex-none" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm truncate flex-1 block w-0">
                      {conv.title || t('ai.newConversation', 'New conversation')}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    {conv.title || t('ai.newConversation', 'New conversation')}
                  </TooltipContent>
                </Tooltip>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-6 w-6 shrink-0 transition-opacity",
                        conv.id === currentConversationId
                          ? "opacity-70 hover:opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conv.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AIChatPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tipsCollapsed, setTipsCollapsed] = useState(false);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch conversations list
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<AiConversation[]>({
    queryKey: ['/api/ai/conversations'],
    queryFn: () => apiRequest<AiConversation[]>('GET', '/api/ai/conversations'),
  });

  // Get or create active conversation on mount
  const getOrCreateConversation = useMutation({
    mutationFn: () => apiRequest<AiConversation>('POST', '/api/ai/conversations/active'),
    onSuccess: (conv) => {
      setCurrentConversationId(conv.id);
      queryClient.invalidateQueries({ queryKey: ['/api/ai/conversations'] });
    },
  });

  // Fetch messages for current conversation
  const { data: persistedMessages } = useQuery<AiPersistedMessage[]>({
    queryKey: ['/api/ai/conversations', currentConversationId, 'messages'],
    queryFn: () =>
      apiRequest<AiPersistedMessage[]>(
        'GET',
        `/api/ai/conversations/${currentConversationId}/messages`
      ),
    enabled: !!currentConversationId,
  });

  // Sync persisted messages to local state
  useEffect(() => {
    if (persistedMessages) {
      setMessages(
        persistedMessages.map((m) => ({
          role: m.role,
          content: m.content,
          sources: m.sources || undefined,
        }))
      );
    }
  }, [persistedMessages]);

  // Initialize conversation on mount
  useEffect(() => {
    if (!currentConversationId && !getOrCreateConversation.isPending) {
      getOrCreateConversation.mutate();
    }
  }, []);

  // Save message mutation
  const saveMessageMutation = useMutation({
    mutationFn: ({
      conversationId,
      message,
    }: {
      conversationId: string;
      message: { role: 'user' | 'assistant'; content: string; sources?: AiSource[] };
    }) =>
      apiRequest('POST', `/api/ai/conversations/${conversationId}/messages`, message),
  });

  // Create new conversation
  const createConversation = useMutation({
    mutationFn: (title?: string) =>
      apiRequest<AiConversation>('POST', '/api/ai/conversations', { title }),
    onSuccess: (conv) => {
      setCurrentConversationId(conv.id);
      setMessages([]);
      queryClient.invalidateQueries({ queryKey: ['/api/ai/conversations'] });
    },
  });

  // Delete conversation
  const deleteConversation = useMutation({
    mutationFn: (id: string) =>
      apiRequest('DELETE', `/api/ai/conversations/${id}`),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/conversations'] });
      // Only clear current state if we deleted the active conversation
      if (deletedId === currentConversationId) {
        setCurrentConversationId(null);
        setMessages([]);
        // Don't auto-create a new conversation - just show empty state
        // User can start a new one by typing or clicking "New Chat"
      }
    },
  });

  // Chat mutation with persistence
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiRequest<AiChatResponse>('POST', '/api/ai/chat', {
        message,
        history: messages
          .slice(-6)
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role, content: m.content })),
      });
    },
    onSuccess: async (response) => {
      const assistantMessage: AiChatMessage = {
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Save assistant response to database
      if (currentConversationId) {
        await saveMessageMutation.mutateAsync({
          conversationId: currentConversationId,
          message: {
            role: 'assistant',
            content: response.answer,
            sources: response.sources,
          },
        });

        // Update conversation title if this is the first exchange
        if (messages.length <= 1) {
          // Generate a title from the first user message
          const userMessage = messages[0]?.content || '';
          const title = userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : '');
          try {
            await apiRequest('PATCH', `/api/ai/conversations/${currentConversationId}`, { title });
            queryClient.invalidateQueries({ queryKey: ['/api/ai/conversations'] });
          } catch {
            // Ignore title update errors
          }
        }
      }
    },
    onError: (error: Error) => {
      toast({
        title: t('ai.chatError', 'Chat failed'),
        description: error.message || t('ai.chatErrorDesc', 'Unable to reach the assistant'),
        variant: 'destructive',
      });
      setMessages((prev) => prev.slice(0, -1));
    },
  });

  // Handlers
  const handleSend = useCallback(
    async (prompt?: string) => {
      const message = (prompt ?? input).trim();
      if (!message || chatMutation.isPending) return;

      const userMessage: AiChatMessage = { role: 'user', content: message };
      setMessages((prev) => [...prev, userMessage]);
      setInput('');

      // Save user message to database
      if (currentConversationId) {
        await saveMessageMutation.mutateAsync({
          conversationId: currentConversationId,
          message: { role: 'user', content: message },
        });
      }

      chatMutation.mutate(message);
    },
    [input, chatMutation, currentConversationId, saveMessageMutation]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = () => {
    createConversation.mutate(undefined);
  };

  const handleSelectConversation = (id: string) => {
    setCurrentConversationId(id);
    queryClient.invalidateQueries({ queryKey: ['/api/ai/conversations', id, 'messages'] });
  };

  const handleDeleteConversation = (id: string) => {
    deleteConversation.mutate(id);
  };

  const handleClearChat = () => {
    // Clear local messages and create a new conversation
    setMessages([]);
    createConversation.mutate(undefined);
  };

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatMutation.isPending]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <TooltipProvider>
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-purple-500/20">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t('ai.chatTitle', 'AI Chat')}</h1>
              <p className="text-sm text-muted-foreground">
                {t('ai.subtitle', 'Ask questions about your data using natural language')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/ai/intake">
              <Button variant="outline" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                Intake Assistant
              </Button>
            </Link>
            {messages.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleClearChat}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New chat</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Main Content with Sidebar */}
        <div className="flex gap-6">
          {/* Chat Area with History Sidebar */}
          <Card className={cn(
            "flex h-[calc(100vh-220px)] min-h-[500px] overflow-hidden transition-all duration-300",
            tipsCollapsed ? "flex-1" : "flex-1 lg:flex-[2]"
          )}>
            {/* Conversation History Sidebar */}
            <ConversationSidebar
              conversations={conversations.filter((c) => !c.isArchived)}
              currentConversationId={currentConversationId}
              onSelectConversation={handleSelectConversation}
              onNewConversation={handleNewConversation}
              onDeleteConversation={handleDeleteConversation}
              isCollapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            {/* Chat Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                {/* Messages */}
                <ScrollArea className="flex-1 p-6" ref={scrollRef}>
                  {messages.length === 0 ? (
                    <EmptyState onPromptSelect={handleSend} />
                  ) : (
                    <div className="space-y-6">
                      {messages.map((message, index) => (
                        <ChatMessage key={`${message.role}-${index}`} message={message} />
                      ))}
                      {chatMutation.isPending && (
                        <ChatMessage message={{ role: 'assistant', content: '' }} isLoading />
                      )}
                    </div>
                  )}
                </ScrollArea>

                {/* Input */}
                <div className="p-4 border-t bg-muted/30">
                  <div className="flex gap-3">
                    <Input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t('ai.chatPlaceholder', 'Ask about events, tasks, partnerships...')}
                      disabled={chatMutation.isPending}
                      className="flex-1 h-11 bg-background"
                    />
                    <Button
                      onClick={() => handleSend()}
                      disabled={chatMutation.isPending || !input.trim()}
                      className="h-11 px-6 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                    >
                      {chatMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-4 w-4 me-2" />
                          Send
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center mt-2">
                    Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Enter</kbd> to send • Powered by Elasticsearch RAG
                  </p>
                </div>
              </CardContent>
            </div>
          </Card>

          {/* Collapsible Tips Sidebar */}
          {!tipsCollapsed ? (
            <div className="hidden lg:flex flex-col w-72 space-y-4 shrink-0">
              <div className="flex justify-end">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setTipsCollapsed(true)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Hide tips</TooltipContent>
                </Tooltip>
              </div>
              <TipsCard />
              
              {/* Quick Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {QUICK_PROMPTS.map((item) => (
                    <Button
                      key={item.id}
                      variant="ghost"
                      className="w-full justify-start gap-2 h-auto py-2.5 px-3"
                      onClick={() => handleSend(item.prompt)}
                    >
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{item.label}</span>
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="hidden lg:flex">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => setTipsCollapsed(false)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Show tips</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
