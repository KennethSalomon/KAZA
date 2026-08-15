'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { toggleFavorite, ApiError } from '@/lib/supabase-api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';

// Cœur de favori : optimiste, connecté requis. `initial` remplit le cœur au
// montage ; `onToggle(id, now)` notifie le parent (ex. retrait de la liste).
export function FavoriteButton({
  residenceId,
  initial = false,
  onToggle,
  className,
}: Readonly<{
  residenceId: string;
  initial?: boolean;
  onToggle?: (id: string, now: boolean) => void;
  className?: string;
}>) {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [active, setActive] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function handle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push('/login');
      return;
    }
    setBusy(true);
    setActive((a) => !a); // optimiste
    try {
      const now = await toggleFavorite(residenceId);
      setActive(now);
      onToggle?.(residenceId, now);
    } catch (err) {
      setActive((a) => !a);
      toast.error('Favori impossible à modifier', err instanceof ApiError ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => void handle(e)}
      aria-pressed={active}
      aria-label={active ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      disabled={busy}
      className={cn(
        'grid h-9 w-9 place-items-center rounded-full border shadow-sm backdrop-blur transition-all duration-150 active:scale-90 disabled:opacity-60',
        active
          ? 'border-kaza-danger/40 bg-white/90 text-kaza-danger'
          : 'border-white/70 bg-kaza-bg/80 text-kaza-faint hover:text-kaza-danger',
        className,
      )}
    >
      <Heart className={cn('h-4 w-4', active && 'fill-current')} aria-hidden />
    </button>
  );
}
