'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { listMyFavorites, toggleFavorite, openConversation as openConv } from '@/lib/supabase-api';
import type { Residence } from '@/lib/types';
import { formatXof } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth-context';

export default function FavoritesPage() {
  const toast = useToast();
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<Residence[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactingId, setContactingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await listMyFavorites();
      setItems(list);
    } catch {
      toast.error('Chargement des favoris impossible');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRemoveFavorite = async (id: string) => {
    setItems((prev) => prev.filter((r) => r.id !== id));
    try {
      await toggleFavorite(id);
      toast.success('Logement retiré de vos favoris');
    } catch {
      void load();
      toast.error('Action impossible');
    }
  };

  const handleContact = async (residenceId: string) => {
    if (!user) {
      router.push('/login');
      return;
    }
    setContactingId(residenceId);
    try {
      const convId = await openConv(residenceId);
      router.push(`/chat/${convId}`);
    } catch {
      toast.error('Impossible d’ouvrir la conversation');
    } finally {
      setContactingId(null);
    }
  };

  return (
    <div className="bg-background text-on-background min-h-screen pb-[100px] flex flex-col font-body-md -mx-4 -my-8 sm:mx-0 sm:my-0">
      {/* TopAppBar */}
      <header className="w-full top-0 sticky z-40 bg-surface dark:bg-surface-dim shadow-sm">
        <div className="flex justify-between items-center px-margin-mobile md:px-margin-desktop py-base w-full max-w-7xl mx-auto">
          <Link
            href="/explorer"
            aria-label="Localisation"
            className="text-on-surface-variant dark:text-outline-variant hover:bg-surface-container-low dark:hover:bg-surface-container-highest transition-colors p-2 rounded-full active:scale-95 duration-100 flex items-center justify-center"
          >
            <span className="material-symbols-outlined">location_on</span>
          </Link>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary dark:text-primary-fixed-dim font-bold tracking-tight">
            Casa
          </h1>
          <button
            aria-label="Notifications"
            className="text-on-surface-variant dark:text-outline-variant hover:bg-surface-container-low dark:hover:bg-surface-container-highest transition-colors p-2 rounded-full active:scale-95 duration-100 flex items-center justify-center"
          >
            <span className="material-symbols-outlined">notifications</span>
          </button>
        </div>
      </header>

      {/* Page Header (Favoris specific) */}
      <section className="px-margin-mobile pt-stack-lg pb-stack-md max-w-7xl mx-auto w-full">
        <h2 className="font-title-lg text-title-lg text-on-surface mb-1">Mes Favoris</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {items.length} logement{items.length > 1 ? 's' : ''} sauvegardé{items.length > 1 ? 's' : ''}
        </p>
      </section>

      {/* Main Content: Saved Properties Grid */}
      <main className="flex-1 px-margin-mobile flex flex-col gap-stack-lg pb-stack-lg max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 bg-surface-container rounded-xl p-6">
            <span className="material-symbols-outlined text-4xl text-outline mb-2">favorite_border</span>
            <p className="font-title-lg text-title-lg text-on-surface">Aucun favori pour le moment</p>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1 mb-4">
              Enregistrez vos logements préférés pour les retrouver rapidement ici.
            </p>
            <Link
              href="/explorer"
              className="inline-flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg font-label-lg"
            >
              Explorer les logements
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-stack-lg">
            {items.map((residence) => (
              <article
                key={residence.id}
                className="bg-surface-container rounded-xl overflow-hidden shadow-[0px_1px_3px_rgba(0,0,0,0.08)] flex flex-col relative group hover:shadow-md transition-shadow duration-300"
              >
                {/* Trash Icon Overlay */}
                <button
                  onClick={() => void handleRemoveFavorite(residence.id)}
                  aria-label="Supprimer des favoris"
                  className="absolute top-3 right-3 z-10 w-10 h-10 bg-surface/90 backdrop-blur-sm rounded-full flex items-center justify-center text-error hover:bg-error-container transition-colors active:scale-95 shadow-sm"
                >
                  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                    delete
                  </span>
                </button>

                {/* Image */}
                <div className="w-full aspect-video md:aspect-[4/3] bg-surface-variant relative overflow-hidden">
                  <Link href={`/residences/${residence.id}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={residence.photos[0] || '/images/placeholder.jpg'}
                      alt={residence.title}
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                    />
                  </Link>

                  {/* Highlight Badge */}
                  {residence.is_verified && (
                    <div className="absolute top-3 left-3 bg-tertiary-container/90 backdrop-blur-md text-on-tertiary-container font-label-md text-label-md px-2 py-1 rounded-md flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">verified</span>
                      Vérifié
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-gutter flex flex-col gap-stack-md flex-1 justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <Link href={`/residences/${residence.id}`}>
                        <h3 className="font-label-lg text-label-lg text-on-surface mb-1 hover:text-primary transition-colors">
                          {residence.title}
                        </h3>
                      </Link>
                      <p className="font-body-md text-body-md text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">map</span>
                        {residence.zone || residence.city}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="block font-title-lg text-title-lg text-secondary-container font-semibold">
                        {formatXof(residence.price_monthly)}
                      </span>
                      <span className="font-label-md text-label-md text-on-surface-variant">/mois</span>
                    </div>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => void handleContact(residence.id)}
                    disabled={contactingId === residence.id}
                    className="w-full bg-primary text-on-primary font-label-lg text-label-lg py-3 rounded-lg mt-2 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 hover:bg-primary-container disabled:opacity-70"
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                      call
                    </span>
                    {contactingId === residence.id ? 'Connexion...' : 'Contacter'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Footer Note */}
        <div className="text-center py-stack-md mt-stack-md border-t border-surface-variant">
          <p className="font-body-md text-body-md text-outline">Ces logements restent enregistrés dans votre compte.</p>
        </div>
      </main>

      {/* BottomNavBar (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center pt-2 pb-safe px-gutter bg-surface-container dark:bg-surface-container-lowest shadow-[0px_-1px_3px_rgba(0,0,0,0.08)] rounded-t-xl">
        <Link
          href="/explorer"
          className="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant px-5 py-1 hover:bg-surface-variant dark:hover:bg-surface-container-highest active:scale-90 transition-transform duration-200 rounded-full"
        >
          <span className="material-symbols-outlined">home</span>
          <span className="font-label-md text-label-md mt-1">Accueil</span>
        </Link>
        <Link
          href="/explorer"
          className="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant px-5 py-1 hover:bg-surface-variant dark:hover:bg-surface-container-highest active:scale-90 transition-transform duration-200 rounded-full"
        >
          <span className="material-symbols-outlined">map</span>
          <span className="font-label-md text-label-md mt-1">Carte</span>
        </Link>
        <Link
          href="/favorites"
          className="flex flex-col items-center justify-center bg-secondary-container dark:bg-secondary-fixed-dim text-on-secondary-container dark:text-on-secondary-fixed-variant rounded-full px-5 py-1 active:scale-90 transition-transform duration-200"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            favorite
          </span>
          <span className="font-label-md text-label-md mt-1">Favoris</span>
        </Link>
        <Link
          href="/profile"
          className="flex flex-col items-center justify-center text-on-surface-variant dark:text-outline-variant px-5 py-1 hover:bg-surface-variant dark:hover:bg-surface-container-highest active:scale-90 transition-transform duration-200 rounded-full"
        >
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-md text-label-md mt-1">Profil</span>
        </Link>
      </nav>
    </div>
  );
}
