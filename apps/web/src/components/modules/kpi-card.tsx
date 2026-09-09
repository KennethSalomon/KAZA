import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

export interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  variant?: 'vert' | 'peche' | 'mint' | 'red' | 'amber';
  badge?: {
    label: string;
    variant: 'mint' | 'red' | 'amber' | 'vert' | 'peche' | 'neutral';
  };
  className?: string;
}

// note : Carte d'indicateur financier / KPI avec typographie Sora et tokens de couleur KAZA
export function KpiCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant,
  badge,
  className,
}: KpiCardProps) {
  const iconColorClasses = {
    vert: 'bg-kaza-vert/10 text-kaza-vert',
    peche: 'bg-kaza-peche/20 text-stone-800',
    mint: 'bg-kaza-mint/15 text-kaza-mint',
    red: 'bg-kaza-red/15 text-kaza-red',
    amber: 'bg-kaza-amber/15 text-kaza-amber',
  }[variant || 'vert'];

  return (
    <Card className={cn('flex flex-col justify-between p-5', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-kaza-muted">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tracking-tight text-kaza-text sm:text-3xl tabular-nums">
              {value}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
          {icon && (
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-kaza', iconColorClasses)}>
              {icon}
            </div>
          )}
        </div>
      </div>

      {(subtitle || trend) && (
        <div className="mt-4 flex items-center justify-between border-t border-kaza-border/40 pt-3 text-xs text-kaza-muted">
          {subtitle && <span>{subtitle}</span>}
          {trend && (
            <span
              className={cn(
                'font-medium',
                trend.isPositive ? 'text-kaza-mint' : 'text-kaza-red',
              )}
            >
              {trend.isPositive ? '↑' : '↓'} {trend.value}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
