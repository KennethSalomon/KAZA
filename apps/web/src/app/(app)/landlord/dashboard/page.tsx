'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Home, Building2, CreditCard, FileSignature, AlertCircle, Calendar, TrendingUp, DollarSign, KeyRound, Plus, Minus } from 'lucide-react';
import { getLandlordDashboardStats, listMyPayments, listMyReceipts, listMyLeases, listMyResidences } from '@/lib/supabase-api';
import { useAuth } from '@/lib/auth-context';
import type { PaymentWithRelations, ReceiptWithRelations, LeaseWithRelations, ResidenceWithRelations } from '@/lib/types';
import { formatXof, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { apiToast } from '@/lib/api-toast';

interface KPICardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
  href?: string;
  className?: string;
}

function KPICard({ label, value, icon, trend, href, className }: KPICardProps) {
  return (
    <Link href={href ?? '/landlord/dashboard'} className={`kaza-card p-4 hover:shadow-card-hover transition-shadow ${className ?? ''}`} aria-label={label}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-kaza-muted tracking-wide uppercase">{label}</p>
          <p className="mt-1 text-2xl font-bold text-kaza-text tabular-nums min-w-0">{value}</p>
          {trend && (
            <p className={`mt-1.5 text-xs font-medium ${trend.positive ? 'text-kaza-success' : 'text-kaza-danger'}`}>
              {trend.value}
            </p>
          )}
        </div>
        <span className="shrink-0 grid h-10 w-10 place-items-center rounded-kaza bg-kaza-brand/10 text-kaza-brand">
          {icon}
        </span>
      </div>
    </Link>
  );
}

interface ActionCardProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  description: string;
  href: string;
  ctaLabel: string;
  variant?: 'default' | 'warning' | 'danger';
  emptyMessage?: string;
}

