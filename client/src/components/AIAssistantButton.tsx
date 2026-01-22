'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Icons
import {
  Sparkles,
  Send,
  User,
  Maximize2,
  Loader2,
  ExternalLink,
  Calendar,
  CheckSquare,
  Handshake,
  UserPlus,
  Search,
  MessageSquare,
  Zap,
  X,
  Trash2,
} from 'lucide-react';

import type { AiChatMessage, AiChatResponse, AiSource } from '@/types/ai';

// ============================================================================
// Constants
// ============================================================================

const ENTITY_ROUTE_MAP: Record<
  string,
  { base: string; mode: 'detail' | 'list' | 'search'; icon: React.ReactNode }
> = {
  events: { base: '/admin/events', mode: 'detail', icon: <Calendar className="h-3.5 w-3.5" /> },
  'archived-events': { base: '/archive', mode: 'detail', icon: <Calendar className="h-3.5 w-3.5" /> },
  tasks: { base: '/admin/tasks', mode: 'list', icon: <CheckSquare className="h-3.5 w-3.5" /> },
  contacts: { base: '/admin/contacts', mode: 'list', icon: <UserPlus className="h-3.5 w-3.5" /> },
  organizations: { base: '/admin/partnerships', mode: 'search', icon: <Handshake className="h-3.5 w-3.5" /> },
  leads: { base: '/admin/leads', mode: 'detail', icon: <UserPlus className="h-3.5 w-3.5" /> },
  agreements: { base: '/admin/partnerships', mode: 'list', icon: <Handshake className="h-3.5 w-3.5" /> },
  partnerships: { base: '/admin/partnerships', mode: 'detail', icon: <Handshake className="h-3.5 w-3.5" /> },
  updates: { base: '/admin/updates', mode: 'list', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  departments: { base: '/admin/stakeholders', mode: 'list', icon: <UserPlus className="h-3.5 w-3.5" /> },
};

const QUICK_ACTIONS = [
  {
    id: 'upcoming-events',
    label: 'Upcoming events',
    icon: Calendar,
    prompt: 'What events are coming up in the next 2 weeks?',
  },
  {
    id: 'pending-tasks',
    label: 'Pending tasks',
    icon: CheckSquare,
    prompt: 'List all pending tasks that need attention',
  },
  {
    id: 'partnerships',
    label: 'Recent partnerships',
    icon: Handshake,
    prompt: 'Show me the most recent partnership updates',
  },
  {
    id: 'overdue',
    label: 'Overdue items',
    icon: Zap,
    prompt: 'Which tasks are overdue and need immediate attention?',
  },
];

const SUGGESTED_PROMPTS = [
  'Summarize what happened this week',
  'Who are the key contacts for our partnerships?',
  'Find events related to technology',
  'What tasks need attention today?',
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Type definition for experimental User Agent Data API
 * @see https://developer.mozilla.org/en-US/docs/Web/API/NavigatorUAData
 */
interface NavigatorUAData {
  platform?: string;
  mobile?: boolean;
  brands?: Array<{ brand: string; version: string }>;
}

interface NavigatorWithUAData extends Navigator {
  userAgentData?: NavigatorUAData;
}

/**
 * Detect if the user is on a Mac/iOS platform
 * Uses modern API with fallback for better future compatibility
 */
function isMacPlatform(): boolean {
  // SSR/Node.js environment guard - navigator is only available in browsers
  if (typeof navigator === 'undefined') return false;
  
  // Try modern API first (Chromium 93+)
  const uaData = (navigator as NavigatorWithUAData).userAgentData;
  if (uaData?.platform) {
    return /mac/i.test(uaData.platform);
  }
  
  // Fallback to user agent string (better cross-browser support)
  if (navigator.userAgent && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return true;
  }
  
  // Last resort: deprecated platform API (for legacy browser support only)
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
}

function getSourceLink(source: AiSource): string {
  const routeConfig = ENTITY_ROUTE_MAP[source.entityType];
  const fallbackLink = `/admin/search?q=${encodeURIComponent(source.title)}`;

  if (!routeConfig) return fallbackLink;

  switch (routeConfig.mode) {
    case 'detail':
      return `${routeConfig.base}/${source.id}`;
    case 'list':
      return routeConfig.base;
    default:
      return `${routeConfig.base}?search=${encodeURIComponent(source.title)}`;
  }
}

// ============================================================================
// Sub-components
// ============================================================================

function SourceCard({ source }: { source: AiSource }) {
  const link = getSourceLink(source);
  const routeConfig = ENTITY_ROUTE_MAP[source.entityType];
  const Icon = routeConfig?.icon || <Search className="h-3.5 w-3.5" />;

  return (
    <Link href={link}>
      <div className="group flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-accent hover:border-primary/20 transition-all duration-200 cursor-pointer">
        <div className="flex-shrink-0 p-1.5 rounded-md bg-primary/10 text-primary">
          {Icon}
        </div>
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate group-hover:text-primary transition-colors">
              {source.title}
            </span>
          </div>
          {source.snippet && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {source.snippet}
            </p>
          )}
          <Badge variant="secondary" className="text-[10px] font-normal mt-1">
            {source.entityType.replace('-', ' ')}
          </Badge>
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
      </div>
    </Link>
  );
}

function ChatBubble({
  message,
  isLoading = false,
}: {
  message: AiChatMessage;
  isLoading?: boolean;
}) {
  const { t } = useTranslation();
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3 py-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <Avatar
        className={cn(
          'h-8 w-8 flex-shrink-0 ring-2 ring-background',
          isUser ? 'bg-primary' : 'bg-gradient-to-br from-violet-500 to-purple-600'
        )}
      >
        <AvatarFallback
          className={cn(
            'text-xs font-medium',
            isUser ? 'bg-primary text-primary-foreground' : 'bg-transparent text-white'
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div className={cn('flex flex-col gap-2 max-w-[80%]', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-muted/80 text-foreground rounded-bl-md'
          )}
        >
          {isLoading ? (
            <div className="flex items-center gap-2 py-1">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
              </div>
              <span className="text-xs text-muted-foreground">{t('ai.thinking', 'Thinking...')}</span>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        {/* Source cards */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="w-full space-y-2 mt-1">
            <p className="text-[11px] font-medium text-muted-foreground px-1">
              {message.sources.length} source{message.sources.length !== 1 && 's'} found
            </p>
            <div className="space-y-1.5">
              {message.sources.slice(0, 4).map((source) => (
                <SourceCard key={`${source.entityType}-${source.id}`} source={source} />
              ))}
              {message.sources.length > 4 && (
                <p className="text-xs text-muted-foreground text-center py-1">
                  +{message.sources.length - 4} more results
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onPromptSelect }: { onPromptSelect: (prompt: string) => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center h-full py-12 px-6">
      {/* Animated icon */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/30 to-purple-500/30 rounded-full blur-2xl animate-pulse" />
        <div className="relative p-5 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-purple-500/20">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-1.5">
        {t('ai.floatingTitle', 'AI Assistant')}
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-xs mb-8">
        {t('ai.chatEmpty', 'Ask questions about your events, tasks, and partnerships')}
      </p>

      {/* Suggested prompts */}
      <div className="w-full space-y-2">
        <p className="text-xs font-medium text-muted-foreground mb-3 text-center">
          Try asking:
        </p>
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onPromptSelect(prompt)}
            className="w-full text-left px-4 py-2.5 text-sm rounded-xl border border-border/50 bg-card/30 hover:bg-accent hover:border-primary/20 transition-all duration-200 group"
          >
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">
              &ldquo;{prompt}&rdquo;
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AIAssistantButton() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const isRTL = i18n.dir() === 'rtl';

  // State
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AiChatMessage[]>([]);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Chat mutation
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
    onSuccess: (response) => {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.answer, sources: response.sources },
      ]);
    },
    onError: (error: Error) => {
      toast({
        title: t('ai.chatError', 'Chat failed'),
        description: error.message || t('ai.chatErrorDesc', 'Unable to reach the assistant'),
        variant: 'destructive',
      });
      // Remove optimistic user message
      setMessages((prev) => prev.slice(0, -1));
    },
  });

  // Handlers
  const handleSend = useCallback(
    (prompt?: string) => {
      const message = (prompt ?? input).trim();
      if (!message || chatMutation.isPending) return;

      setMessages((prev) => [...prev, { role: 'user', content: message }]);
      setInput('');
      chatMutation.mutate(message);
    },
    [input, chatMutation]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const goToFullPage = () => {
    setIsOpen(false);
    setLocation('/admin/ai');
  };

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatMutation.isPending]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <TooltipProvider>
      {/* Floating Action Button - z-[9999] ensures it's above everything */}
      <div
        className={cn(
          'fixed z-[9999]',
          'bottom-6',
          isRTL ? 'left-6' : 'right-6'
        )}
      >
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  size="lg"
                  className={cn(
                    'h-14 w-14 rounded-full shadow-xl',
                    'bg-gradient-to-br from-violet-500 to-purple-600',
                    'hover:from-violet-600 hover:to-purple-700',
                    'hover:shadow-2xl hover:shadow-purple-500/30',
                    'hover:scale-105',
                    'active:scale-95',
                    'transition-all duration-200',
                    'ring-4 ring-background',
                    'focus-visible:ring-4 focus-visible:ring-purple-400'
                  )}
                  data-testid="floating-ai-button"
                >
                  <Sparkles className="h-6 w-6 text-white" />
                  <span className="sr-only">{t('ai.floatingTitle', 'AI Assistant')}</span>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent
              side={isRTL ? 'right' : 'left'}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0 shadow-lg"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="font-medium">{t('ai.floatingTooltip', 'AI Assistant')}</span>
              <kbd className="ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-white/20 rounded">
                {isMacPlatform() ? '⌘K' : 'Ctrl+K'}
              </kbd>
            </TooltipContent>
          </Tooltip>

          <DropdownMenuContent
            align={isRTL ? 'start' : 'end'}
            className="w-64 p-2"
            sideOffset={8}
          >
            <DropdownMenuLabel className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Quick Actions
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {QUICK_ACTIONS.map((action) => (
              <DropdownMenuItem
                key={action.id}
                onClick={() => {
                  setIsOpen(true);
                  setTimeout(() => handleSend(action.prompt), 200);
                }}
                className="flex items-center gap-3 py-2.5 cursor-pointer"
              >
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                  <action.icon className="h-4 w-4" />
                </div>
                <span className="text-sm">{action.label}</span>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-3 py-2.5 cursor-pointer"
            >
              <div className="p-1.5 rounded-md bg-muted">
                <MessageSquare className="h-4 w-4" />
              </div>
              <span className="text-sm">Open Chat</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={goToFullPage}
              className="flex items-center gap-3 py-2.5 cursor-pointer"
            >
              <div className="p-1.5 rounded-md bg-muted">
                <Maximize2 className="h-4 w-4" />
              </div>
              <span className="text-sm">{t('ai.fullPage', 'Full Page')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Chat Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side={isRTL ? 'left' : 'right'}
          className="w-full sm:max-w-md flex flex-col p-0 gap-0 [&>button]:hidden"
        >
          {/* Header */}
          <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
            <SheetTitle className="flex items-center gap-2.5 text-base">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              {t('ai.floatingTitle', 'AI Assistant')}
            </SheetTitle>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleClearChat}
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Clear chat</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={goToFullPage} className="h-8 w-8">
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('ai.fullPage', 'Full Page')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(false)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Close</TooltipContent>
              </Tooltip>
            </div>
          </SheetHeader>

          {/* Messages */}
          <ScrollArea className="flex-1" ref={scrollRef}>
            <div className="px-4 py-2 min-h-full">
              {messages.length === 0 ? (
                <EmptyState onPromptSelect={handleSend} />
              ) : (
                <>
                  {messages.map((message, index) => (
                    <ChatBubble key={`${message.role}-${index}`} message={message} />
                  ))}
                  {chatMutation.isPending && (
                    <ChatBubble message={{ role: 'assistant', content: '' }} isLoading />
                  )}
                </>
              )}
            </div>
          </ScrollArea>

          {/* Footer / Input */}
          <SheetFooter className="px-4 py-3 border-t flex-col gap-2 sm:flex-col">
            <div className="flex w-full gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('ai.chatPlaceholder', 'Ask about events, tasks, partnerships...')}
                disabled={chatMutation.isPending}
                className="flex-1 bg-muted/50"
              />
              <Button
                size="icon"
                onClick={() => handleSend()}
                disabled={chatMutation.isPending || !input.trim()}
                className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shrink-0"
              >
                {chatMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-center text-muted-foreground">
              Press{' '}
              <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">⌘K</kbd>{' '}
              to toggle • Powered by RAG
            </p>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
