'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  listNotifications,
  unreadNotificationsCount,
  markAllNotificationsRead,
} from '@/lib/supabase-api';
import { supabase } from '@/lib/supabase-client';
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

export function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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
        (payload) => {
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

  async function markAllRead() {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
    setUnread(0);
  }

  return (
    <div className="relative">
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
          ref={panelRef}
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
              <li key={n.id} className={cn('border-b border-kaza-border/60 px-4 py-3 last:border-0', !n.read_at && 'bg-kaza-brand/[0.04]')}>
                <div className="flex items-start gap-2.5">
                  <span aria-hidden className="text-base">
                    {TYPE_ICONS[n.type] ?? 'ℹ️'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-kaza-text">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs leading-relaxed text-kaza-muted">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-kaza-faint">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}