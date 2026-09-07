import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  badge?: ReactNode;
  className?: string;
}

// note : En-tête de page standardisé avec typographie Sora et zone d'actions
export function PageHeader({
  title,
  description,
  actions,
  badge,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 pb-6 md:flex-row md:items-center md:justify-between',
        className,
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold tracking-tight text-kaza-text sm:text-3xl">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="text-sm text-kaza-muted sm:text-base">{description}</p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 pt-2 md:pt-0">
          {actions}
        </div>
      )}
    </div>
  );
}
