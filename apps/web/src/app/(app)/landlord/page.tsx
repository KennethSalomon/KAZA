'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  Clock,
  CreditCard,
  FileSignature,
  Home,
  PenSquare,
  Plus,
  ShieldCheck,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react';
import {
  listMyResidences,
  listMyPayments,
  listMyReceipts,
  listMyLeases,
  confirmPayment as confirmPaymentApi,
  rejectPayment as rejectPaymentApi,
  signReceipt as signReceiptApi,
  terminateLease as terminateLeaseApi,
} from '@/lib/supabase-api';
import { useAuth } from '@/lib/auth-context';
import type {
  ReceiptWithRelations,
  ResidenceWithRelations,
  PaymentWithRelations,
  LeaseWithRelations,
} from '@/lib/types';
import { formatXof, formatDate, PROVIDER_LABELS } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { residenceCompleteness, CompletenessBar } from '@/components/property/residence-completeness';
import { apiToast } from '@/lib/api-toast';
import { KpiCard } from '@/components/modules/kpi-card';
import { CashflowChart } from '@/components/modules/cashflow-chart';
import {
  DashboardFilters,
  startForPeriod,
  type PeriodKey,
} from '@/components/modules/dashboard-filters';
import { openTenantReminder } from '@/lib/utils/tenant-reminder';

// note : Le taux d'occupation ne considère que les biens publiés — un brouillon
// non visible ne pèse pas dans le ratio pour ne pas pénaliser les bailleurs débutants.
function computeOccupancyRate(residences: ResidenceWithRelations[]): number {
  const published = residences.filter((r) => r.is_published);
  if (published.length === 0) return 0;
  const occupied = published.filter((r) => r.status === 'occupee').length;
  return Math.round((occupied / published.length) * 100);
}

