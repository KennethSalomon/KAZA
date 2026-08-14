import { SearchX } from 'lucide-react';

export function EmptyState({
  title,
  body,
  action,
}: Readonly<{ title: string; body?: string; action?: React.ReactNode }>) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-kaza-lg border border-dashed border-kaza-border bg-kaza-surface/50 px-6 py-14 text-center">
      <span className="rounded-full bg-kaza-bg p-3 text-kaza-brand">
        <SearchX className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="mt-2 font-display text-base font-semibold text-kaza-text">{title}</h3>
      {body && <p className="max-w-sm text-sm text-kaza-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}