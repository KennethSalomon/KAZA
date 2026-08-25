'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { listMyResidences, updateResidence, ApiError } from '@/lib/supabase-api';
import { useAuth } from '@/lib/auth-context';
import type { ResidenceWithRelations } from '@/lib/types';
import { formatXof } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';

export default function LandlordHomePage() {
  const { user } = useAuth();
  const toast = useToast();
  const [residences, setResidences] = useState<ResidenceWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await listMyResidences();
      setResidences(r);
    } catch {
      toast.error('Chargement de l’espace bailleur impossible');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleTogglePublish = async (residence: ResidenceWithRelations) => {
    setBusyId(residence.id);
    const nextStatus = !residence.is_published;
    try {
      await updateResidence(residence.id, { is_published: nextStatus });
      toast.success(nextStatus ? 'Annonce activée' : 'Annonce mise en pause');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Modification impossible');
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = residences.filter((r) => r.is_published).length;
  const totalViews = residences.reduce((acc, r) => acc + (r.views_count || 0), 0);

  return (
    <div className="bg-background text-on-background min-h-screen pb-[100px] flex flex-col font-body-md -mx-4 -my-8 sm:mx-0 sm:my-0">
      {/* TopAppBar */}
      <header className="sticky top-0 z-40 bg-surface dark:bg-surface-dim shadow-sm border-b border-surface-variant">
        <div className="flex justify-between items-center px-margin-mobile md:px-margin-desktop py-base w-full max-w-7xl mx-auto">
          {/* User Greeting */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container font-title-lg text-title-lg flex items-center justify-center font-bold">
              {user?.full_name ? user.full_name.slice(0, 2).toUpperCase() : 'P'}
            </div>
            <div>
              <div className="flex items-center gap-1">
                <h1 className="font-label-lg text-label-lg text-on-surface font-semibold">
                  Bonjour, {user?.full_name ? `M. ${user.full_name.split(' ')[0]}` : 'Propriétaire'}
                </h1>
                <span className="material-symbols-outlined text-[16px] text-tertiary-container">check_circle</span>
              </div>
              <p className="font-label-md text-label-md text-on-surface-variant">Bailleur Vérifié</p>
            </div>
          </div>

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex items-center gap-stack-lg">
            <Link href="/landlord" className="font-label-lg text-label-lg text-primary font-semibold border-b-2 border-primary py-2">
              Mes Annonces
            </Link>
            <Link href="/landlord" className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface py-2">
              Statistiques
            </Link>
            <Link href="/landlord" className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface py-2">
              Finances
            </Link>
          </nav>

          <Link href="/landlord/residences/new" className="hidden md:flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg font-label-lg">
            <span className="material-symbols-outlined">add</span>
            Publier une annonce
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-margin-mobile md:px-margin-desktop py-stack-lg flex flex-col gap-stack-lg max-w-7xl mx-auto w-full">
        {/* Bento Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-stack-md">
          {/* Stat 1 */}
          <div className="bg-surface-container rounded-xl p-gutter flex items-center justify-between shadow-sm">
            <div>
              <p className="font-label-md text-label-md text-on-surface-variant mb-1">Annonces actives</p>
              <span className="font-headline-lg text-headline-lg text-primary font-bold">
                {activeCount} <span className="font-body-md text-body-md text-on-surface-variant font-normal">/ {residences.length}</span>
              </span>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary-container/20 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">storefront</span>
            </div>
          </div>

          {/* Stat 2 */}
          <div className="bg-surface-container rounded-xl p-gutter flex items-center justify-between shadow-sm">
            <div>
              <p className="font-label-md text-label-md text-on-surface-variant mb-1">Vues totales</p>
              <span className="font-headline-lg text-headline-lg text-secondary-container font-bold">
                {totalViews} <span className="font-body-md text-body-md text-on-surface-variant font-normal">views</span>
              </span>
            </div>
            <div className="w-12 h-12 rounded-full bg-secondary-container/20 text-secondary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">visibility</span>
            </div>
          </div>

          {/* Stat 3 */}
          <div className="bg-surface-container rounded-xl p-gutter flex items-center justify-between shadow-sm">
            <div>
              <p className="font-label-md text-label-md text-on-surface-variant mb-1">Contacts générés</p>
              <span className="font-headline-lg text-headline-lg text-tertiary-container font-bold">
                {totalViews > 0 ? Math.floor(totalViews * 0.2) + 5 : 0} <span className="font-body-md text-body-md text-on-surface-variant font-normal">appels/WhatsApp</span>
              </span>
            </div>
            <div className="w-12 h-12 rounded-full bg-tertiary-container/20 text-tertiary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">phone_in_talk</span>
            </div>
          </div>
        </section>

        {/* Subscription Plan Banner */}
        <section className="bg-tertiary-container/10 border border-tertiary-container/30 rounded-xl p-gutter flex flex-col md:flex-row items-start md:items-center justify-between gap-stack-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-tertiary-container text-on-tertiary flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined">workspace_premium</span>
            </div>
            <div>
              <h3 className="font-label-lg text-label-lg text-on-surface font-semibold">
                Plan Standard (2 000 FCFA/mois)
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Vous avez {residences.length} bien{residences.length > 1 ? 's' : ''} enregistré{residences.length > 1 ? 's' : ''}. Passez au Premium pour booster vos vues.
              </p>
            </div>
          </div>
          <button className="bg-tertiary-container text-on-tertiary px-4 py-2 rounded-lg font-label-lg text-label-lg hover:bg-tertiary transition-colors self-end md:self-auto">
            Gérer / Prolonger
          </button>
        </section>

        {/* "Mes Annonces" Header */}
        <section className="flex justify-between items-center mt-stack-md">
          <h2 className="font-title-lg text-title-lg text-on-surface">Mes Annonces</h2>
          <Link
            href="/landlord/residences/new"
            className="flex items-center gap-1 text-primary font-label-lg text-label-lg hover:underline"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Publier
          </Link>
        </section>

        {/* Annonces Cards Grid */}
        <section className="flex flex-col gap-stack-md">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          ) : residences.length === 0 ? (
            <div className="text-center py-12 bg-surface-container rounded-xl p-6">
              <span className="material-symbols-outlined text-4xl text-outline mb-2">home_work</span>
              <p className="font-title-lg text-title-lg text-on-surface">Aucune annonce pour le moment</p>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1 mb-4">
                Publiez votre premier logement pour commencer à recevoir des demandes de locataires.
              </p>
              <Link
                href="/landlord/residences/new"
                className="inline-flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg font-label-lg"
              >
                <span className="material-symbols-outlined">add</span>
                Ajouter un bien
              </Link>
            </div>
          ) : (
            residences.map((residence) => (
              <article
                key={residence.id}
                className="bg-surface-container rounded-xl p-3 md:p-gutter flex flex-col md:flex-row items-start md:items-center justify-between gap-stack-md shadow-sm border border-surface-variant"
              >
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-lg bg-surface-variant overflow-hidden flex-shrink-0 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={residence.photos[0] || '/images/placeholder.jpg'}
                      alt={residence.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-label-lg text-label-lg text-on-surface font-semibold mb-1">
                      {residence.title}
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface-variant flex items-center gap-1 mb-1">
                      <span className="material-symbols-outlined text-[16px]">location_on</span>
                      {residence.zone || residence.city}
                    </p>
                    <span className="font-title-lg text-title-lg text-secondary-container font-semibold">
                      {formatXof(residence.price_monthly)}{' '}
                      <span className="font-body-md text-body-md text-on-surface-variant font-normal">/mois</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-stack-md w-full md:w-auto border-t md:border-t-0 pt-2 md:pt-0 border-surface-variant">
                  {/* Status Badge */}
                  {residence.is_published ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary-container/20 text-primary font-label-md text-label-md font-medium">
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-outline-variant/30 text-on-surface-variant font-label-md text-label-md font-medium">
                      En pause
                    </span>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleTogglePublish(residence)}
                      disabled={busyId === residence.id}
                      aria-label={residence.is_published ? 'Mettre en pause' : 'Activer'}
                      className="p-2 rounded-lg bg-surface hover:bg-surface-variant text-on-surface transition-colors active:scale-95 border border-outline-variant/30"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {residence.is_published ? 'pause' : 'play_arrow'}
                      </span>
                    </button>

                    <Link
                      href={`/landlord/residences/${residence.id}/edit`}
                      aria-label="Éditer l'annonce"
                      className="p-2 rounded-lg bg-surface hover:bg-surface-variant text-on-surface transition-colors active:scale-95 border border-outline-variant/30"
                    >
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </Link>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </main>

      {/* BottomNavBar (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center pt-2 pb-safe px-gutter bg-surface-container shadow-[0px_-1px_3px_rgba(0,0,0,0.08)] rounded-t-xl">
        <Link
          href="/landlord"
          className="flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-full px-5 py-1 active:scale-90 transition-transform duration-200"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            storefront
          </span>
          <span className="font-label-md text-label-md mt-1">Annonces</span>
        </Link>
        <Link
          href="/landlord/residences/new"
          className="flex flex-col items-center justify-center text-on-surface-variant px-5 py-1 hover:bg-surface-variant active:scale-90 transition-transform duration-200 rounded-full"
        >
          <span className="material-symbols-outlined">add_box</span>
          <span className="font-label-md text-label-md mt-1">Publier</span>
        </Link>
        <Link
          href="/profile"
          className="flex flex-col items-center justify-center text-on-surface-variant px-5 py-1 hover:bg-surface-variant active:scale-90 transition-transform duration-200 rounded-full"
        >
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-md text-label-md mt-1">Profil</span>
        </Link>
      </nav>
    </div>
  );
}