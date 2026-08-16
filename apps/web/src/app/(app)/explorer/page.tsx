'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { LocateFixed, Map as MapIcon, List, SlidersHorizontal, X } from 'lucide-react';
import { searchResidences } from '@/lib/supabase-api';
import type { Residence, ResidenceType } from '@/lib/types';
import { TYPE_LABELS } from '@/lib/format';
import { PropertyCard } from '@/components/property/property-card';
import { PropertyCardSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';

const ResidenceMap = dynamic(
  () => import('@/components/property/residence-map').then((m) => m.ResidenceMap),
  { ssr: false, loading: () => null },
);

type Center = { lat: number; lng: number };

type SortKey = 'recent' | 'price_asc' | 'price_desc';

interface Filters {
  q: string;
  city: string;
  zone: string;
  min_price: string;
  max_price: string;
}

const initialFilters: Filters = { q: '', city: '', zone: '', min_price: '', max_price: '' };

const ALL_TYPES = Object.keys(TYPE_LABELS) as ResidenceType[];

export default function ExplorerPage() {
  const [residences, setResidences] = useState<Residence[]>([]);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [selectedTypes, setSelectedTypes] = useState<Set<ResidenceType>>(new Set());
  const [sort, setSort] = useState<SortKey>('recent');
  const [center, setCenter] = useState<Center | undefined>(undefined);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const debounceRef = useRef<number | null>(null);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Mobile map toggle - on mobile, map replaces list when toggled
  const toggleMap = () => setShowMap((prev) => !prev);

  const runSearch = useCallback(
    (f: Filters) => {
      startTransition(async () => {
        setLoading(true);
        try {
          const results = await searchResidences({
            q: f.q || undefined,
            city: f.city || undefined,
            zone: f.zone || undefined,
            // note : le tri multi-type et la fourchette basse sont appliqués
            // côté client (pipeline below) — le serveur limite déjà la
            // fourchette haute pour réduire le volume transféré.
            max_price: f.max_price ? Number(f.max_price) : undefined,
            lat: geo?.lat,
            lng: geo?.lng,
            radius_km: geo ? 25 : undefined,
          });
          setResidences(results);
        } catch {
          toast.error('Recherche impossible', 'Réessayez dans un instant.');
        } finally {
          setLoading(false);
        }
      });
    },
    [geo, toast],
  );

  // recherche au montage (immédiate) puis debounce sur chaque changement de filtres.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      runSearch(initialFilters);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => runSearch(filters), 450);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [filters, runSearch]);

  // ------------------------------------------------------------
  // Pipeline client : fourchette basse, types multi-sélection, tri.
  // ------------------------------------------------------------
  const visible = useMemo(() => {
    let list = residences;
    if (selectedTypes.size > 0) list = list.filter((r) => selectedTypes.has(r.type));
    const min = filters.min_price ? Number(filters.min_price) : 0;
    if (min > 0) list = list.filter((r) => Number(r.price_monthly) >= min);
    if (sort === 'price_asc') {
      list = [...list].sort((a, b) => Number(a.price_monthly) - Number(b.price_monthly));
    } else if (sort === 'price_desc') {
      list = [...list].sort((a, b) => Number(b.price_monthly) - Number(a.price_monthly));
    }
    return list;
  }, [residences, selectedTypes, filters.min_price, sort]);

  // Chips villes / quartiers dérivées des résultats (les plus fréquentes d'abord).
  const { cityChips, zoneChips } = useMemo(() => {
    const cityCounts = new Map<string, number>();
    const zoneCounts = new Map<string, number>();
    for (const r of residences) {
      cityCounts.set(r.city, (cityCounts.get(r.city) ?? 0) + 1);
      if (r.zone) zoneCounts.set(r.zone, (zoneCounts.get(r.zone) ?? 0) + 1);
    }
    const byFreq = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
    return { cityChips: byFreq(cityCounts), zoneChips: byFreq(zoneCounts) };
  }, [residences]);

  const hasActiveFilters =
    Boolean(filters.q) ||
    Boolean(filters.city) ||
    Boolean(filters.zone) ||
    Boolean(filters.min_price) ||
    Boolean(filters.max_price) ||
    selectedTypes.size > 0;

  const clearAll = () => {
    setFilters(initialFilters);
    setSelectedTypes(new Set());
    setSort('recent');
  };

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      toast.info('Géolocalisation indisponible', 'Activez la localisation dans votre navigateur.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGeo(p);
        setCenter(p);
        setView('map');
      },
      () => toast.info('Position introuvable', 'Par défaut, recherche autour de Cotonou.'),
    );
  }

  const setFilter = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters((f) => ({ ...f, [key]: e.target.value }));
  };

  function toggleChip(kind: 'city' | 'zone', value: string) {
    setFilters((f) => ({ ...f, [kind === 'city' ? 'city' : 'zone']: f[kind === 'city' ? 'city' : 'zone'] === value ? '' : value }));
  }

  function toggleType(t: ResidenceType) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  return (
    <div>
      {/* Bandeau de recherche */}
      <section className="relative overflow-hidden rounded-kaza-lg border border-kaza-border bg-kaza-surface p-5 sm:p-7">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(600px 260px at 12% 0%, rgba(212,175,55,0.10), transparent 55%), radial-gradient(500px 300px at 100% 100%, rgba(30,41,59,0.7), transparent 60%)',
          }}
        />
        <div className="relative">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Trouvez votre prochain logement <span className="text-kaza-brand">au Bénin</span>
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-kaza-muted">
            Recherche géolocalisée parmi les biens libres, vérifiés par nos équipes.
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Input
                aria-label="Rechercher un quartier, une ville…"
                placeholder="Quartier, ville ou adresse… (ex: Haie Vive)"
                value={filters.q}
                onChange={setFilter('q')}
                className="pr-10"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={useMyLocation} data-testid="locate">
                <LocateFixed className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Près de moi</span>
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowFilters((s) => !s)}
                aria-expanded={showFilters}
                aria-label="Filtres de prix"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden />
                Budget
              </Button>
            </div>
          </div>

          {/* Fourchette de prix */}
          {showFilters && (
            <div className="mt-4 grid gap-3 rounded-kaza border border-kaza-border bg-kaza-bg/60 p-4 sm:grid-cols-2">
              <Input
                label="Budget min (FCFA/mois)"
                type="number"
                min={0}
                placeholder="30 000"
                value={filters.min_price}
                onChange={setFilter('min_price')}
              />
              <Input
                label="Budget max (FCFA/mois)"
                type="number"
                min={0}
                placeholder="150 000"
                value={filters.max_price}
                onChange={setFilter('max_price')}
              />
            </div>
          )}

          {/* Types de bien (multi-sélection) */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-kaza-muted">Type :</span>
            {ALL_TYPES.map((t) => {
              const active = selectedTypes.has(t);
              return (
                <button
                  key={t}
                  aria-pressed={active}
                  onClick={() => toggleType(t)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'border-kaza-brand bg-kaza-brand text-white'
                      : 'border-kaza-border bg-kaza-surface text-kaza-muted hover:border-kaza-faint hover:text-kaza-text',
                  )}
                >
                  {TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Chips villes / quartiers + tri + vue */}
      <div className="mt-5 flex flex-col gap-3">
        {(cityChips.length > 1 || zoneChips.length > 1 || hasActiveFilters) && (
          <div className="flex flex-wrap items-center gap-2">
            {cityChips.length > 1 && (
              <>
                <span className="text-xs font-medium text-kaza-muted">Ville :</span>
                {cityChips.map((c) => (
                  <button
                    key={c}
                    aria-pressed={filters.city === c}
                    onClick={() => toggleChip('city', c)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      filters.city === c
                        ? 'border-kaza-brand bg-kaza-brand text-white'
                        : 'border-kaza-border bg-kaza-surface text-kaza-muted hover:border-kaza-faint hover:text-kaza-text',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </>
            )}
            {zoneChips.length > 1 && (
              <>
                <span className="text-xs font-medium text-kaza-muted">Quartier :</span>
                {zoneChips.map((z) => (
                  <button
                    key={z}
                    aria-pressed={filters.zone === z}
                    onClick={() => toggleChip('zone', z)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      filters.zone === z
                        ? 'border-kaza-brand bg-kaza-brand text-white'
                        : 'border-kaza-border bg-kaza-surface text-kaza-muted hover:border-kaza-faint hover:text-kaza-text',
                    )}
                  >
                    {z}
                  </button>
                ))}
              </>
            )}
            {hasActiveFilters && (
              <button
                onClick={clearAll}
                className="ml-1 inline-flex items-center gap-1 text-xs font-medium text-kaza-faint transition-colors hover:text-kaza-danger"
              >
                <X className="h-3 w-3" aria-hidden />
                Tout effacer
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-kaza-muted" aria-live="polite">
            {isPending || loading ? (
              'Recherche en cours…'
            ) : (
              <>
                <strong className="price text-kaza-text">{visible.length}</strong> bien{visible.length > 1 ? 's' : ''} affiché
                {visible.length > 1 ? 's' : ''}
                {visible.length !== residences.length && (
                  <span className="text-kaza-faint"> (sur {residences.length})</span>
                )}
              </>
            )}
          </p>

          <div className="flex items-center gap-2">
            <Select
              aria-label="Trier les résultats"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              options={[
                { value: 'recent', label: 'Plus récents' },
                { value: 'price_asc', label: 'Prix croissant' },
                { value: 'price_desc', label: 'Prix décroissant' },
              ]}
              className="h-9 w-44 !py-1.5 text-xs"
            />
            <div role="tablist" aria-label="Vue" className="flex rounded-kaza border border-kaza-border bg-kaza-surface p-1">
              <button
                role="tab"
                aria-selected={view === 'list'}
                onClick={() => setView('list')}
                className={cn(
                  'flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-xs font-medium transition-colors',
                  view === 'list' ? 'bg-kaza-brand text-kaza-bg' : 'text-kaza-muted hover:text-kaza-text',
                )}
              >
                <List className="h-3.5 w-3.5" aria-hidden /> Liste
              </button>
              <button
                role="tab"
                aria-selected={view === 'map'}
                onClick={() => setView('map')}
                className={cn(
                  'flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-xs font-medium transition-colors',
                  view === 'map' ? 'bg-kaza-brand text-kaza-bg' : 'text-kaza-muted hover:text-kaza-text',
                )}
              >
                <MapIcon className="h-3.5 w-3.5" aria-hidden /> Carte
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Résultats : grille + carte */}
      <div className="mt-4">
        {/* Mobile: toggle between list and map */}
        <div className="lg:hidden">
          <div role="tablist" aria-label="Vue" className="flex rounded-kaza border border-kaza-border bg-kaza-surface p-1 mb-4">
            <button
              role="tab"
              aria-selected={!showMap}
              onClick={() => setShowMap(false)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-[9px] px-3 py-1.5 text-xs font-medium transition-colors',
                !showMap ? 'bg-kaza-brand text-kaza-bg' : 'text-kaza-muted hover:text-kaza-text',
              )}
            >
              <List className="h-3.5 w-3.5" aria-hidden /> Liste
            </button>
            <button
              role="tab"
              aria-selected={showMap}
              onClick={() => setShowMap(true)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-[9px] px-3 py-1.5 text-xs font-medium transition-colors',
                showMap ? 'bg-kaza-brand text-kaza-bg' : 'text-kaza-muted hover:text-kaza-text',
              )}
            >
              <MapIcon className="h-3.5 w-3.5" aria-hidden /> Carte
            </button>
          </div>
        </div>

        {(!showMap || !isMobile) && (
          <div className={cn(
            'grid grid-cols-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-3',
            (view === 'map' || showMap) && 'lg:max-h-[72vh] lg:overflow-y-auto lg:pr-2',
            isMobile && showMap && 'hidden',
          )}
          aria-busy={loading}
        >
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <PropertyCardSkeleton key={i} />)
            : visible.map((r, i) => (
                <div key={r.id} onMouseEnter={() => setActiveId(r.id)} onMouseLeave={() => setActiveId(null)}>
                  <PropertyCard residence={r} index={i} active={activeId === r.id} />
                </div>
              ))}
          {!loading && visible.length === 0 && (
            <div className="sm:col-span-2 xl:col-span-3">
              <EmptyState
                title={residences.length === 0 ? 'Aucun logement ne correspond' : 'Aucun résultat avec ces filtres'}
                body={
                  residences.length === 0
                    ? 'Élargissez votre recherche ou désactivez certains filtres. Les biens en visite et occupés ne sont pas affichés.'
                    : 'Réduisez les critères (type, budget) pour retrouver des biens.'
                }
                action={
                  hasActiveFilters ? (
                    <button onClick={clearAll} className="text-sm font-medium text-kaza-brand hover:opacity-80">
                      Réinitialiser les filtres
                    </button>
                  ) : undefined
                }
              />
            </div>
          )}
        </div>
        )}

        {(view === 'map' || showMap) && (
          <div className={cn(
            'overflow-hidden rounded-kaza-lg border border-kaza-border shadow-card',
            'h-[52vh] lg:h-[72vh] lg:sticky lg:top-24',
            isMobile && !showMap && 'hidden lg:block',
            isMobile && showMap && 'block',
          )}
            data-testid="map"
          >
            <ResidenceMap residences={visible} center={center} activeId={activeId} onSelect={(r) => setActiveId(r.id)} />
          </div>
        )}
      </div>
    </div>
  );
}
