import { forwardRef, type SelectHTMLAttributes } from 'react';
import { FormField } from './form-field';
import { Select } from '@/components/ui/select';

export interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string | null;
  helperText?: string;
  options?: ReadonlyArray<{ value: string; label: string }>;
}

// note : Composant Select intégré pour formulaires KAZA
export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, error, helperText, required, id, options, children, className, ...props }, ref) => {
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
          error={Boolean(error)}
          className={className}
          aria-invalid={Boolean(error)}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </Select>
      </FormField>
    );
  },
);

FormSelect.displayName = 'FormSelect';
