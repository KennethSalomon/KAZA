import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface Step {
  key: string;
  label: string;
}

export interface StepperProps {
  steps: readonly Step[];
  current: number;
}

export function Stepper({ steps, current }: StepperProps) {
  return (
    <ol
      role="list"
      aria-label="Étapes de l'inscription"
      className="flex items-center justify-between gap-2"
    >
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors',
                  done && 'bg-kaza-vert text-white',
                  active && 'border-2 border-kaza-vert bg-kaza-vert/10 text-kaza-vert',
                  !done && !active && 'border border-kaza-border bg-kaza-surface text-kaza-faint',
                )}
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  'hidden text-xs font-medium sm:inline',
                  active ? 'text-kaza-text' : 'text-kaza-muted',
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'h-px flex-1 transition-colors',
                  done ? 'bg-kaza-vert' : 'bg-kaza-border',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
