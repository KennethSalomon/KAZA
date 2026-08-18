import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  togglePassword?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = '', togglePassword, type, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const [visible, setVisible] = useState(false);
    const isPasswordToggle = togglePassword && type === 'password';
    const inputType = isPasswordToggle ? (visible ? 'text' : 'password') : type;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="kaza-label">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || hint ? `${inputId}-hint` : undefined}
            className={`kaza-input ${isPasswordToggle ? 'pr-10' : ''} ${error ? 'border-kaza-danger/60' : ''} ${className}`}
            {...props}
          />
          {isPasswordToggle && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setVisible((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-kaza-muted transition-colors hover:text-kaza-text"
              aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        {error ? (
          <p id={`${inputId}-hint`} role="alert" className="mt-1.5 text-xs text-kaza-danger">
            {error}
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