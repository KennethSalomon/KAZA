'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Grid3x3,
  Home,
  LayoutList,
  MapPin,
  Pencil,
  Plus,
  Search,
} from 'lucide-react';
import {
  listMyResidences,
  listMyLeases,
  listMyPayments,
} from '@/lib/supabase-api';
import type {
  LeaseWithRelations,
  PaymentWithRelations,
  ResidenceWithRelations,
} from '@/lib/types';
import { formatXof } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { apiToast } from '@/lib/api-toast';
import { cn } from '@/lib/cn';
import {
  HEALTH_META,
  computeResidenceHealth,
  type HealthStatus,
} from '@/components/property/property-health';

type ViewMode = 'grid' | 'list';
type PublicationFilter = 'all' | 'published' | 'draft' | 'pending';

// note : le modèle DB actuel = 1 residence = 1 unité. Le libellé « unités »
// prépare l'évolution vers un modèle immeuble > lots sans changement UI.
const UNIT_COUNT_PER_RESIDENCE = 1;

const FILTER_LABELS: Record<PublicationFilter, string> = {
  all: 'Tous',
  published: 'En ligne',
  draft: 'Brouillons',
  pending: 'En modération',
};

function matchesPublicationFilter(r: ResidenceWithRelations, f: PublicationFilter): boolean {
  if (f === 'all') return true;
  if (f === 'draft') return !r.is_published;
  if (f === 'published') return r.is_published && r.is_verified;
  return r.is_published && !r.is_verified;
}

