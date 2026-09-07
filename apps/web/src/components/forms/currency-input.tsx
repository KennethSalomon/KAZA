import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';
import { FormField } from './form-field';

export interface CurrencyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string | null;
  helperText?: string;
  currencySymbol?: string;
}

// note : Saisie financière monétaire spécialisée en Franc CFA (FCFA)
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      label,
      error,
      helperText,
      required,
      id,
      className,
      currencySymbol = 'FCFA',
      ...props
    },
    ref,
  ) => {
    const fieldId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <FormField
        label={label}
        error={error}
        helperText={helperText}
        required={required}
        htmlFor={fieldId}
      >
        <div className="relative flex items-center">
          <input
            ref={ref}
            id={fieldId}
            type="number"
            min="0"
            step="1000"
            className={cn(
              'w-full rounded-kaza bg-white border border-kaza-border pl-4 pr-16 py-2.5 text-sm text-kaza-text tabular-nums placeholder:text-kaza-faint transition-colors duration-150',
              'focus:border-kaza-vert focus:brand-ring outline-none',
              error && 'border-kaza-red focus:border-kaza-red focus:ring-kaza-red/20',
              className,
            )}
            aria-invalid={Boolean(error)}
            {...props}
          />
          <span className="pointer-events-none absolute right-3 rounded bg-kaza-raised px-2 py-0.5 text-xs font-semibold text-kaza-muted">
            {currencySymbol}
          </span>
        </div>
      </FormField>
    );
  },
);

CurrencyInput.displayName = 'CurrencyInput';
