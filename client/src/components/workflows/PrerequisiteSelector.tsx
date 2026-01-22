import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronsUpDown, X, Link2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';

interface DepartmentRequirement {
  id: number;
  stakeholderId: number;
  title: string;
  titleAr?: string | null;
  description: string | null;
  descriptionAr?: string | null;
  isDefault: boolean;
  notificationEmails?: string[];
}

interface Department {
  id: number;
  name: string;
  nameAr?: string | null;
  requirements: DepartmentRequirement[];
}

interface PrerequisiteSelectorProps {
  /** Current requirement's ID (undefined for new requirements) */
  currentRequirementId?: number;
  /** Current department ID */
  currentDepartmentId: number;
  /** Already selected prerequisite IDs */
  selectedPrerequisites: number[];
  /** Callback when prerequisites change */
  onPrerequisitesChange: (prerequisiteIds: number[]) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
}

/**
 * A multi-select component for choosing task template prerequisites.
 * Shows all task templates from all departments, grouped by department.
 * Prevents circular dependencies and self-selection.
 */
export function PrerequisiteSelector({
  currentRequirementId,
  currentDepartmentId,
  selectedPrerequisites,
  onPrerequisitesChange,
  disabled = false,
}: PrerequisiteSelectorProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const [open, setOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Fetch all departments with their requirements
  const { data: departments = [], isLoading } = useQuery<Department[]>({
    queryKey: ['/api/stakeholders'],
    queryFn: () => apiRequest('GET', '/api/stakeholders'),
  });

  // Group requirements by department for display
  const groupedRequirements = useMemo(() => {
    const groups: { department: Department; requirements: DepartmentRequirement[] }[] = [];
    
    for (const dept of departments) {
      // Filter out current requirement (can't be prerequisite of itself)
      const availableReqs = dept.requirements.filter(
        req => req.id !== currentRequirementId
      );
      
      if (availableReqs.length > 0) {
        groups.push({
          department: dept,
          requirements: availableReqs,
        });
      }
    }
    
    return groups;
  }, [departments, currentRequirementId]);

  // Map of all requirements by ID for quick lookup
  const requirementMap = useMemo(() => {
    const map = new Map<number, { requirement: DepartmentRequirement; department: Department }>();
    for (const dept of departments) {
      for (const req of dept.requirements) {
        map.set(req.id, { requirement: req, department: dept });
      }
    }
    return map;
  }, [departments]);

  // Get display name for a requirement
  const getRequirementDisplayName = (req: DepartmentRequirement) => {
    return isArabic && req.titleAr ? req.titleAr : req.title;
  };

  // Get display name for a department
  const getDepartmentDisplayName = (dept: Department) => {
    return isArabic && dept.nameAr ? dept.nameAr : dept.name;
  };

  // Validate circular dependency when adding a prerequisite
  const validateNoCircularDependency = async (prereqId: number): Promise<boolean> => {
    if (!currentRequirementId) {
      // New requirement - no existing chain to check
      return true;
    }
    
    try {
      // Call backend to validate
      const response = await apiRequest(
        'POST',
        `/api/stakeholders/${currentDepartmentId}/requirements/${currentRequirementId}/validate-prerequisite`,
        { prerequisiteId: prereqId }
      );
      return response.valid !== false;
    } catch (error: any) {
      // If validation endpoint returns error, assume it's a circular dependency
      if (error.message?.includes('circular')) {
        setValidationError(t('workflows.circularDependencyError'));
        return false;
      }
      // For other errors, allow the operation but log warning
      console.warn('Prerequisite validation failed:', error);
      return true;
    }
  };

  // Handle prerequisite selection
  const handleSelect = async (prereqId: number) => {
    setValidationError(null);
    
    if (selectedPrerequisites.includes(prereqId)) {
      // Remove prerequisite
      onPrerequisitesChange(selectedPrerequisites.filter(id => id !== prereqId));
    } else {
      // Add prerequisite (with validation)
      const isValid = await validateNoCircularDependency(prereqId);
      if (isValid) {
        onPrerequisitesChange([...selectedPrerequisites, prereqId]);
      }
    }
  };

  // Remove a prerequisite
  const handleRemove = (prereqId: number) => {
    setValidationError(null);
    onPrerequisitesChange(selectedPrerequisites.filter(id => id !== prereqId));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{t('workflows.prerequisites')}</span>
      </div>
      
      <p className="text-xs text-muted-foreground">
        {t('workflows.prerequisitesDescription')}
      </p>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled || isLoading}
            data-testid="prerequisite-selector-trigger"
          >
            {selectedPrerequisites.length > 0
              ? t('workflows.prerequisitesSelected', { count: selectedPrerequisites.length })
              : t('workflows.selectPrerequisites')}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder={t('workflows.searchTemplates')} />
            <CommandList className="max-h-[300px] overflow-y-auto">
              <CommandEmpty>{t('workflows.noTemplatesFound')}</CommandEmpty>
              {groupedRequirements.map(({ department, requirements }) => (
                <CommandGroup
                  key={department.id}
                  heading={
                    <span className={cn(
                      "font-medium",
                      department.id === currentDepartmentId && "text-primary"
                    )}>
                      {getDepartmentDisplayName(department)}
                      {department.id === currentDepartmentId && (
                        <span className="ms-1 text-xs text-muted-foreground">
                          ({t('workflows.currentDepartment')})
                        </span>
                      )}
                    </span>
                  }
                >
                  {requirements.map((req) => {
                    const isSelected = selectedPrerequisites.includes(req.id);
                    return (
                      <CommandItem
                        key={req.id}
                        value={`${department.name}-${req.title}`}
                        onSelect={() => handleSelect(req.id)}
                        data-testid={`prerequisite-option-${req.id}`}
                      >
                        <Check
                          className={cn(
                            "me-2 h-4 w-4",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex-1">
                          <span>{getRequirementDisplayName(req)}</span>
                          {req.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                              {isArabic && req.descriptionAr ? req.descriptionAr : req.description}
                            </p>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Validation error message */}
      {validationError && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Selected prerequisites badges */}
      {selectedPrerequisites.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedPrerequisites.map((prereqId) => {
            const info = requirementMap.get(prereqId);
            if (!info) return null;
            
            const { requirement, department } = info;
            const isSameDept = department.id === currentDepartmentId;
            
            return (
              <Badge
                key={prereqId}
                variant={isSameDept ? "default" : "secondary"}
                className="gap-1 pe-1"
                data-testid={`prerequisite-badge-${prereqId}`}
              >
                <span className="truncate max-w-[150px]">
                  {getRequirementDisplayName(requirement)}
                </span>
                {!isSameDept && (
                  <span className="text-xs opacity-70">
                    ({getDepartmentDisplayName(department)})
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(prereqId)}
                  className="ms-1 hover:bg-secondary-foreground/20 rounded p-0.5"
                  disabled={disabled}
                  data-testid={`prerequisite-remove-${prereqId}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