export default function PropertiesPage() {
  const toast = useToast();
  const [residences, setResidences] = useState<ResidenceWithRelations[]>([]);
  const [leases, setLeases] = useState<LeaseWithRelations[]>([]);
  const [payments, setPayments] = useState<PaymentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [pubFilter, setPubFilter] = useState<PublicationFilter>('all');

  const load = useCallback(async () => {
    try {
      const [r, l, p] = await Promise.all([listMyResidences(), listMyLeases(), listMyPayments()]);
      setResidences(r);
      setLeases(l.filter((x) => x.status === 'active'));
      setPayments(p);
    } catch (err) {
      apiToast(toast, err, 'Chargement du parc impossible');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return residences.filter((r) => {
      if (!matchesPublicationFilter(r, pubFilter)) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        (r.city ?? '').toLowerCase().includes(q) ||
        (r.zone ?? '').toLowerCase().includes(q)
      );
    });
  }, [residences, search, pubFilter]);

  // ── Compteurs globaux
  const totalUnits = residences.length * UNIT_COUNT_PER_RESIDENCE;
  const occupiedUnits = residences.filter((r) => r.status === 'occupee').length;
  const globalOccupancy =
    residences.length === 0 ? 0 : Math.round((occupiedUnits / residences.length) * 100);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-52" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">
            Mon parc immobilier
          </h1>
          <p className="mt-1 text-sm text-kaza-muted">
            {residences.length} bien{residences.length > 1 ? 's' : ''} · {totalUnits} unité
            {totalUnits > 1 ? 's' : ''} · {globalOccupancy}% d’occupation
          </p>
        </div>
        <Link href="/landlord/residences/new">
          <Button>
            <Plus className="h-4 w-4" aria-hidden />
            Ajouter un bien
          </Button>
        </Link>
      </div>

      {/* Barre de recherche + toggle vue */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex-1 min-w-56">
          <span className="sr-only">Rechercher un bien</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-kaza-faint" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par titre, ville, quartier…"
            className="w-full rounded-kaza border border-kaza-border bg-white py-2.5 pl-9 pr-3 text-sm text-kaza-text placeholder:text-kaza-faint focus:border-kaza-brand focus:outline-none focus:ring-2 focus:ring-kaza-brand/20"
          />
        </label>

        <div className="flex rounded-kaza border border-kaza-border bg-white p-0.5" role="group" aria-label="Filtre de publication">
          {(Object.keys(FILTER_LABELS) as PublicationFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setPubFilter(f)}
              aria-pressed={pubFilter === f}
              className={cn(
                'rounded-kaza-sm px-3 py-1.5 text-xs font-medium transition-colors',
                pubFilter === f
                  ? 'bg-kaza-vert text-white shadow-sm'
                  : 'text-kaza-muted hover:text-kaza-text',
              )}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        <div className="flex rounded-kaza border border-kaza-border bg-white p-0.5" role="group" aria-label="Affichage">
          <button
            type="button"
            onClick={() => setView('grid')}
            aria-pressed={view === 'grid'}
            className={cn(
              'grid h-8 w-8 place-items-center rounded-kaza-sm transition-colors',
              view === 'grid' ? 'bg-kaza-vert text-white' : 'text-kaza-muted hover:text-kaza-text',
            )}
            title="Vue grille"
          >
            <Grid3x3 className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            aria-pressed={view === 'list'}
            className={cn(
              'grid h-8 w-8 place-items-center rounded-kaza-sm transition-colors',
              view === 'list' ? 'bg-kaza-vert text-white' : 'text-kaza-muted hover:text-kaza-text',
            )}
            title="Vue liste"
          >
            <LayoutList className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Contenu */}
      {filtered.length === 0 ? (
        <EmptyState
          title={residences.length === 0 ? 'Aucun bien enregistré' : 'Aucun bien pour ce filtre'}
          body={
            residences.length === 0
              ? 'Ajoutez votre premier logement : photos, prix, localisation.'
              : 'Ajustez la recherche ou le filtre de publication.'
          }
          action={
            residences.length === 0 ? (
              <Link href="/landlord/residences/new">
                <Button>
                  <Plus className="h-4 w-4" aria-hidden />
                  Ajouter un bien
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : view === 'grid' ? (
        <PropertyGrid items={filtered} leases={leases} payments={payments} />
      ) : (
        <PropertyList items={filtered} leases={leases} payments={payments} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────

interface ListProps {
  items: ResidenceWithRelations[];
  leases: LeaseWithRelations[];
  payments: PaymentWithRelations[];
}

function PropertyGrid({ items, leases, payments }: ListProps) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((r) => {
        const health = computeResidenceHealth(r.id, leases, payments);
        const cover = r.photos[0];
        return (
          <li key={r.id}>
            <article className="group flex h-full flex-col overflow-hidden rounded-kaza-lg border border-kaza-border bg-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
              <div className="relative h-40 w-full bg-kaza-raised">
                {cover ? (
                  <Image
                    src={cover}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-kaza-faint">
                    <Home className="h-8 w-8" aria-hidden />
                  </div>
                )}
                <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
                  <PublicationChip r={r} />
                  <HealthChip status={health.status} />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div>
                  <h2 className="line-clamp-1 font-display text-base font-semibold text-kaza-text">
                    {r.title}
                  </h2>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-kaza-muted">
                    <MapPin className="h-3 w-3" aria-hidden />
                    {[r.zone, r.city].filter(Boolean).join(', ') || '—'}
                  </p>
                </div>
                <PropertyMeta r={r} health={health} />
                <div className="mt-auto flex items-center gap-2 pt-2">
                  <Link href={`/landlord/residences/${r.id}`} className="flex-1">
                    <Button variant="secondary" size="sm" className="w-full">
                      Détails
                    </Button>
                  </Link>
                  <Link href={`/landlord/residences/${r.id}/edit`}>
                    <Button variant="ghost" size="sm" title="Modifier">
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                  </Link>
                </div>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

function PropertyList({ items, leases, payments }: ListProps) {
  return (
    <ul className="space-y-2">
      {items.map((r) => {
        const health = computeResidenceHealth(r.id, leases, payments);
        return (
          <li key={r.id}>
            <article className="flex flex-col gap-3 rounded-kaza border border-kaza-border bg-white p-4 sm:flex-row sm:items-center">
              <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-kaza-sm bg-kaza-raised">
                {r.photos[0] ? (
                  <Image src={r.photos[0]} alt="" fill sizes="96px" className="object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-kaza-faint">
                    <Home className="h-5 w-5" aria-hidden />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-display text-sm font-semibold text-kaza-text">
                    {r.title}
                  </h2>
                  <PublicationChip r={r} />
                  <HealthChip status={health.status} />
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-kaza-muted">
                  <MapPin className="h-3 w-3" aria-hidden />
                  {[r.zone, r.city].filter(Boolean).join(', ') || '—'}
                </p>
              </div>
              <PropertyMeta r={r} health={health} compact />
              <div className="flex items-center gap-2">
                <Link href={`/landlord/residences/${r.id}`}>
                  <Button variant="secondary" size="sm">
                    Détails
                  </Button>
                </Link>
                <Link href={`/landlord/residences/${r.id}/edit`}>
                  <Button variant="ghost" size="sm" title="Modifier">
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Button>
                </Link>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

// note : rend les 3 métriques principales (unités / occupation / loyer) —
// mode compact = version horizontale pour la vue liste.
function PropertyMeta({
  r,
  health,
  compact = false,
}: Readonly<{
  r: ResidenceWithRelations;
  health: ReturnType<typeof computeResidenceHealth>;
  compact?: boolean;
}>) {
  const totalRent = (r.price_monthly ?? 0) + (r.charges_monthly ?? 0);
  const occupancyLabel =
    health.status === 'libre' ? '0/1 loué' : `${health.activeLeases}/${UNIT_COUNT_PER_RESIDENCE} loué`;

  const cells = [
    { l: 'Unités', v: String(UNIT_COUNT_PER_RESIDENCE) },
    { l: 'Occupation', v: occupancyLabel },
    { l: 'Loyer TTC', v: `${formatXof(totalRent)}/mois` },
  ];

  if (compact) {
    return (
      <dl className="hidden shrink-0 gap-4 text-xs sm:flex">
        {cells.map((c) => (
          <div key={c.l}>
            <dt className="text-kaza-faint">{c.l}</dt>
            <dd className="font-medium text-kaza-text">{c.v}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl className="grid grid-cols-3 gap-2 rounded-kaza bg-kaza-raised/50 p-3 text-xs">
      {cells.map((c) => (
        <div key={c.l}>
          <dt className="text-kaza-faint">{c.l}</dt>
          <dd className="mt-0.5 font-medium text-kaza-text">{c.v}</dd>
        </div>
      ))}
    </dl>
  );
}

function PublicationChip({ r }: Readonly<{ r: ResidenceWithRelations }>) {
  if (r.is_published && r.is_verified) {
    return (
      <span className="rounded-full border border-kaza-mint/30 bg-kaza-mint/10 px-2 py-0.5 text-[11px] font-semibold text-kaza-mint">
        En ligne
      </span>
    );
  }
  if (r.is_published) {
    return (
      <span className="rounded-full border border-kaza-warning/30 bg-kaza-warning/10 px-2 py-0.5 text-[11px] font-semibold text-kaza-warning">
        En modération
      </span>
    );
  }
  return (
    <span className="rounded-full border border-kaza-border bg-white px-2 py-0.5 text-[11px] font-semibold text-kaza-muted">
      Brouillon
    </span>
  );
}

function HealthChip({ status }: Readonly<{ status: HealthStatus }>) {
  const m = HEALTH_META[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold', m.className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} aria-hidden />
      {m.label}
    </span>
  );
}
