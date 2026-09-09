import type { HTMLAttributes, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

// note : Système de Badges KAZA (Mint #10B981, Red #EF4444, Amber #F59E0B, Vert #0E4728, Pêche #F2B091)
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors',
  {
    variants: {
      variant: {
        mint: 'bg-kaza-mint/15 text-emerald-800 border border-kaza-mint/30',
        red: 'bg-kaza-red/15 text-rose-800 border border-kaza-red/30',
        amber: 'bg-kaza-amber/15 text-amber-900 border border-kaza-amber/30',
        vert: 'bg-kaza-vert/15 text-kaza-vert border border-kaza-vert/30',
        peche: 'bg-kaza-peche/30 text-stone-900 border border-kaza-peche',
        neutral: 'bg-slate-100 text-slate-700 border border-slate-200',
      },
      size: {
        sm: 'text-[11px] px-2 py-0.5',
        md: 'text-xs px-2.5 py-0.5',
        lg: 'text-sm px-3 py-1',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md',
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  children: ReactNode;
}

export function Badge({
  className,
  variant = 'neutral',
  size = 'md',
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size, className }))} {...props}>
      {dot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full', {
            'bg-kaza-mint': variant === 'mint',
            'bg-kaza-red': variant === 'red',
            'bg-kaza-amber': variant === 'amber',
            'bg-kaza-vert': variant === 'vert',
            'bg-kaza-peche': variant === 'peche',
            'bg-slate-400': variant === 'neutral',
          })}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
