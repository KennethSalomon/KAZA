import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import type { Residence } from '@/lib/types';
import { cn } from '@/lib/cn';

export interface Completeness {
  done: number;
  total: number;
  percent: number;
  missing: string[];
}

/** Checklist de complétude d'une annonce — les 6 points qui accélèrent
 * l'approbation par l'équipe de modération. */
export function residenceCompleteness(r: Residence): Completeness {
  const missing: string[] = [];
  if (!r.title?.trim()) missing.push('Un titre explicite');
  if (!r.description?.trim()) missing.push('Une description');
  if (!r.photos || r.photos.length === 0) missing.push('Au moins une photo');
  if (!r.price_monthly || Number(r.price_monthly) <= 0) missing.push('Le loyer mensuel');
  if (!r.city || !r.zone) missing.push('La ville et le quartier');
  if (!r.address?.trim()) missing.push('Une adresse précise');
  const total = 6;
  const done = total - missing.length;
  return { done, total, percent: Math.round((done / total) * 100), missing };
}

const ITEM_LABELS = [
  'Un titre explicite',
  'Une description',
  'Au moins une photo',
  'Le loyer mensuel',
  'La ville et le quartier',
  'Une adresse précise',
];

/** Mini-barre de progression (cartes « Mes biens »). */
export function CompletenessBar({ c, compact = false }: Readonly<{ c: Completeness; compact?: boolean }>) {
  const complete = c.percent === 100;
  return (
    <div className="w-full" title={complete ? 'Annonce complète' : c.missing.join(' · ')}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-[10px] font-medium', complete ? 'text-kaza-success' : 'text-kaza-muted')}>
          {complete ? 'Annonce complète' : `${c.done}/${c.total} points`}
        </span>
        {!compact && <span className="text-[10px] tabular-nums text-kaza-faint">{c.percent}%</span>}
      </div>
      <div
        className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-kaza-raised"
        role="progressbar"
        aria-valuenow={c.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Complétude de l'annonce"
      >
        <div
          className={cn('h-full rounded-full transition-all duration-500', complete ? 'bg-kaza-success' : 'bg-kaza-brand')}
          style={{ width: `${c.percent}%` }}
        />
      </div>
    </div>
  );
}

/** Checklist détaillée (page d'édition). */
export function CompletenessChecklist({ c, loading }: Readonly<{ c: Completeness; loading?: boolean }>) {
  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-kaza-faint">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Vérification…
      </p>
    );
  }
  if (c.percent === 100) {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-kaza-success">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Annonce complète — elle peut être publiée dès maintenant.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {ITEM_LABELS.map((label) => {
        const ok = !c.missing.includes(label);
        return (
          <li key={label} className={cn('flex items-center gap-2 text-sm', ok ? 'text-kaza-muted' : 'text-kaza-text')}>
            {ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-kaza-success" aria-hidden />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-kaza-faint" aria-hidden />
            )}
            {label}
          </li>
        );
      })}
    </ul>
  );
}
