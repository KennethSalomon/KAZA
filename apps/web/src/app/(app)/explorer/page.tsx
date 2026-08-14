'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { LocateFixed, Map as MapIcon, List, SlidersHorizontal } from 'lucide-react';
import { searchResidences } from '@/lib/supabase-api';
import type { Residence } from '@/lib/types';
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

const DEFAULT_CENTER = { lat: 6.3703, lng: 2.3912 };

interface Filters {
  q: string;
  city: string;
  zone: string;
  type: string;
  max_price: string;
}

const initialFilters: Filters = { q: '', city: '', zone: '', type: '', max_price: '' };

export default function ExplorerPage() {
  const [residences, setResidences] = useState<Residence[]>([]);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [center, setCenter] = useState<typeof DEFAULT_CENTER | undefined>(undefined);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const debounceRef = useRef<number | null>(null);

  const runSearch = useCallback(
    (f: Filters) => {
      startTransition(async () => {
        setLoading(true);
        try {
          const results = await searchResidences({
            q: f.q || undefined,
            city: f.city || undefined,
            zone: f.zone || undefined,
            type: f.type || undefined,
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
  // Un seul effet : évite le double fetch du premier rendu.
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
            {residences.length > 0
              ? `${residences.length} bien${residences.length > 1 ? 's' : ''} disposibl${residences.length > 1 ? 'es' : 'e'} à la location.`
              : 'Recherche géolocalisée parmi les biens libres, vérifiés par nos équipes.'}
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
                aria-label="Filtres"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden />
                Filtres
              </Button>
            </div>
          </div>

          {/* Filtres avancés */}
          {showFilters && (
            <div className="mt-4 grid gap-3 rounded-kaza border border-kaza-border bg-kaza-bg/60 p-4 sm:grid-cols-4">
              <Select
                label="Type de bien"
                value={filters.type}
                onChange={setFilter('type')}
                options={[
                  { value: '', label: 'Tous les types' },
                  ...Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l })),
                ]}
              />
              <Input label="Ville" placeholder="Cotonou, Porto-Novo…" value={filters.city} onChange={setFilter('city')} />
              <Input label="Quartier / zone" placeholder="Haie Vive, Fidjrossè…" value={filters.zone} onChange={setFilter('zone')} />
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
        </div>
      </section>

      {/* Bascule liste / carte */}
      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-kaza-muted">
          {isPending || loading ? 'Recherche en cours…' : `${residences.length} résultat${residences.length > 1 ? 's' : ''}`}
        </p>
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

      {/* Résultats : grille + carte */}
      <div className={cn('mt-4 gap-4', view === 'map' && 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]')}>
        <div
          className={cn(
            'grid grid-cols-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-3',
            view === 'map' && 'lg:max-h-[72vh] lg:overflow-y-auto lg:pr-2',
          )}
          aria-busy={loading}
        >
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <PropertyCardSkeleton key={i} />)
            : residences.map((r, i) => (
                <div key={r.id} onMouseEnter={() => setActiveId(r.id)} onMouseLeave={() => setActiveId(null)}>
                  <PropertyCard residence={r} index={i} active={activeId === r.id} />
                </div>
              ))}
          {!loading && residences.length === 0 && (
            <div className="sm:col-span-2 xl:col-span-3">
              <EmptyState
                title="Aucun logement ne correspond"
                body="Élargissez votre recherche ou désactivez certains filtres. Les biens en visite et occupés ne sont pas affichés."
              />
            </div>
          )}
        </div>

        {view === 'map' && (
          <div className="h-[52vh] overflow-hidden rounded-kaza-lg border border-kaza-border shadow-card lg:sticky lg:top-24 lg:h-[72vh]"
            data-testid="map"
          >
            <ResidenceMap residences={residences} center={center} activeId={activeId} onSelect={(r) => setActiveId(r.id)} />
          </div>
        )}
      </div>
    </div>
  );
}