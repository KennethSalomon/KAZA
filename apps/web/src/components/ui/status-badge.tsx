import type { ResidenceStatus } from '@/lib/types';

const STYLES: Record<ResidenceStatus, string> = {
  libre: 'bg-kaza-success/10 text-kaza-success border-kaza-success/30',
  occupee: 'bg-kaza-danger/10 text-kaza-danger border-kaza-danger/30',
  en_visite: 'bg-kaza-warning/10 text-kaza-warning border-kaza-warning/30',
  maintenance: 'bg-kaza-neutral/15 text-kaza-muted border-kaza-faint/40',
};

const DOT: Record<ResidenceStatus, string> = {
  libre: 'bg-kaza-success',
  occupee: 'bg-kaza-danger',
  en_visite: 'bg-kaza-warning',
  maintenance: 'bg-kaza-neutral',
};

const LABELS: Record<ResidenceStatus, string> = {
  libre: 'Libre',
  occupee: 'Occupée',
  en_visite: 'En visite',
  maintenance: 'Maintenance',
};

export function StatusBadge({ status, className = '' }: { status: ResidenceStatus; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${STYLES[status]} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]} animate-pulse`} aria-hidden />
      {LABELS[status]}
    </span>
  );
}