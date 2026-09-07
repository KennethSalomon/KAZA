import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface FormFieldProps {
  label?: string;
  error?: string | null;
  helperText?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

// note : Enveloppe de champ de formulaire standardisée KAZA
export function FormField({
  label,
  error,
  helperText,
  required = false,
  htmlFor,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('flex flex-col space-y-1.5', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-xs font-semibold uppercase tracking-wider text-kaza-muted"
        >
          {label}
          {required && <span className="ml-1 text-kaza-red">*</span>}
        </label>
      )}

      {children}

      {error ? (
        <p className="text-xs font-medium text-kaza-red animate-fade-in" role="alert">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-xs text-kaza-faint">{helperText}</p>
      ) : null}
    </div>
  );
}
