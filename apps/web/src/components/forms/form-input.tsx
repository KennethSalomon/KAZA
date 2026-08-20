import { forwardRef, type InputHTMLAttributes } from 'react';
import { FormField } from './form-field';
import { Input } from '@/components/ui/input';

export interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  helperText?: string;
}

// note : Composant Input prêt à l'emploi avec label et gestion d'erreurs
export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
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
        <Input
          ref={ref}
          id={fieldId}
          error={Boolean(error)}
          className={className}
          aria-invalid={Boolean(error)}
          {...props}
        />
      </FormField>
    );
  },
);

FormInput.displayName = 'FormInput';
