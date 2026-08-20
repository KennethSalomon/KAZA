import { forwardRef, useId } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | boolean;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = '', ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const errorMessage = typeof error === 'string' ? error : undefined;
    const hasError = Boolean(error);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="kaza-label">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={errorMessage || hint ? `${inputId}-hint` : undefined}
          className={`kaza-input ${hasError ? 'border-kaza-danger/60' : ''} ${className}`}
          {...props}
        />
        {errorMessage ? (
          <p id={`${inputId}-hint`} role="alert" className="mt-1.5 text-xs text-kaza-danger">
            {errorMessage}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-kaza-faint">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = 'Input';