function ActionCard({ title, count, icon, description, href, ctaLabel, variant = 'default', emptyMessage }: ActionCardProps) {
  const borderColor = variant === 'warning' ? 'border-kaza-warning/30' : variant === 'danger' ? 'border-kaza-danger/30' : 'border-kaza-border';
  const bgColor = variant === 'warning' ? 'bg-kaza-warning/5' : variant === 'danger' ? 'bg-kaza-danger/5' : 'bg-kaza-surface';
  const iconColor = variant === 'warning' ? 'text-kaza-warning' : variant === 'danger' ? 'text-kaza-danger' : 'text-kaza-brand';
  const badgeColor = variant === 'warning' ? 'bg-kaza-warning/15 text-kaza-warning' : variant === 'danger' ? 'bg-kaza-danger/15 text-kaza-danger' : 'bg-kaza-brand/15 text-kaza-brand';

  if (count === 0 && emptyMessage) {
    return (
      <div className={`kaza-card p-4 border ${borderColor} ${bgColor}`}>
        <div className="flex items-center gap-3">
          <span className={`shrink-0 grid h-10 w-10 place-items-center rounded-kaza ${iconColor}/10`}>
            <span className={iconColor}>{icon}</span>
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold text-kaza-text">{title}</h3>
            <p className="mt-0.5 text-xs text-kaza-muted">{emptyMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link href={href} className={`kaza-card p-4 hover:shadow-card-hover transition-shadow border ${borderColor} ${bgColor}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`shrink-0 grid h-10 w-10 place-items-center rounded-kaza ${iconColor}/10`}>
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold text-kaza-text">{title}</h3>
            <p className="mt-0.5 text-xs text-kaza-muted">{description}</p>
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${badgeColor}`}>
            {count}
          </span>
          <Button size="sm" variant={variant === 'danger' ? 'danger' : variant === 'warning' ? 'success' : 'primary'} className="btn-responsive-sm">
            {ctaLabel}
          </Button>
        </div>
      </div>
    </Link>
  );
}

function PropertyStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { bg: string; text: string; label: string }> = {
    occupee: { bg: 'bg-kaza-success/10', text: 'text-kaza-success', label: 'Occupée' },
    libre: { bg: 'bg-kaza-muted/10', text: 'text-kaza-muted', label: 'Libre' },
    en_visite: { bg: 'bg-kaza-warning/10', text: 'text-kaza-warning', label: 'En visite' },
    maintenance: { bg: 'bg-kaza-danger/10', text: 'text-kaza-danger', label: 'Maintenance' },
  };
  const cfg = configs[status] ?? configs.libre;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

export default function LandlordDashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState<LandlordDashboardStats | null>(null);
  const [recentPayments, setRecentPayments] = useState<PaymentWithRelations[]>([]);
  const [recentReceipts, setRecentReceipts] = useState<ReceiptWithRelations[]>([]);
  const [recentLeases, setRecentLeases] = useState<LeaseWithRelations[]>([]);
  const [recentResidences, setRecentResidences] = useState<ResidenceWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [s, p, rec, l, r] = await Promise.all([
        getLandlordDashboardStats(),
        listMyPayments(),
        listMyReceipts(),
        listMyLeases(),
        listMyResidences(),
      ]);
      setStats(s);
      setRecentPayments(p.filter((x) => x.status === 'pending').slice(0, 3));
      setRecentReceipts(rec.filter((x) => x.status === 'pending_signature').slice(0, 3));
      setRecentLeases(l.filter((x) => x.status === 'active').slice(0, 4));
      setRecentResidences(r.slice(0, 4));
    } catch (err) {
      apiToast(toast, err, 'Chargement du tableau de bord impossible');
      setError('Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-4 text-center">
        <div>
          <AlertCircle className="mx-auto h-12 w-12 text-kaza-danger" aria-hidden />
          <h1 className="mt-4 font-display text-xl font-semibold text-kaza-text">Erreur de chargement</h1>
          <p className="mt-2 text-sm text-kaza-muted">{error ?? 'Données indisponibles'}</p>
          <Button onClick={load} className="mt-4" size="lg">
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  const occupationRate = stats.total_properties > 0
    ? Math.round((stats.occupied / stats.total_properties) * 100)
    : 0;

  const collectionRate = stats.total_monthly_rent > 0
    ? Math.round((stats.collected_this_month / stats.total_monthly_rent) * 100)
    : 100;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">
            Tableau de bord
          </h1>
<p className="mt-1 text-sm text-kaza-muted">
            Bienvenue {user?.full_name ?? 'Bailleur'} &mdash; Vue d&apos;ensemble de votre patrimoine
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link href="/landlord/residences/new">
            <Button className="btn-responsive">
              <Plus className="h-4 w-4" aria-hidden />
              Nouveau bien
            </Button>
          </Link>
        </div>
      </div>

      {/* SECTION KPI */}
      <section aria-labelledby="kpi-title" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <h2 id="kpi-title" className="sr-only">Indicateurs clés</h2>
        <KPICard
          label="Biens totaux"
          value={stats.total_properties}
          icon={<Building2 className="h-5 w-5" aria-hidden />}
          href="/landlord"
          trend={stats.total_properties > 0 ? { value: `${occupationRate}% occupés`, positive: true } : undefined}
        />
        <KPICard
          label="Loyers attendus / mois"
          value={formatXof(stats.total_monthly_rent)}
          icon={<DollarSign className="h-5 w-5" aria-hidden />}
          trend={stats.total_monthly_rent > 0 ? { value: `${collectionRate}% encaissé`, positive: collectionRate >= 80 } : undefined}
        />
        <KPICard
          label="Encaissé ce mois"
          value={formatXof(stats.collected_this_month)}
          icon={<TrendingUp className="h-5 w-5" aria-hidden />}
        />
        <KPICard
          label="Impayés"
          value={formatXof(stats.overdue_total)}
          icon={<AlertCircle className="h-5 w-5" aria-hidden />}
          href="/landlord"
          trend={stats.overdue_count > 0 ? { value: `${stats.overdue_count} bail${stats.overdue_count > 1 ? 'x' : ''}`, positive: false } : { value: 'À jour', positive: true }}
        />
        <KPICard
          label="Dépenses ce mois"
          value={formatXof(stats.expenses_this_month ?? 0)}
          icon={<Minus className="h-5 w-5" aria-hidden />}
          href="/landlord/expenses"
        />
        <KPICard
          label="À traiter"
          value={
            <>
              {stats.pending_receipts + stats.upcoming_due_7d + recentPayments.length}
            </>
          }
          icon={<FileSignature className="h-5 w-5" aria-hidden />}
          href="/landlord/actions"
        />
      </section>

      {/* SECTION "À TRAITER" */}
      <section aria-labelledby="actions-title" className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <h2 id="actions-title" className="font-display text-lg font-semibold text-kaza-text">
          <FileSignature className="h-5 w-5 inline-block text-kaza-brand" aria-hidden />
          À traiter en priorité
        </h2>
        <ActionCard
          title="Impayés"
          count={stats.overdue_count}
          icon={<AlertCircle className="h-5 w-5" aria-hidden />}
          description={`${stats.overdue_count} bail${stats.overdue_count > 1 ? 'x' : ''} en retard — ${formatXof(stats.overdue_total)}`}
          href="/landlord"
          ctaLabel="Voir les impayés"
          variant="danger"
          emptyMessage="Aucun impayé — tout est à jour ✓"
        />
        <ActionCard
          title="Paiements à valider"
          count={recentPayments.length}
          icon={<CreditCard className="h-5 w-5" aria-hidden />}
          description={`${recentPayments.length} paiement${recentPayments.length > 1 ? 's' : ''} en attente de confirmation`}
          href="/landlord"
          ctaLabel="Valider"
          variant="warning"
          emptyMessage="Aucun paiement en attente"
        />
        <ActionCard
          title="Quittances à signer"
          count={stats.pending_receipts}
          icon={<FileSignature className="h-5 w-5" aria-hidden />}
          description={`${stats.pending_receipts} quittance${stats.pending_receipts > 1 ? 's' : ''} en attente de signature`}
          href="/landlord"
          ctaLabel="Signer"
          variant="default"
          emptyMessage="Toutes les quittances sont signées"
        />
        <ActionCard
          title="Échéances (7 jours)"
          count={stats.upcoming_due_7d}
          icon={<Calendar className="h-5 w-5" aria-hidden />}
          description={`${stats.upcoming_due_7d} bail${stats.upcoming_due_7d > 1 ? 'x' : ''} arrive${stats.upcoming_due_7d > 1 ? 'nt' : 'nt'} à échéance`}
          href="/landlord"
          ctaLabel="Voir les baux"
          variant="default"
          emptyMessage="Aucune échéance proche"
        />
        <ActionCard
          title="Dépenses"
          count={0}
          icon={<Minus className="h-5 w-5" aria-hidden />}
          description="Gérer charges, travaux, taxes"
          href="/landlord/expenses"
          ctaLabel="Voir les dépenses"
          variant="default"
          emptyMessage="Aucune dépense enregistrée"
        />
      </section>

      {/* SECTION "MON PORTEFEUILLE" */}
      <section aria-labelledby="portfolio-title" className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 id="portfolio-title" className="flex items-center gap-2 font-display text-base font-semibold text-kaza-text">
            <Building2 className="h-5 w-5 text-kaza-brand" aria-hidden />
            Mon portefeuille — {stats.total_properties} bien{stats.total_properties > 1 ? 's' : ''}
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="kaza-card p-3">
              <div className="flex items-center gap-2">
                <PropertyStatusBadge status="occupee" />
                <span className="text-sm font-medium text-kaza-text">Occupés</span>
                <span className="ml-auto text-lg font-bold text-kaza-success">{stats.occupied}</span>
              </div>
            </div>
            <div className="kaza-card p-3">
              <div className="flex items-center gap-2">
                <PropertyStatusBadge status="libre" />
                <span className="text-sm font-medium text-kaza-text">Libres</span>
                <span className="ml-auto text-lg font-bold text-kaza-muted">{stats.vacant}</span>
              </div>
            </div>
            <div className="kaza-card p-3">
              <div className="flex items-center gap-2">
                <PropertyStatusBadge status="en_visite" />
                <span className="text-sm font-medium text-kaza-text">En visite</span>
                <span className="ml-auto text-lg font-bold text-kaza-warning">{stats.in_visit}</span>
              </div>
            </div>
            <div className="kaza-card p-3">
              <div className="flex items-center gap-2">
                <PropertyStatusBadge status="maintenance" />
                <span className="text-sm font-medium text-kaza-text">Maintenance</span>
                <span className="ml-auto text-lg font-bold text-kaza-danger">{stats.maintenance}</span>
              </div>
            </div>
          </div>

          {recentResidences.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-kaza-text">Derniers biens</h3>
              <ul className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                {recentResidences.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 rounded-kaza border border-kaza-border bg-kaza-surface p-2.5 hover:bg-kaza-raised transition-colors">
                    <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-kaza bg-kaza-raised">
                      {r.photos[0] ? (
                        <img src={r.photos[0]} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Home className="h-full w-full text-kaza-faint" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-kaza-text">{r.title}</p>
                      <p className="truncate text-xs text-kaza-muted">{r.zone ?? ''} {r.city}</p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <PropertyStatusBadge status={r.status} />
                      <span className="text-xs font-medium text-kaza-brand">{formatXof(r.price_monthly)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ACTIVITÉ RÉCENTE */}
        <div>
          <h2 id="activity-title" className="flex items-center gap-2 font-display text-base font-semibold text-kaza-text">
            <TrendingUp className="h-5 w-5 text-kaza-brand" aria-hidden />
            Activité récente
          </h2>
          <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
            {[
              ...recentPayments.map((p) => ({
                key: `payment-${p.id}`,
                icon: <CreditCard className="h-4 w-4 text-kaza-brand" aria-hidden />,
                title: `Paiement ${formatXof(p.amount)} — ${p.provider}`,
                subtitle: `Période ${formatDate(p.period_start)} → ${formatDate(p.period_end)}`,
                action: <Link href="/landlord"><Button size="sm" variant="ghost" className="btn-responsive-sm">Valider</Button></Link>,
                variant: 'warning' as const,
              })),
              ...recentReceipts.map((r) => ({
                key: `receipt-${r.id}`,
                icon: <FileSignature className="h-4 w-4 text-kaza-brand" aria-hidden />,
                title: `Quittance ${formatXof(r.amount)}`,
                subtitle: `Période ${formatDate(r.period_start)} → ${formatDate(r.period_end)}`,
                action: <Link href="/landlord"><Button size="sm" variant="ghost" className="btn-responsive-sm">Signer</Button></Link>,
                variant: 'default' as const,
              })),
              ...recentLeases.slice(0, 2).map((l) => ({
                key: `lease-${l.id}`,
                icon: <KeyRound className="h-4 w-4 text-kaza-success" aria-hidden />,
                title: `Bail actif — ${l.residence?.title}`,
                subtitle: `Locataire : ${l.tenant?.full_name} · Couvert jusqu'au ${formatDate(l.date_fn_couverture)}`,
                action: null,
                variant: 'default' as const,
              })),
            ].length === 0 ? (
              <div className="text-center py-8 text-kaza-muted">
                <EmptyState title="Aucune activité récente" body="Tout est à jour. Les nouvelles actions apparaîtront ici." />
              </div>
            ) : (
              [...recentPayments.map((p) => ({
                key: `payment-${p.id}`,
                icon: <CreditCard className="h-4 w-4 text-kaza-brand" aria-hidden />,
                title: `Paiement ${formatXof(p.amount)} — ${p.provider}`,
                subtitle: `Période ${formatDate(p.period_start)} → ${formatDate(p.period_end)}`,
                action: <Link href="/landlord"><Button size="sm" variant="ghost" className="btn-responsive-sm">Valider</Button></Link>,
                variant: 'warning' as const,
              })),
              ...recentReceipts.map((r) => ({
                key: `receipt-${r.id}`,
                icon: <FileSignature className="h-4 w-4 text-kaza-brand" aria-hidden />,
                title: `Quittance ${formatXof(r.amount)}`,
                subtitle: `Période ${formatDate(r.period_start)} → ${formatDate(r.period_end)}`,
                action: <Link href="/landlord"><Button size="sm" variant="ghost" className="btn-responsive-sm">Signer</Button></Link>,
                variant: 'default' as const,
              })),
              ...recentLeases.slice(0, 2).map((l) => ({
                key: `lease-${l.id}`,
                icon: <KeyRound className="h-4 w-4 text-kaza-success" aria-hidden />,
                title: `Bail actif — ${l.residence?.title}`,
                subtitle: `Locataire : ${l.tenant?.full_name} · Couvert jusqu'au ${formatDate(l.date_fn_couverture)}`,
                action: null,
                variant: 'default' as const,
              })),
            ]).map((item) => (
              <div key={item.key} className="flex items-start gap-3 rounded-kaza border border-kaza-border bg-kaza-surface p-3">
                <span className={`shrink-0 grid h-8 w-8 place-items-center rounded-kaza ${item.variant === 'warning' ? 'bg-kaza-warning/10' : 'bg-kaza-brand/10'}`}>
                  {item.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-kaza-text">{item.title}</p>
                  <p className="truncate text-xs text-kaza-muted">{item.subtitle}</p>
                </div>
                {item.action && <div className="shrink-0">{item.action}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// Type import for dashboard stats
import type { LandlordDashboardStats } from '@/lib/api/dashboard';