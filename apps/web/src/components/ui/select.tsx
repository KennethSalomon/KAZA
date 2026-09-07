import { forwardRef, useId } from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string | boolean;
  options?: ReadonlyArray<{ value: string; label: string }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, id, children, className = '', ...props }, ref) => {
    const autoId = useId();
    const selectId = id ?? autoId;
    const errorId = `${selectId}-error`;
    const errorMessage = typeof error === 'string' ? error : undefined;
    const hasError = Boolean(error);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="kaza-label">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          aria-invalid={hasError || undefined}
          aria-describedby={errorMessage ? errorId : undefined}
          className={`kaza-input appearance-none cursor-pointer ${hasError ? 'border-kaza-danger/60' : ''} ${className}`}
          {...props}
        >
          {options
            ? options.map((o) => (
                <option key={o.value} value={o.value} className="bg-kaza-surface text-kaza-text">
                  {o.label}
                </option>
              ))
            : children}
        </select>
        {errorMessage && (
          <p id={errorId} role="alert" className="mt-1 text-xs text-kaza-danger">
            {errorMessage}
          </p>
        )}
      </div>
    );
  },
);
Select.displayName = 'Select';