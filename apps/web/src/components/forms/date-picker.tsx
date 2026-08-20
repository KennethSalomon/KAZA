import { forwardRef, type InputHTMLAttributes } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { FormField } from './form-field';

export interface DatePickerProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string | null;
  helperText?: string;
}

// note : Sélecteur de date avec icône de calendrier KAZA
export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ label, error, helperText, required, id, className, ...props }, ref) => {
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
            type="date"
            className={cn(
              'w-full rounded-kaza bg-white border border-kaza-border pl-4 pr-10 py-2.5 text-sm text-kaza-text transition-colors duration-150',
              'focus:border-kaza-vert focus:brand-ring outline-none',
              error && 'border-kaza-red focus:border-kaza-red focus:ring-kaza-red/20',
              className,
            )}
            aria-invalid={Boolean(error)}
            {...props}
          />
          <Calendar
            className="pointer-events-none absolute right-3.5 h-4 w-4 text-kaza-muted"
            aria-hidden="true"
          />
        </div>
      </FormField>
    );
  },
);

DatePicker.displayName = 'DatePicker';
