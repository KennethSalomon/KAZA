'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getResidence, openConversation as openConv, incrementResidenceViews, toggleFavorite, listMyFavorites, ApiError } from '@/lib/supabase-api';
import type { ResidenceWithRelations } from '@/lib/types';
import { formatXof } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';

export default function ResidenceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [residence, setResidence] = useState<ResidenceWithRelations | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      getResidence(id),
      listMyFavorites().catch(() => []),
    ])
      .then(([r, favs]) => {
        if (mounted) {
          setResidence(r);
          setIsFavorite(favs.some((f) => f.id === r.id));
        }
        void incrementResidenceViews(id);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) router.replace('/explorer');
        else toast.error('Chargement impossible');
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [id, router, toast]);

  const handleToggleFavorite = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      await toggleFavorite(id);
      toast.success(next ? 'Ajouté aux favoris' : 'Retiré des favoris');
    } catch {
      setIsFavorite(!next);
      toast.error('Mise à jour des favoris impossible');
    }
  };

  const openConversation = useCallback(async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!residence) return;
    if (residence.owner_id === user.id) {
      router.push(`/landlord/residences/${residence.id}/edit`);
      return;
    }
    setSending(true);
    try {
      const convId = await openConv(residence.id);
      router.push(`/chat/${convId}`);
    } catch {
      toast.error('Ouverture de la conversation impossible');
    } finally {
      setSending(false);
    }
  }, [residence, user, router, toast]);

  if (loading) return <DetailSkeleton />;
  if (!residence) notFound();

  const photos = residence.photos.length > 0 ? residence.photos : ['/images/placeholder.jpg'];
  const currentPhoto = photos[photoIndex] || photos[0];
  const isOwner = user?.id === residence.owner_id;

  return (
    <div className="-mx-4 -my-8 bg-background text-on-background antialiased md:flex md:justify-center md:py-8">
      {/* Mobile View Container */}
      <main className="w-full min-h-screen bg-background relative md:w-[450px] md:min-h-0 md:rounded-[2rem] md:overflow-hidden md:shadow-2xl md:border-8 md:border-surface-variant flex flex-col">
        {/* TopAppBar (Floating over image) */}
        <header className="fixed top-0 w-full z-50 bg-transparent flex justify-between items-center px-margin-mobile py-4 md:absolute md:w-full">
          <button
            onClick={() => router.back()}
            aria-label="Retour"
            className="w-10 h-10 rounded-full bg-surface-container-lowest/80 backdrop-blur-md flex items-center justify-center text-on-surface shadow-sm transition-transform active:scale-95 hover:bg-surface-variant/20"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>

          {/* Photo Counter */}
          <div className="px-3 py-1 rounded-full bg-surface-container-lowest/80 backdrop-blur-md text-on-surface font-label-md text-label-md shadow-sm">
            {photoIndex + 1}/{photos.length}
          </div>

          <button
            onClick={() => void handleToggleFavorite()}
            aria-label="Favori"
            className="w-10 h-10 rounded-full bg-surface-container-lowest/80 backdrop-blur-md flex items-center justify-center text-on-surface shadow-sm transition-transform active:scale-95 hover:bg-surface-variant/20"
          >
            <span
              className={`material-symbols-outlined ${isFavorite ? 'text-red-500' : ''}`}
              style={{ fontVariationSettings: isFavorite ? "'FILL' 1" : "'FILL' 0" }}
            >
              favorite
            </span>
          </button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto hide-scroll pb-[140px]">
          {/* Hero Image Carousel */}
          <section className="relative w-full h-[350px] overflow-hidden flex">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentPhoto}
              alt={residence.title}
              className="w-full h-full object-cover transition-opacity duration-300"
            />
            {photos.length > 1 && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-20">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoIndex(i)}
                    className={`h-2 rounded-full transition-all ${
                      i === photoIndex ? 'w-6 bg-white' : 'w-2 bg-white/50'
                    }`}
                    aria-label={`Photo ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Content Area (Overlapping White Surface) */}
          <section className="relative -mt-6 bg-surface rounded-t-[1.5rem] px-margin-mobile pt-stack-lg pb-stack-lg z-10 flex flex-col gap-stack-md shadow-[0px_-2px_10px_rgba(0,0,0,0.05)]">
            {/* Title & Location */}
            <div>
              <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary mb-1">
                {residence.title}
              </h1>
              <div className="flex items-center text-on-surface-variant gap-1">
                <span className="material-symbols-outlined text-[18px]">location_on</span>
                <span className="font-body-md text-body-md">
                  {residence.address || `${residence.zone ? residence.zone + ', ' : ''}${residence.city}`}
                </span>
              </div>
            </div>

            {/* Price & Badge */}
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 mt-2">
              <span className="font-headline-lg text-headline-lg text-secondary-container">
                {formatXof(residence.price_monthly)}{' '}
                <span className="font-body-md text-body-md text-on-surface-variant font-normal">
                  / mois
                </span>
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-secondary-container/10 text-secondary-fixed-dim font-label-md text-label-md self-start">
                Caution : {residence.deposit ? formatXof(residence.deposit) : '3 mois'}
              </span>
            </div>

            <hr className="border-outline-variant/30 my-2" />

            {/* Key Specs Grid */}
            <div className="grid grid-cols-5 gap-2 py-2">
              <div className="flex flex-col items-center justify-center bg-surface-container-low rounded-lg p-2 gap-1">
                <span className="material-symbols-outlined text-primary text-[24px]">hotel</span>
                <span className="font-label-md text-label-md text-on-surface text-center leading-tight">
                  {(residence.bedrooms ?? 1)} Chambre{(residence.bedrooms ?? 1) > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex flex-col items-center justify-center bg-surface-container-low rounded-lg p-2 gap-1">
                <span className="material-symbols-outlined text-primary text-[24px]">shower</span>
                <span className="font-label-md text-label-md text-on-surface text-center leading-tight">
                  {(residence.bathrooms ?? 1)} Douche{(residence.bathrooms ?? 1) > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex flex-col items-center justify-center bg-surface-container-low rounded-lg p-2 gap-1">
                <span className="material-symbols-outlined text-primary text-[24px]">restaurant</span>
                <span className="font-label-md text-label-md text-on-surface text-center leading-tight">
                  Cuisine
                </span>
              </div>
              <div className="flex flex-col items-center justify-center bg-surface-container-low rounded-lg p-2 gap-1">
                <span className="material-symbols-outlined text-primary text-[24px]">balcony</span>
                <span className="font-label-md text-label-md text-on-surface text-center leading-tight">
                  Balcon
                </span>
              </div>
              <div className="flex flex-col items-center justify-center bg-surface-container-low rounded-lg p-2 gap-1">
                <span className="material-symbols-outlined text-primary text-[24px]">directions_car</span>
                <span className="font-label-md text-label-md text-on-surface text-center leading-tight">
                  Garage
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="mt-4">
              <h2 className="font-title-lg text-title-lg text-on-surface mb-2">Description</h2>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                {residence.description ||
                  "Appartement lumineux et idéalement situé. Profitez d'un grand salon aéré, de chambres spacieuses et d'une cuisine équipée dans un quartier sécurisé et calme."}
              </p>
            </div>

            {/* Amenities List */}
            <div className="mt-4">
              <h2 className="font-title-lg text-title-lg text-on-surface mb-3">Équipements</h2>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-md text-label-md border border-primary-fixed-dim">
                  Eau courante
                </span>
                <span className="px-3 py-1.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-md text-label-md border border-primary-fixed-dim">
                  Électricité prépayée
                </span>
                <span className="px-3 py-1.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-md text-label-md border border-primary-fixed-dim">
                  Gardien 24/7
                </span>
                <span className="px-3 py-1.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-label-md text-label-md border border-primary-fixed-dim">
                  WiFi Fibre
                </span>
              </div>
            </div>

            {/* Map Placeholder */}
            <div className="mt-6 rounded-xl overflow-hidden h-40 relative shadow-sm border border-outline-variant/30 bg-surface-container-high flex items-center justify-center">
              <div className="text-center p-4">
                <span className="material-symbols-outlined text-primary text-3xl">map</span>
                <p className="font-label-lg text-label-lg text-on-surface mt-1">
                  Localisation : {residence.zone ?? residence.city}
                </p>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {residence.city}, Bénin
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Sticky Bottom Bar: Landlord Contact Card */}
        <div className="fixed bottom-0 w-full bg-surface shadow-[0px_-4px_16px_rgba(0,0,0,0.06)] p-margin-mobile flex flex-col gap-3 rounded-t-xl z-50 md:absolute md:w-full">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary overflow-hidden">
                <span className="material-symbols-outlined">person</span>
              </div>
              <div>
                <p className="font-label-md text-label-md text-on-surface-variant">
                  {isOwner ? 'Votre annonce' : 'Publié par le propriétaire'}
                </p>
                <div className="flex items-center gap-1 text-on-surface font-label-lg text-label-lg">
                  <span className="material-symbols-outlined text-[16px] text-outline">
                    {isOwner ? 'check_circle' : 'lock'}
                  </span>
                  <span>
                    {isOwner
                      ? residence.owner?.full_name || 'Bailleur'
                      : residence.owner?.phone || '+229 97 ** ** 12'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={() => void openConversation()}
            disabled={sending}
            className="w-full bg-primary text-on-primary rounded-lg py-3 font-label-lg text-label-lg flex justify-center items-center gap-2 transition-transform active:scale-[0.98] shadow-sm hover:bg-tertiary disabled:opacity-70"
          >
            <span className="material-symbols-outlined text-[20px]">
              {isOwner ? 'edit' : 'lock_open'}
            </span>
            {isOwner
              ? 'Gérer cette annonce'
              : sending
              ? 'Ouverture...'
              : 'Débloquer le numéro (1 000 FCFA / Pass)'}
          </button>
        </div>
      </main>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-[450px] space-y-4 p-4">
      <Skeleton className="h-[350px] w-full rounded-2xl" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}