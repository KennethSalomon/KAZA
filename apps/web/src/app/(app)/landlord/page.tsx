'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Home, CheckCircle2, PenSquare, FileSignature, CreditCard, XCircle, X } from 'lucide-react';
import {
  listMyResidences,
  listMyPayments,
  listMyReceipts,
  listMyLeases,
  confirmPayment as confirmPaymentApi,
  rejectPayment as rejectPaymentApi,
  signReceipt as signReceiptApi,
  terminateLease as terminateLeaseApi,
  ApiError,
} from '@/lib/supabase-api';
import { useAuth } from '@/lib/auth-context';
import type { Receipt, Residence, Payment, Lease } from '@/lib/types';
import { formatXof, formatDate, PROVIDER_LABELS } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { residenceCompleteness, CompletenessBar } from '@/components/property/residence-completeness';

export default function LandlordHomePage() {
  const { user } = useAuth();
  const toast = useToast();
  const [residences, setResidences] = useState<Residence[]>([]);
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [pendingReceipts, setPendingReceipts] = useState<Receipt[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, p, rec, l] = await Promise.all([
        listMyResidences(),
        listMyPayments(),
        listMyReceipts(),
        listMyLeases(),
      ]);
      setResidences(r);
      setPendingPayments(p.filter((x) => x.status === 'pending'));
      setPendingReceipts(rec.filter((x) => x.status === 'pending_signature'));
      setLeases(l.filter((x) => x.status === 'active'));
    } catch (err) {
      toast.error('Chargement de l\u2019espace bailleur impossible', err instanceof ApiError ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, []);

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
      toast.error('Confirmation impossible', err instanceof ApiError ? err.message : undefined);
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
      toast.error('Signature impossible', err instanceof ApiError ? err.message : undefined);
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
      toast.error('Rejet impossible', err instanceof ApiError ? err.message : undefined);
    } finally {
      setBusyId(null);
    }
  }

  async function terminateLease(leaseId: string) {
    setBusyId(leaseId);
    try {
      await terminateLeaseApi(leaseId);
      toast.success('Bail résilié');
      await load();
    } catch (err) {
      toast.error('Résiliation impossible', err instanceof ApiError ? err.message : undefined);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">
            Espace bailleur
          </h1>
          <p className="mt-1 text-sm text-kaza-muted">
            {user?.is_premium ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-kaza-peach/60 bg-kaza-peach/20 px-2.5 py-0.5 text-xs font-medium text-kaza-brand-dark">
                Premium
              </span>
            ) : (
              'Plan gratuit : 1 bien en ligne. Premium requis pour en publier davantage.'
            )}{' '}
            · {residences.length} bien{residences.length > 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/landlord/residences/new">
          <Button>
            <Plus className="h-4 w-4" aria-hidden />
            Ajouter un bien
          </Button>
        </Link>
      </div>

      {/* Rappel de complétude */}
      {(() => {
        const incomplete = residences.filter((r) => residenceCompleteness(r).percent < 100);
        if (residences.length === 0 || incomplete.length === 0) return null;
        const focus = [...incomplete].sort((a, b) => residenceCompleteness(a).percent - residenceCompleteness(b).percent)[0];
        return (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-kaza border border-kaza-warning/30 bg-kaza-warning/10 px-4 py-3">
            <p className="flex items-center gap-2 text-sm text-kaza-text">
              <PenSquare className="h-4 w-4 shrink-0 text-kaza-warning" aria-hidden />
              <span>
                <strong className="font-semibold">{incomplete.length} bien{incomplete.length > 1 ? 's' : ''} incomplet{incomplete.length > 1 ? 's' : ''}</strong>
                {' '}— des annonces complètes sont approuvées plus vite.
              </span>
            </p>
            <Link href={`/landlord/residences/${focus.id}/edit`} className="shrink-0">
              <Button variant="secondary" size="sm">
                Compléter l'annonce
              </Button>
            </Link>
          </div>
        );
      })()}

      {/* Actions urgentes */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="kaza-card p-5" aria-labelledby="paiements">
          <div className="flex items-center justify-between">
            <h2 id="paiements" className="flex items-center gap-2 font-display text-base font-semibold text-kaza-text">
              <CreditCard className="h-4.5 w-4.5 text-kaza-brand" aria-hidden />
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
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-kaza border border-kaza-border bg-kaza-bg px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="price text-sm font-semibold text-kaza-text">{formatXof(p.amount)}</p>
                  <p className="truncate text-xs text-kaza-faint">
                    {PROVIDER_LABELS[p.provider]} · {p.period_start} → {p.period_end}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="success" loading={busyId === p.id} onClick={() => void confirmPayment(p.id)} data-testid={`confirm-payment-${p.id}`}>
                    Valider
                  </Button>
                  <Button size="sm" variant="danger" loading={busyId === p.id} onClick={() => void rejectPayment(p.id)} data-testid={`reject-payment-${p.id}`}>
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
          <h2 id="quittances" className="flex items-center gap-2 font-display text-base font-semibold text-kaza-text">
            <FileSignature className="h-4.5 w-4.5 text-kaza-brand" aria-hidden />
            Quittances à signer
            {pendingReceipts.length > 0 && (
              <span className="rounded-full bg-kaza-warning/15 px-2 py-0.5 text-[11px] font-bold text-kaza-warning tabular-nums">
                {pendingReceipts.length}
              </span>
            )}
          </h2>
          <ul className="mt-3 space-y-2">
            {pendingReceipts.slice(0, 4).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-kaza border border-kaza-border bg-kaza-bg px-3.5 py-2.5">
                <div>
                  <p className="price text-sm font-semibold text-kaza-text">{formatXof(r.amount)}</p>
                  <p className="text-xs text-kaza-faint">
                    Quittance {r.period_start} → {r.period_end}
                  </p>
                </div>
                <Button size="sm" loading={busyId === r.id} onClick={() => void signReceipt(r.id)} data-testid={`sign-receipt-${r.id}`}>
                  Signer et envoyer
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
      {leases.length > 0 && (
        <section className="mt-8" aria-labelledby="baux">
          <h2 id="baux" className="font-display text-lg font-semibold text-kaza-text">
            Locations en cours <span className="text-kaza-faint">({leases.length})</span>
          </h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {leases.map((l) => (
              <li key={l.id} className="kaza-card flex items-center justify-between px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-kaza-text">{l.residence?.title}</p>
                  <p className="text-xs text-kaza-faint">
                    {l.tenant?.full_name} · {formatXof(l.monthly_rent)}/mois
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-kaza-success">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    jusqu&apos;au {formatDate(l.date_fn_couverture)}
                  </span>
                  <Button
                    size="sm"
                    variant="danger"
                    loading={busyId === l.id}
                    onClick={() => void terminateLease(l.id)}
                    data-testid={`terminate-lease-${l.id}`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Biens */}
      <section className="mt-8" aria-labelledby="biens">
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
                  <Button>
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
                    <img src={r.photos[0]} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-kaza-faint">
                      <Home className="h-7 w-7" aria-hidden />
                    </span>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-kaza-bg/90 to-transparent" />
                  <div className="relative flex w-full items-center justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-kaza-text">{r.title}</p>
                      <p className="price text-xs font-medium text-kaza-brand">{formatXof(r.price_monthly)}</p>
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
                    <span className="min-w-0 truncate text-xs text-kaza-muted">{r.zone ?? ''} {r.city}</span>
                    <Link href={`/landlord/residences/${r.id}/edit`} className="shrink-0">
                      <Button variant="ghost" size="sm">
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