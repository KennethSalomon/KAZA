'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

// note : variantes — primary (vert marque), secondary (outline vert), cta (pêche marketing), ghost, danger, success
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-kaza font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-kaza-brand focus-visible:outline-offset-2',
  {
    variants: {
      variant: {
        primary:
          'bg-kaza-vert text-white hover:bg-kaza-brand-dark shadow-[0_8px_24px_-8px_rgba(14,71,40,0.45)]',
        secondary:
          'bg-white text-kaza-vert border border-kaza-vert hover:bg-kaza-raised shadow-sm',
        cta:
          'bg-kaza-peche text-kaza-vert font-semibold hover:bg-kaza-peach-dark hover:text-white shadow-[0_8px_24px_-8px_rgba(242,176,145,0.6)]',
        ghost: 'text-kaza-muted hover:text-kaza-vert hover:bg-kaza-surface',
        danger:
          'bg-kaza-red/10 text-kaza-red border border-kaza-red/30 hover:bg-kaza-red/20',
        success:
          'bg-kaza-mint/10 text-kaza-mint border border-kaza-mint/30 hover:bg-kaza-mint/20',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';