export default function LandlordHomePage() {
  const { user } = useAuth();
  const toast = useToast();
  const [residences, setResidences] = useState<ResidenceWithRelations[]>([]);
  const [allPayments, setAllPayments] = useState<PaymentWithRelations[]>([]);
  const [pendingReceipts, setPendingReceipts] = useState<ReceiptWithRelations[]>([]);
  const [leases, setLeases] = useState<LeaseWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [residenceFilter, setResidenceFilter] = useState<string | 'all'>('all');

  const load = useCallback(async () => {
    try {
      const [r, p, rec, l] = await Promise.all([
        listMyResidences(),
        listMyPayments(),    // note : tous statuts — filtrage KPI côté client
        listMyReceipts(),
        listMyLeases(),
      ]);
      setResidences(r);
      setAllPayments(p);
      setPendingReceipts(rec.filter((x) => x.status === 'pending_signature'));
      setLeases(l.filter((x) => x.status === 'active'));
    } catch (err) {
      apiToast(toast, err, 'Chargement de l’espace bailleur impossible');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmPayment(paymentId: string) {
    setBusyId(paymentId);
    try {
      await confirmPaymentApi(paymentId);
      toast.success('Paiement confirmé');
      await load();
    } catch (err) {
      apiToast(toast, err, 'Confirmation impossible');
    } finally {
      setBusyId(null);
    }
  }

  async function signReceipt(receiptId: string) {
    setBusyId(receiptId);
    try {
      await signReceiptApi(receiptId);
      toast.success('Quittance signée');
      await load();
    } catch (err) {
      apiToast(toast, err, 'Signature impossible');
    } finally {
      setBusyId(null);
    }
  }

  async function rejectPayment(paymentId: string) {
    setBusyId(paymentId);
    try {
      await rejectPaymentApi(paymentId);
      toast.success('Paiement rejeté');
      await load();
    } catch (err) {
      apiToast(toast, err, 'Rejet impossible');
    } finally {
      setBusyId(null);
    }
  }

  function remindTenant(lease: LeaseWithRelations) {
    const res = openTenantReminder({
      tenantName: lease.tenant?.full_name,
      tenantPhone: lease.tenant?.phone,
      residenceTitle: lease.residence?.title,
      monthlyRent: lease.monthly_rent,
      dueDate: formatDate(lease.date_fn_couverture),
    });
    if (res.channel === 'none') {
      toast.error('Numéro locataire manquant');
    } else if (res.channel === 'whatsapp') {
      toast.success('WhatsApp ouvert avec le rappel prêt à envoyer');
    } else {
      toast.success('SMS ouvert avec le rappel prêt à envoyer');
    }
  }

  async function terminateLease(leaseId: string) {
    setBusyId(leaseId);
    try {
      await terminateLeaseApi(leaseId);
      toast.success('Bail résilié');
      await load();
    } catch (err) {
      apiToast(toast, err, 'Résiliation impossible');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
    );
  }

  // ── Filtres période + bien ────────────────────────────────────────────────
  const periodStart = startForPeriod(period);
  const isSelectedResidence = (residenceId: string | null | undefined): boolean =>
    residenceFilter === 'all' || residenceId === residenceFilter;

  const filteredPayments = allPayments.filter((p) => {
    if (!isSelectedResidence(p.lease?.residence_id ?? null)) return false;
    return new Date(p.period_start) >= periodStart;
  });
  const filteredLeases = leases.filter((l) => isSelectedResidence(l.residence_id));
  const filteredResidences =
    residenceFilter === 'all'
      ? residences
      : residences.filter((r) => r.id === residenceFilter);

  // ── KPIs calculés sur la sélection ────────────────────────────────────────
  const pendingPayments = filteredPayments.filter((p) => p.status === 'pending');

  const totalEncaisse = filteredPayments
    .filter((p) => p.status === 'confirmed')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalAttente = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

  // note : un bail actif dont la couverture a expiré = impayé en cours
  const overdueCount = filteredLeases.filter(
    (l) => new Date(l.date_fn_couverture) < new Date(),
  ).length;

  const occupancyRate = computeOccupancyRate(filteredResidences);
  // ─────────────────────────────────────────────────────────────────────────

  const prenom = user?.full_name.split(' ')[0] ?? 'Bailleur';
  // note : onboarding_completed n'est renseigné qu'après la migration 023.
  // Un profil legacy sans la colonne renverra undefined → on affiche la bannière
  // par prudence (pas de faux négatif : mieux vaut proposer que masquer).
  const needsOnboarding = user?.onboarding_completed === false;

  return (
    <div className="space-y-8">
      {needsOnboarding && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-kaza-lg border border-kaza-peach/50 bg-kaza-peach/15 p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-kaza bg-kaza-vert text-white">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="font-medium text-kaza-text">Complétez votre espace bailleur</p>
              <p className="text-sm text-kaza-muted">
                Renseignez votre numéro Mobile Money pour encaisser les loyers en toute sécurité.
                3 minutes chrono.
              </p>
            </div>
          </div>
          <Link href="/onboarding" className="shrink-0">
            <Button variant="cta" className="btn-responsive">
              Compléter mon profil
            </Button>
          </Link>
        </div>
      )}

      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight text-kaza-text">
            Bonjour, {prenom}
            {user?.is_premium && (
              <ShieldCheck className="h-5 w-5 text-kaza-mint" aria-label="Bailleur vérifié" />
            )}
          </h1>
          <p className="mt-1 text-sm text-kaza-muted">
            {user?.is_premium ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-kaza-peach/60 bg-kaza-peach/20 px-2.5 py-0.5 text-xs font-medium text-kaza-brand-dark">
                Premium
              </span>
            ) : (
              'Plan gratuit · 1 bien en ligne'
            )}{' '}
            · {residences.length} bien{residences.length > 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/landlord/residences/new">
          <Button className="btn-responsive">
            <Plus className="h-4 w-4" aria-hidden />
            Ajouter un bien
          </Button>
        </Link>
      </div>

      {/* ── Filtres période + bien ──────────────────────────────────────── */}
      <DashboardFilters
        period={period}
        onPeriodChange={setPeriod}
        residenceId={residenceFilter}
        onResidenceChange={setResidenceFilter}
        residences={residences}
      />

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <section aria-label="Indicateurs financiers">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            title="Total encaissé"
            value={formatXof(totalEncaisse)}
            subtitle="Paiements confirmés"
            icon={<TrendingUp className="h-5 w-5" aria-hidden />}
            variant="vert"
          />
          <KpiCard
            title="En attente"
            value={formatXof(totalAttente)}
            subtitle={`${pendingPayments.length} paiement${pendingPayments.length !== 1 ? 's' : ''} à valider`}
            icon={<Clock className="h-5 w-5" aria-hidden />}
            variant="amber"
          />
          <KpiCard
            title="Impayés actuels"
            value={overdueCount}
            subtitle={
              overdueCount === 0
                ? 'Tout est à jour 🎉'
                : `${overdueCount} bail(s) en retard aujourd'hui`
            }
            icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
            variant={overdueCount > 0 ? 'red' : 'mint'}
          />
          <KpiCard
            title="Taux d'occupation"
            value={`${occupancyRate} %`}
            subtitle={`${residences.filter((r) => r.status === 'occupee').length} / ${residences.filter((r) => r.is_published).length} biens loués`}
            icon={<BarChart3 className="h-5 w-5" aria-hidden />}
            variant="mint"
          />
        </div>
      </section>

      {/* ── Graphique 12 mois — visible seulement en vue "Année" ou "Tout" ─ */}
      {period === 'year' || period === 'all' ? (
        <CashflowChart
          payments={allPayments}
          leases={leases}
          residenceId={residenceFilter === 'all' ? undefined : residenceFilter}
        />
      ) : (
        <div className="rounded-kaza border border-dashed border-kaza-border bg-kaza-raised/40 px-5 py-4 text-xs text-kaza-muted">
          Sélectionnez <strong className="font-semibold text-kaza-text">Année</strong> ou{' '}
          <strong className="font-semibold text-kaza-text">Tout</strong> pour afficher le
          graphique des loyers 12 mois.
        </div>
      )}

      {/* Rappel de complétude */}
      {(() => {
        const incomplete = residences.filter((r) => residenceCompleteness(r).percent < 100);
        if (residences.length === 0 || incomplete.length === 0) return null;
        const focus = [...incomplete].sort(
          (a, b) => residenceCompleteness(a).percent - residenceCompleteness(b).percent,
        )[0];
        if (!focus) return null;
        return (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-kaza border border-kaza-warning/30 bg-kaza-warning/10 px-4 py-3">
            <p className="flex items-center gap-2 text-sm text-kaza-text">
              <PenSquare className="h-4 w-4 shrink-0 text-kaza-warning" aria-hidden />
              <span>
                <strong className="font-semibold">
                  {incomplete.length} bien{incomplete.length > 1 ? 's' : ''} incomplet
                  {incomplete.length > 1 ? 's' : ''}
                </strong>{' '}
                — des annonces complètes sont approuvées plus vite.
              </span>
            </p>
            <Link href={`/landlord/residences/${focus.id}/edit`} className="shrink-0">
              <Button variant="secondary" className="btn-responsive-sm" size="sm">
                Compléter l&apos;annonce
              </Button>
            </Link>
          </div>
        );
      })()}

      {/* Actions urgentes */}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="kaza-card p-5" aria-labelledby="paiements">
          <div className="flex items-center justify-between">
            <h2
              id="paiements"
              className="flex items-center gap-2 font-display text-base font-semibold text-kaza-text"
            >
              <CreditCard className="h-4 w-4 text-kaza-brand" aria-hidden />
              Paiements à valider
              {pendingPayments.length > 0 && (
                <span className="rounded-full bg-kaza-warning/15 px-2 py-0.5 text-[11px] font-bold text-kaza-warning tabular-nums">
                  {pendingPayments.length}
                </span>
              )}
            </h2>
          </div>
          <ul className="mt-3 space-y-2">
            {pendingPayments.slice(0, 4).map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-kaza border border-kaza-border bg-kaza-bg px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="price text-sm font-semibold text-kaza-text">{formatXof(p.amount)}</p>
                  <p className="truncate text-xs text-kaza-faint">
                    {PROVIDER_LABELS[p.provider]} · {p.period_start} → {p.period_end}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="success"
                    className="btn-responsive-sm"
                    loading={busyId === p.id}
                    onClick={() => void confirmPayment(p.id)}
                    data-testid={`confirm-payment-${p.id}`}
                  >
                    Valider
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    className="btn-responsive-sm touch-target"
                    loading={busyId === p.id}
                    onClick={() => void rejectPayment(p.id)}
                    data-testid={`reject-payment-${p.id}`}
                  >
                    <XCircle className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
            {pendingPayments.length === 0 && (
              <li className="text-sm text-kaza-faint">Aucun paiement en attente. 🎉</li>
            )}
          </ul>
        </section>

        <section className="kaza-card p-5" aria-labelledby="quittances">
          <h2
            id="quittances"
            className="flex items-center gap-2 font-display text-base font-semibold text-kaza-text"
          >
            <FileSignature className="h-4 w-4 text-kaza-brand" aria-hidden />
            Quittances à signer
            {pendingReceipts.length > 0 && (
              <span className="rounded-full bg-kaza-warning/15 px-2 py-0.5 text-[11px] font-bold text-kaza-warning tabular-nums">
                {pendingReceipts.length}
              </span>
            )}
          </h2>
          <ul className="mt-3 space-y-2">
            {pendingReceipts.slice(0, 4).map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-kaza border border-kaza-border bg-kaza-bg px-3.5 py-2.5"
              >
                <div>
                  <p className="price text-sm font-semibold text-kaza-text">{formatXof(r.amount)}</p>
                  <p className="text-xs text-kaza-faint">
                    Quittance {r.period_start} → {r.period_end}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="btn-responsive-sm"
                  loading={busyId === r.id}
                  onClick={() => void signReceipt(r.id)}
                  data-testid={`sign-receipt-${r.id}`}
                >
                  Émettre la quittance
                </Button>
              </li>
            ))}
            {pendingReceipts.length === 0 && (
              <li className="text-sm text-kaza-faint">Toutes vos quittances sont signées.</li>
            )}
          </ul>
        </section>
      </div>

      {/* Baux actifs */}
      {filteredLeases.length > 0 && (
        <section aria-labelledby="baux">
          <h2 id="baux" className="font-display text-lg font-semibold text-kaza-text">
            Locations en cours <span className="text-kaza-faint">({filteredLeases.length})</span>
          </h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {filteredLeases.map((l) => {
              const overdue = new Date(l.date_fn_couverture) < new Date();
              return (
                <li
                  key={l.id}
                  className="kaza-card flex items-center justify-between px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-kaza-text">
                      {l.residence?.title}
                    </p>
                    <p className="text-xs text-kaza-faint">
                      {l.tenant?.full_name} · {formatXof(l.monthly_rent)}/mois
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {overdue ? (
                      <span className="flex items-center gap-1 rounded-full border border-kaza-danger/30 bg-kaza-danger/10 px-2 py-0.5 text-[11px] font-medium text-kaza-danger">
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                        Impayé
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-kaza-success">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        jusqu&apos;au {formatDate(l.date_fn_couverture)}
                      </span>
                    )}
                    {overdue && l.tenant?.phone && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="btn-responsive-sm"
                        onClick={() => remindTenant(l)}
                        data-testid={`remind-tenant-${l.id}`}
                        title="Rappeler le locataire via WhatsApp"
                      >
                        <Bell className="h-3.5 w-3.5" aria-hidden />
                        Rappeler
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="danger"
                      className="btn-responsive-sm touch-target"
                      loading={busyId === l.id}
                      onClick={() => void terminateLease(l.id)}
                      data-testid={`terminate-lease-${l.id}`}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Biens */}
      <section aria-labelledby="biens">
        <h2 id="biens" className="font-display text-lg font-semibold text-kaza-text">
          Mes biens <span className="text-kaza-faint">({residences.length})</span>
        </h2>
        {residences.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="Aucun bien enregistré"
              body="Ajoutez votre premier logement : photos, prix, localisation — la recherche géolocalisée s'occupe du reste."
              action={
                <Link href="/landlord/residences/new">
                  <Button className="btn-responsive">
                    <Plus className="h-4 w-4" aria-hidden />
                    Ajouter un bien
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {residences.map((r) => (
              <li key={r.id} className="kaza-card kaza-card-hover overflow-hidden">
                <div className="relative flex h-32 items-end bg-kaza-raised p-3">
                  {r.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.photos[0]}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-kaza-faint">
                      <Home className="h-7 w-7" aria-hidden />
                    </span>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-kaza-bg/90 to-transparent" />
                  <div className="relative flex w-full items-center justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-kaza-text">{r.title}</p>
                      <p className="price text-xs font-medium text-kaza-brand">
                        {formatXof(r.price_monthly)}
                      </p>
                    </div>
                    <span className="shrink-0">
                      {r.is_published && r.is_verified ? (
                        <span className="rounded-full border border-kaza-success/30 bg-kaza-success/10 px-2 py-0.5 text-[10px] font-medium text-kaza-success">
                          • En ligne
                        </span>
                      ) : r.is_published ? (
                        <span className="rounded-full border border-kaza-warning/30 bg-kaza-warning/10 px-2 py-0.5 text-[10px] font-medium text-kaza-warning">
                          En modération
                        </span>
                      ) : (
                        <span className="rounded-full border border-kaza-border px-2 py-0.5 text-[10px] font-medium text-kaza-faint">
                          Brouillon
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-xs text-kaza-muted">
                      {r.zone ?? ''} {r.city}
                    </span>
                    <Link href={`/landlord/residences/${r.id}/edit`} className="shrink-0">
                      <Button variant="ghost" size="sm" className="btn-responsive-sm">
                        <PenSquare className="h-3.5 w-3.5" aria-hidden />
                        Gérer
                      </Button>
                    </Link>
                  </div>
                  <CompletenessBar c={residenceCompleteness(r)} compact />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
