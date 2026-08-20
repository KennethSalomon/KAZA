import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';
import { FormField } from './form-field';

export interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string | null;
  helperText?: string;
}

// note : Zone de texte multi-lignes stylisée KAZA
export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, helperText, required, id, className, rows = 4, ...props }, ref) => {
    const fieldId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <FormField
        label={label}
        error={error}
        helperText={helperText}
        required={required}
        htmlFor={fieldId}
      >
        <textarea
          ref={ref}
          id={fieldId}
          rows={rows}
          className={cn(
            'w-full rounded-kaza bg-white border border-kaza-border px-3.5 py-2.5 text-sm text-kaza-text placeholder:text-kaza-faint transition-colors duration-150',
            'focus:border-kaza-vert focus:brand-ring outline-none resize-y',
            error && 'border-kaza-red focus:border-kaza-red focus:ring-kaza-red/20',
            className,
          )}
          aria-invalid={Boolean(error)}
          {...props}
        />
      </FormField>
    );
  },
);

FormTextarea.displayName = 'FormTextarea';
