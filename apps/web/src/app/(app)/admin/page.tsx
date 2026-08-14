'use client';

import { useCallback, useEffect, useState } from 'react';
import { Users, Building2, Wallet, FileText, CheckCircle2, Crown, Shield } from 'lucide-react';
import {
  adminStats,
  adminListResidences,
  adminListUsers,
  adminVerifyResidence,
  adminUnpublishResidence,
  adminSetPremium,
  adminToggleRole,
} from '@/lib/supabase-api';
import { useAuth } from '@/lib/auth-context';
import type { Profile, Residence } from '@/lib/types';
import { formatXof } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';

interface Stats {
  users: { total: number; by_role: Record<string, number> };
  residences: { total: number; by_status: Record<string, number> };
  leases: { total: number };
  payments: { confirmed_count: number; total_collected_xof: number };
}

export default function AdminPage() {
  const { role } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [residences, setResidences] = useState<Residence[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [s, r, u] = await Promise.all([
      adminStats(),
      adminListResidences(30),
      adminListUsers(30),
    ]);
    setStats(s);
    setResidences(r);
    setUsers(u);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (role === 'admin') void loadAll();
  }, [role, loadAll]);

  async function act(action: () => Promise<unknown>, id: string) {
    setBusy(id);
    try {
      await action();
      await loadAll();
    } finally {
      setBusy(null);
    }
  }

  if (role !== 'admin') {
    return <p className="py-16 text-center text-sm text-kaza-faint">Accès réservé à l'administration.</p>;
  }

  if (loading || !stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  const cards = [
    { icon: Users, label: 'Utilisateurs', value: String(stats.users.total), sub: `locataires ${stats.users.by_role['locataire'] ?? 0} · bailleurs ${stats.users.by_role['bailleur'] ?? 0}` },
    { icon: Building2, label: 'Biens', value: String(stats.residences.total), sub: `libres ${stats.residences.by_status['libre'] ?? 0} · occupés ${stats.residences.by_status['occupee'] ?? 0}` },
    { icon: Wallet, label: 'Collecté', value: formatXof(stats.payments.total_collected_xof), sub: `${stats.payments.confirmed_count} paiements confirmés` },
    { icon: FileText, label: 'Baux actifs', value: String(stats.leases.total), sub: 'en cours de gestion' },
  ];

  const pendingModeration = residences.filter((r) => r.is_published && !r.is_verified);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">Administration</h1>
      <p className="mt-1 text-sm text-kaza-muted">Modération des annonces et pilotage de la plateforme.</p>

      {/* KPIs */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="kaza-card p-5">
            <span className="grid h-9 w-9 place-items-center rounded-kaza border border-kaza-brand/25 bg-kaza-brand/10 text-kaza-brand">
              <c.icon className="h-4.5 w-4.5" aria-hidden />
            </span>
            <p className="price mt-3 font-display text-xl font-bold text-kaza-text">{c.value}</p>
            <p className="text-xs text-kaza-faint">{c.label} · {c.sub}</p>
          </div>
        ))}
      </div>

      {pendingModeration.length > 0 && (
        <section className="mt-8" aria-labelledby="moderation">
          <h2 id="moderation" className="font-display text-lg font-semibold text-kaza-text">
            Annonces en attente <span className="text-kaza-warning">({pendingModeration.length})</span>
          </h2>
          <ul className="mt-3 space-y-2">
            {pendingModeration.map((r) => (
              <li key={r.id} className="kaza-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-kaza-text">{r.title}</p>
                  <p className="text-xs text-kaza-faint">
                    {r.zone ?? ''} {r.city} · {formatXof(r.price_monthly)}/mois · par {r.owner?.full_name ?? '—'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="success" loading={busy === r.id} onClick={() => act(() => adminVerifyResidence(r.id), r.id)}>
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    Approuver
                  </Button>
                  <Button size="sm" variant="danger" loading={busy === r.id} onClick={() => act(() => adminUnpublishResidence(r.id), r.id)}>
                    Retirer
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {/* Utilisateurs */}
        <section aria-labelledby="users">
          <h2 id="users" className="font-display text-lg font-semibold text-kaza-text">Utilisateurs</h2>
          <ul className="mt-3 space-y-2">
            {users.map((u) => (
              <li key={u.id} className="kaza-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-kaza-text">{u.full_name}</p>
                  <p className="text-xs text-kaza-faint">{u.email ?? u.phone ?? '—'}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-medium', u.is_premium ? 'border-kaza-brand/40 bg-kaza-brand/10 text-kaza-brand' : 'border-kaza-border text-kaza-faint')}>
                    {u.is_premium ? <Crown className="mr-1 inline h-3 w-3" aria-hidden /> : null}
                    {u.role}
                  </span>
                  <Button size="sm" variant="ghost" loading={busy === u.id} onClick={() => act(() => adminSetPremium(u.id, !u.is_premium), u.id)}>
                    {u.is_premium ? 'Retirer Premium' : 'Passer Premium'}
                  </Button>
                  <Button size="sm" variant="ghost" loading={busy === u.id} onClick={() => act(() => adminToggleRole(u.id, u.role === 'bailleur' ? 'locataire' : 'bailleur'), u.id)}>
                    <Shield className="h-3.5 w-3.5" aria-hidden />
                    {u.role === 'bailleur' ? '→ locataire' : '→ bailleur'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Biens */}
        <section aria-labelledby="residences">
          <h2 id="residences" className="font-display text-lg font-semibold text-kaza-text">Biens récents</h2>
          <ul className="mt-3 space-y-2">
            {residences.slice(0, 15).map((r) => (
              <li key={r.id} className="kaza-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-kaza-text">{r.title}</p>
                  <p className="text-xs text-kaza-faint">{r.zone ?? ''} {r.city}</p>
                </div>
                <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-medium', r.is_verified ? 'border-kaza-success/30 bg-kaza-success/10 text-kaza-success' : 'border-kaza-warning/30 bg-kaza-warning/10 text-kaza-warning')}>
                  {r.is_verified ? 'vérifié' : 'en attente'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}