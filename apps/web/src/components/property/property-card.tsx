'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { BedDouble, Bath, Ruler, MapPin } from 'lucide-react';
import type { Residence } from '@/lib/types';
import { formatXof, TYPE_LABELS } from '@/lib/format';
import { StatusBadge } from '@/components/ui/status-badge';
import { FavoriteButton } from '@/components/property/favorite-button';

export function PropertyCard({
  residence,
  index = 0,
  active = false,
  favoriteInitial = false,
  onToggleFavorite,
}: Readonly<{
  residence: Residence;
  index?: number;
  active?: boolean;
  favoriteInitial?: boolean;
  onToggleFavorite?: (id: string, now: boolean) => void;
}>) {
  const photo = residence.photos[0];
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.4), ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
      className={`kaza-card kaza-card-hover overflow-hidden ${active ? 'ring-1 ring-kaza-brand/60' : ''}`}
    >
      <Link href={`/residences/${residence.id}`} className="block">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-kaza-raised">
          {photo ? (
            <Image
              src={photo}
              alt={residence.title}
              fill
              sizes="(max-width: 640px) 100vw, 33vw"
              className="object-cover transition-transform duration-500 hover:scale-[1.04]"
            />
          ) : (
            <div className="grid h-full place-items-center text-kaza-faint">
              <MapPin className="h-8 w-8" aria-hidden />
            </div>
          )}
          <div className="absolute left-3 top-3 flex gap-2">
            <StatusBadge status={residence.status} />
            {residence.distance_km != null && (
              <span className="rounded-full border border-kaza-border bg-kaza-bg/85 px-2.5 py-0.5 text-[11px] font-medium text-kaza-muted backdrop-blur">
                à {residence.distance_km.toFixed(1)} km
              </span>
            )}
          </div>
          <div className="absolute right-3 top-3">
            <FavoriteButton
              residenceId={residence.id}
              initial={favoriteInitial}
              onToggle={onToggleFavorite}
            />
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-display text-[15px] font-semibold text-kaza-text">{residence.title}</h3>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-kaza-muted">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">
                  {residence.zone ?? ''} {residence.city}
                </span>
              </p>
            </div>
            <p className="price shrink-0 text-right text-sm font-bold text-kaza-brand">
              {formatXof(residence.price_monthly)}
            </p>
          </div>

          <div className="mt-3 flex items-center gap-4 border-t border-kaza-border/70 pt-3 text-xs text-kaza-muted">
            <span className="flex items-center gap-1.5">
              <BedDouble className="h-3.5 w-3.5 text-kaza-faint" aria-hidden />
              {residence.bedrooms} ch.
            </span>
            <span className="flex items-center gap-1.5">
              <Bath className="h-3.5 w-3.5 text-kaza-faint" aria-hidden />
              {residence.bathrooms} sdb
            </span>
            {residence.surface != null && (
              <span className="flex items-center gap-1.5">
                <Ruler className="h-3.5 w-3.5 text-kaza-faint" aria-hidden />
                {Math.round(residence.surface)} m²
              </span>
            )}
            <span className="ml-auto rounded-full bg-kaza-brand/10 px-2 py-0.5 font-medium text-kaza-brand">
              {TYPE_LABELS[residence.type]}
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}