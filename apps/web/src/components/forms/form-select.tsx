import { forwardRef, type SelectHTMLAttributes } from 'react';
import { FormField } from './form-field';
import { Select } from '@/components/ui/select';

export interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string | null;
  helperText?: string;
  options?: ReadonlyArray<{ value: string; label: string }>;
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, error, helperText, required, id, options = [], className, ...props }, ref) => {
    const fieldId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <FormField
        label={label}
        error={error}
        helperText={helperText}
        required={required}
        htmlFor={fieldId}
      >
        <Select
          ref={ref}
          id={fieldId}
          error={error ?? undefined}
          options={[...options]}
          className={className}
          aria-invalid={Boolean(error)}
          {...props}
        />
      </FormField>
    );
  },
);

FormSelect.displayName = 'FormSelect';