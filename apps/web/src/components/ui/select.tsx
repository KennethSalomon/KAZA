import { forwardRef, useId } from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, id, className = '', ...props }, ref) => {
    const autoId = useId();
    const selectId = id ?? autoId;
    const errorId = `${selectId}-error`;
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
          aria-invalid={!!error || undefined}
          aria-describedby={error ? errorId : undefined}
          className={`kaza-input appearance-none cursor-pointer ${error ? 'border-kaza-danger/60' : ''} ${className}`}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-kaza-surface text-kaza-text">
              {o.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-xs text-kaza-danger">
            {error}
          </p>
        )}
      </div>
    );
  },
);
Select.displayName = 'Select';