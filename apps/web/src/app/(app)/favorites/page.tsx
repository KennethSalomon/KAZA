'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Heart, Search } from 'lucide-react';
import { listMyFavorites, ApiError } from '@/lib/supabase-api';
import type { Residence } from '@/lib/types';
import { PropertyCard } from '@/components/property/property-card';
import { PropertyCardSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

export default function FavoritesPage() {
  const toast = useToast();
  const [items, setItems] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const list = await listMyFavorites();
      setItems(list);
    } catch (err) {
      toast.error('Chargement des favoris impossible', err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const favoriteIds = useMemo(() => new Set(items.map((r) => r.id)), [items]);

  function handleToggle(id: string, now: boolean) {
    if (!now) setItems((prev) => prev.filter((r) => r.id !== id));
    else void load();
  }

  return (
    <div>
      <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight text-kaza-text">
        <Heart className="h-6 w-6 text-kaza-brand" aria-hidden />
        Mes favoris
      </h1>
      <p className="mt-1 text-sm text-kaza-muted">
        {items.length > 0
          ? `${items.length} bien${items.length > 1 ? 's' : ''} enregistré${items.length > 1 ? 's' : ''} pour plus tard.`
          : 'Les logements que vous gardez en vue apparaissent ici.'}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <PropertyCardSkeleton key={i} />)
          : items.map((r, i) => (
              <PropertyCard
                key={r.id}
                residence={r}
                index={i}
                favoriteInitial={favoriteIds.has(r.id)}
                onToggleFavorite={handleToggle}
              />
            ))}
      </div>

      {!loading && items.length === 0 && (
        <div className="mt-4">
          <EmptyState
            title="Aucun favori pour le moment"
            body="Touchez le cœur sur un logement pour le retrouver ici, même plus tard."
            action={
              <Link href="/explorer">
                <Button variant="secondary">
                  <Search className="h-4 w-4" aria-hidden />
                  Explorer les biens
                </Button>
              </Link>
            }
          />
        </div>
      )}
    </div>
  );
}
