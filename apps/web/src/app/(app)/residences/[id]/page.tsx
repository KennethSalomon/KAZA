'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, BedDouble, Bath, Ruler, MapPin, ShieldCheck, MessageSquare, Eye } from 'lucide-react';
import { getResidence, openConversation as openConv, incrementResidenceViews, ApiError } from '@/lib/supabase-api';
import type { ResidenceWithRelations } from '@/lib/types';
import { formatXof, formatDate, PROVIDER_LABELS } from '@/lib/format';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';

export default function ResidenceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [residence, setResidence] = useState<ResidenceWithRelations | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let mounted = true;
    getResidence(id)
      .then((r) => {
        mounted && setResidence(r);
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

  const openConversation = useCallback(async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!residence) return;
    if (residence.owner_id === user.id) return;
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

  const photo = residence.photos[photoIndex];
  const isOwner = user?.id === residence.owner_id;

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="mb-5 flex items-center gap-2 text-sm text-kaza-muted transition-colors hover:text-kaza-text"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Retour
      </button>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Galerie */}
        <div>
          <motion.div
            key={photoIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
            className="relative aspect-[16/9] overflow-hidden rounded-kaza-lg border border-kaza-border bg-kaza-raised"
          >
            {photo ? (
              <Image src={photo} alt={`${residence.title} — photo ${photoIndex + 1}`} fill priority sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-kaza-faint">
                <MapPin className="h-10 w-10" aria-hidden />
              </div>
            )}
            <div className="absolute left-4 top-4">
              <StatusBadge status={residence.status} />
            </div>
            <span className="absolute bottom-4 right-4 rounded-full bg-kaza-bg/80 px-3 py-1 text-xs text-kaza-muted backdrop-blur tabular-nums">
              {photoIndex + 1} / {Math.max(residence.photos.length, 1)}
            </span>
          </motion.div>

          {residence.photos.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Photos">
              {residence.photos.map((p, i) => (
                <button
                  key={p}
                  role="tab"
                  aria-selected={i === photoIndex}
                  onClick={() => setPhotoIndex(i)}
                  className={cn(
                    'relative h-16 w-24 shrink-0 overflow-hidden rounded-kaza border transition-all touch-target',
                    i === photoIndex ? 'border-kaza-brand ring-1 ring-kaza-brand/50' : 'border-kaza-border opacity-60 hover:opacity-100',
                  )}
                >
                  <Image src={p} alt="" fill className="object-cover" sizes="96px" />
                </button>
              ))}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-kaza-text">À propos de ce bien</h2>
              <p className="mt-2 text-sm leading-relaxed text-kaza-muted truncate-mobile">
                {residence.description || 'Description bientôt disponible. Contactez le bailleur pour plus de détails.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-kaza-lg border border-kaza-border bg-kaza-surface p-4 sm:grid-cols-4">
              <InfoCell icon={<BedDouble className="h-4 w-4" aria-hidden />} label="Chambres" value={String(residence.bedrooms)} />
              <InfoCell icon={<Bath className="h-4 w-4" aria-hidden />} label="Salles de bain" value={String(residence.bathrooms)} />
              {residence.surface != null && <InfoCell icon={<Ruler className="h-4 w-4" aria-hidden />} label="Surface" value={`${residence.surface} m²`} />}
              <InfoCell icon={<Eye className="h-4 w-4" aria-hidden />} label="Vues" value={String(residence.views_count ?? 0)} />
            </div>
          </div>
        </div>

        {/* Panneau latéral */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="kaza-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">{residence.title}</h1>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-kaza-muted">
                  <MapPin className="h-4 w-4 shrink-0 text-kaza-brand" aria-hidden />
                  {residence.address || `${residence.zone ?? ''} ${residence.city}`}
                </p>
              </div>
            </div>

            <p className="price mt-5 font-display text-3xl font-bold text-kaza-brand">
              {formatXof(residence.price_monthly)}
              <span className="text-sm font-normal text-kaza-muted"> / mois</span>
            </p>
            {residence.deposit > 0 && (
              <p className="mt-1 text-xs text-kaza-muted">
                Caution : {formatXof(residence.deposit)} (max. 3 mois — Loi 2022-30)
              </p>
            )}

            <div className="mt-5 flex flex-col gap-2.5">
              {isOwner ? (
                <Link href={`/landlord/residences/${residence.id}/edit`}>
                  <Button variant="secondary" className="w-full btn-responsive-lg" size="lg">
                    Gérer ce bien
                  </Button>
                </Link>
              ) : (
                <Button onClick={() => void openConversation()} loading={sending} className="w-full btn-responsive-lg" data-testid="contact-owner">
                  <MessageSquare className="h-4 w-4" aria-hidden />
                  {user ? 'Contacter le bailleur' : 'Se connecter pour contacter'}
                </Button>
              )}
            </div>
          </div>

          {residence.owner && !isOwner && (
            <div className="kaza-card flex items-center gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-kaza-brand/30 bg-kaza-brand/10 font-display text-sm font-bold text-kaza-brand">
                {residence.owner.full_name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium text-kaza-text">
                  {residence.owner.full_name}
                  {residence.owner.is_premium && <ShieldCheck className="h-3.5 w-3.5 text-kaza-brand" aria-label="Bailleur Premium" />}
                </p>
                <p className="text-xs text-kaza-faint">Membre MARSAL TECH · {formatDate(residence.created_at)}</p>
              </div>
            </div>
          )}

<p className="rounded-kaza border border-kaza-peach/50 bg-kaza-peach/15 px-4 py-3 text-xs leading-relaxed text-kaza-muted">
            <strong className="text-kaza-brand-dark">Bailleur vérifié :</strong> ce bien est contrôlé par l&apos;équipe MARSAL TECHNOLOGIES.
            Jamais de paiement avant visite — signalez tout comportement suspect depuis votre messagerie.
          </p>
        </aside>
      </div>
    </div>
  );
}

function InfoCell({ icon, label, value }: Readonly<{ icon: React.ReactNode; label: string; value: string }>) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <span className="text-kaza-brand">{icon}</span>
      <span className="text-xs text-kaza-faint">{label}</span>
      <span className="price text-sm font-medium text-kaza-text">{value}</span>
    </div>
  );
}

function DetailSkeleton() {
  void PROVIDER_LABELS;
  return (
    <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <Skeleton className="aspect-[16/9] rounded-kaza-lg" />
      <div className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-12 w-40" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}