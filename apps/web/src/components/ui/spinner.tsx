import type { HTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'vert' | 'peche' | 'white' | 'muted';
}

// note : Indicateur de chargement stylisé KAZA
export function Spinner({
  size = 'md',
  variant = 'vert',
  className,
  ...props
}: SpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  }[size];

  const colorClasses = {
    vert: 'text-kaza-vert',
    peche: 'text-kaza-peche',
    white: 'text-white',
    muted: 'text-kaza-muted',
  }[variant];

  return (
    <div
      role="status"
      aria-label="Chargement en cours"
      className={cn('inline-flex items-center justify-center', className)}
      {...props}
    >
      <Loader2 className={cn('animate-spin', sizeClasses, colorClasses)} />
      <span className="sr-only">Chargement...</span>
    </div>
  );
}
