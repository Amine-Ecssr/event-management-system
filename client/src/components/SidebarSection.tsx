import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import type { NavigationSection, NavigationItem } from '@/lib/navigationConfig';

interface SidebarSectionProps {
  section: NavigationSection;
  isExpanded: boolean;
  onToggle: () => void;
  currentPath: string;
  onNavigate: (href: string) => void;
  isSuperAdmin: boolean;
}

export function SidebarSection({
  section,
  isExpanded,
  onToggle,
  currentPath,
  onNavigate,
  isSuperAdmin,
}: SidebarSectionProps) {
  const { t } = useTranslation();
  const Icon = section.icon;

  // Filter items based on superAdminOnly flag
  const visibleItems = section.items.filter(
    (item) => !item.superAdminOnly || isSuperAdmin
  );

  // Don't render section if no visible items
  if (visibleItems.length === 0) {
    return null;
  }

  // Check if any item in this section is active
  const hasActiveItem = visibleItems.some(item => currentPath === item.href);

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={onToggle}
      className="group/section"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-md transition-colors",
            "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            hasActiveItem && !isExpanded && "bg-sidebar-accent/50 text-sidebar-accent-foreground"
          )}
          data-testid={`section-toggle-${section.id}`}
        >
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{t(section.titleKey)}</span>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 transition-transform duration-200 ease-in-out",
              !isExpanded && "ltr:-rotate-90 rtl:rotate-90"
            )}
          />
        </button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down">
        <SidebarMenu className="ps-4 pt-1 pb-2">
          {visibleItems.map((item) => (
            <SidebarNavItem
              key={item.href}
              item={item}
              isActive={currentPath === item.href}
              onNavigate={onNavigate}
            />
          ))}
        </SidebarMenu>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface SidebarNavItemProps {
  item: NavigationItem;
  isActive: boolean;
  onNavigate: (href: string) => void;
}

function SidebarNavItem({ item, isActive, onNavigate }: SidebarNavItemProps) {
  const { t } = useTranslation();
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        data-testid={item.testId}
      >
        <a
          href={item.href}
          onClick={(e) => {
            e.preventDefault();
            onNavigate(item.href);
          }}
        >
          <Icon className="h-4 w-4" />
          <span>{t(item.labelKey)}</span>
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export default SidebarSection;
