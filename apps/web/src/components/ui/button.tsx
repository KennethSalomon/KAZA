'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-kaza font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-kaza-brand focus-visible:outline-offset-2',
  {
    variants: {
      variant: {
        primary: 'bg-kaza-brand text-white hover:bg-kaza-brand-dark shadow-[0_8px_24px_-8px_rgba(14,71,40,0.45)]',
        secondary: 'bg-white text-kaza-brand border border-kaza-brand hover:bg-kaza-raised',
        ghost: 'text-kaza-muted hover:text-kaza-brand hover:bg-kaza-surface',
        danger: 'bg-kaza-danger/10 text-kaza-danger border border-kaza-danger/30 hover:bg-kaza-danger/20',
        success: 'bg-kaza-success/10 text-kaza-success border border-kaza-success/30 hover:bg-kaza-success/20',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-sm',
        icon: 'h-10 w-10',
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
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={buttonVariants({ variant, size, className })}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';