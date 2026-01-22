import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  iconColor = 'text-primary',
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-3">
            {Icon && (
              <div className={cn('p-2 rounded-lg bg-primary/10', iconColor.includes('amber') && 'bg-amber-500/10')}>
                <Icon className={cn('h-6 w-6', iconColor)} />
              </div>
            )}
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              {title}
            </span>
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground ms-0 sm:ms-[52px]">
              {subtitle}
            </p>
          )}
        </div>
        {children && (
          <div className="flex items-center gap-2 flex-wrap">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
