'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  listNotifications,
  unreadNotificationsCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/supabase-api';
import { supabase } from '@/lib/supabase-client';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import { timeAgo } from '@/lib/format';
import type { AppNotification } from '@/lib/types';
import { cn } from '@/lib/cn';

const TYPE_ICONS: Record<string, string> = {
  payment: '💵',
  receipt: '📄',
  overdue: '⚠️',
  visit: '📅',
  message: '💬',
  lease: '🔑',
  system: 'ℹ️',
};

/** Cible de navigation déduite du type + payload de la notification. */
function targetFrom(n: AppNotification): string | null {
  const d = (n.data ?? {}) as Record<string, string | undefined>;
  if (d.conversation_id) return `/chat/${d.conversation_id}`;
  if (d.residence_id) return `/landlord/residences/${d.residence_id}/edit`;
  return '/dashboard';
}

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const load = async () => {
      const [list, count] = await Promise.all([
        listNotifications(30),
        unreadNotificationsCount(),
      ]);
      if (!mounted) return;
      setItems(list);
      setUnread(count);
    };
    void load();

    // note : notifications temps réel via Supabase Realtime (table notifications)
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload: RealtimePostgresInsertPayload<AppNotification>) => {
          const n = payload.new as AppNotification;
          setItems((prev) => [n, ...prev].slice(0, 30));
          setUnread((u) => u + 1);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [user]);

  // Fermeture au clic extérieur + Échap.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function markAllRead() {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
    setUnread(0);
  }

  async function markOneRead(id: string) {
    await markNotificationRead(id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    setUnread((u) => Math.max(0, u - 1));
  }

  function openTarget(n: AppNotification) {
    if (!n.read_at) void markOneRead(n.id);
    setOpen(false);
    const target = targetFrom(n);
    if (target) router.push(target);
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread > 0 ? ` (${unread} non lues)` : ''}`}
        aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-kaza text-kaza-muted transition-colors hover:bg-kaza-surface hover:text-kaza-text"
      >
        <Bell className="h-4.5 w-4.5" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-kaza-brand px-1 text-[10px] font-bold text-kaza-bg tabular-nums">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-11 w-[min(90vw,360px)] overflow-hidden rounded-kaza-lg border border-kaza-border bg-kaza-surface shadow-card-hover"
        >
          <div className="flex items-center justify-between border-b border-kaza-border px-4 py-3">
            <p className="font-display text-sm font-semibold text-kaza-text">Notifications</p>
            {unread > 0 && (
              <button onClick={() => void markAllRead()} className="text-xs font-medium text-kaza-brand hover:opacity-80">
                Tout marquer lu
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-kaza-muted">Aucune notification pour le moment.</li>
            )}
            {items.map((n) => (
              <li
                key={n.id}
                className={cn(
                  'relative flex items-start gap-2.5 border-b border-kaza-border/60 px-4 py-3 last:border-0',
                  !n.read_at && 'bg-kaza-brand/[0.04]',
                )}
              >
                {!n.read_at && (
                  <span className="absolute left-1.5 top-4 h-1.5 w-1.5 rounded-full bg-kaza-brand" aria-hidden />
                )}
                <button
                  onClick={() => openTarget(n)}
                  className="flex min-w-0 flex-1 items-start gap-2.5 text-left transition-colors hover:opacity-90"
                >
                  <span aria-hidden className="text-base">
                    {TYPE_ICONS[n.type] ?? 'ℹ️'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-kaza-text">{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-xs leading-relaxed text-kaza-muted">{n.body}</span>}
                    <span className="mt-1 block text-[11px] text-kaza-faint">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
                {!n.read_at && (
                  <button
                    aria-label="Marquer comme lue"
                    title="Marquer comme lue"
                    onClick={() => void markOneRead(n.id)}
                    className="grid h-6 w-6 shrink-0 place-items-center self-center rounded-full border border-kaza-border text-kaza-faint transition-colors hover:border-kaza-brand hover:text-kaza-brand"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
