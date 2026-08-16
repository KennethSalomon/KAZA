'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { listMyConversations } from '@/lib/supabase-api';
import { supabase } from '@/lib/supabase-client';
import type { ConversationWithRelations } from '@/lib/types';
import { timeAgo, formatXof } from '@/lib/format';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { PanelsTopLeft } from 'lucide-react';

export function ConversationList() {
  const { user } = useAuth();
  const [items, setItems] = useState<ConversationWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const list = await listMyConversations();
      setItems(list);
    } catch {
      // silencieux : la liste vide suffit en cas d'erreur réseau
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // note : temps réel — MAJ locale de la liste sans re-fetch réseau.
  // Le Realtime applique déjà la RLS (on ne reçoit que SES messages).
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('conversations-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const m = payload.new as {
            conversation_id: string;
            sender_id: string;
            kind?: string;
            body?: string | null;
          };
          setItems((prev) => {
            const idx = prev.findIndex((c) => c.id === m.conversation_id);
            if (idx === -1) {
              // Nouvelle conversation inconnue : un seul re-fetch rarissime.
              void load();
              return prev;
            }
            const preview =
              m.kind === 'image'
                ? '📷 Photo'
                : m.kind === 'document'
                  ? '📎 Document'
                  : m.body?.trim() || 'Nouveau message';
            const updated: ConversationWithRelations = {
              ...prev[idx],
              last_message_preview: preview,
              last_message_at: new Date().toISOString(),
              unread_count: m.sender_id === user.id ? prev[idx].unread_count : prev[idx].unread_count + 1,
            };
            return [updated, ...prev.filter((_, i) => i !== idx)];
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, load]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px]" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Aucune conversation"
        body="Parcourez les logements et contactez un bailleur pour ouvrir une discussion."
        action={
          <button onClick={() => router.push('/explorer')} className="text-sm font-medium text-kaza-brand hover:opacity-80">
            Explorer les biens →
          </button>
        }
      />
    );
  }

  return (
    <ul className="space-y-2" data-testid="conversation-list">
      {items.map((c) => (
        <li key={c.id}>
          <button
            onClick={() => router.push(`/chat/${c.id}`)}
            className={cn(
              'flex w-full items-center gap-3.5 rounded-kaza border p-3.5 text-left transition-all duration-150',
              'border-kaza-border bg-kaza-surface hover:border-kaza-faint hover:bg-kaza-raised',
            )}
          >
            <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-kaza-brand/25 bg-kaza-brand/10 font-display text-sm font-bold text-kaza-brand">
              {c.peer?.full_name.slice(0, 2).toUpperCase() ?? '??'}
              {c.unread_count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-kaza-brand px-1 text-[10px] font-bold text-kaza-bg">
                  {c.unread_count}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-semibold text-kaza-text">{c.peer?.full_name ?? 'Contact'}</span>
                <span className="shrink-0 text-[11px] text-kaza-faint">{timeAgo(c.last_message_at)}</span>
              </span>
              <span className="mt-0.5 flex items-baseline justify-between gap-3">
                <span className="truncate text-xs text-kaza-muted">
                  {c.residence ? `${c.residence.title} · ${formatXof(c.residence.price_monthly)}/mois` : 'Bien'}
                </span>
              </span>
              <span className="mt-0.5 block truncate text-xs text-kaza-faint">
                {c.last_message_preview ? (c.last_message_preview === 'image' ? '📷 Photo' : c.last_message_preview === 'document' ? '📎 Document' : c.last_message_preview) : 'Nouvelle conversation'}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ChatMobileHint() {
  return (
    <div className="hidden">{/* placeholder mobile : la liste est visible sur mobile avant sélection */}</div>
  );
}

// export accessoire pour éviter lint unused
export { PanelsTopLeft };