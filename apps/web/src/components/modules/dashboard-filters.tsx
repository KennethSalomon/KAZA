'use client';

import type { ResidenceWithRelations } from '@/lib/types';
import { cn } from '@/lib/utils/cn';

export type PeriodKey = 'month' | 'quarter' | 'year' | 'all';

interface DashboardFiltersProps {
  period: PeriodKey;
  onPeriodChange: (p: PeriodKey) => void;
  residenceId: string | 'all';
  onResidenceChange: (id: string | 'all') => void;
  residences: ResidenceWithRelations[];
}

const PERIOD_LABELS: { id: PeriodKey; label: string }[] = [
  { id: 'month', label: 'Mois' },
  { id: 'quarter', label: 'Trimestre' },
  { id: 'year', label: 'Année' },
  { id: 'all', label: 'Tout' },
];

// note : `startForPeriod` renvoie la borne basse (incluse) pour filtrer les
// paiements et baux. `all` renvoie une date lointaine dans le passé.
export function startForPeriod(period: PeriodKey): Date {
  const now = new Date();
  switch (period) {
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3) * 3;
      return new Date(now.getFullYear(), q, 1);
    }
    case 'year':
      return new Date(now.getFullYear(), 0, 1);
    case 'all':
    default:
      return new Date(1970, 0, 1);
  }
}

export function DashboardFilters({
  period,
  onPeriodChange,
  residenceId,
  onResidenceChange,
  residences,
}: DashboardFiltersProps) {
  return (
    <div
      role="toolbar"
      aria-label="Filtres du tableau de bord"
      className="flex flex-wrap items-center gap-3"
    >
      <div className="flex rounded-kaza bg-kaza-raised p-0.5">
        {PERIOD_LABELS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPeriodChange(p.id)}
            aria-pressed={period === p.id}
            className={cn(
              'rounded-kaza-sm px-3 py-1.5 text-xs font-medium transition-colors',
              period === p.id
                ? 'bg-kaza-vert text-white shadow-sm'
                : 'text-kaza-muted hover:text-kaza-text',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {residences.length > 1 && (
        <label className="flex items-center gap-2 text-xs">
          <span className="text-kaza-muted">Bien :</span>
          <select
            value={residenceId}
            onChange={(e) => onResidenceChange(e.target.value)}
            className="rounded-kaza border border-kaza-border bg-kaza-surface px-3 py-1.5 text-xs font-medium text-kaza-text focus:border-kaza-vert focus:outline-none"
            aria-label="Filtrer par bien"
          >
            <option value="all">Tous les biens ({residences.length})</option>
            {residences.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
