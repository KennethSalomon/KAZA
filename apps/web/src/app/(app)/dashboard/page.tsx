'use client';

import { useCallback, useEffect, useState } from 'react';
import { redirect } from 'next/navigation';
import { AlertTriangle, CreditCard, FileDown, KeyRound } from 'lucide-react';
import { listMyLeases, listMyPayments, listMyReceipts, getSignedStorageUrl } from '@/lib/supabase-api';
import { useAuth } from '@/lib/auth-context';
import type { Lease, Payment, Receipt } from '@/lib/types';
import { formatXof, formatDate, PROVIDER_LABELS } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PaymentModal } from '@/components/payment/payment-modal';

export default function TenantDashboardPage() {
  const { user, role, loading } = useAuth();
  const [leases, setLeases] = useState<Lease[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [payLease, setPayLease] = useState<Lease | null>(null);

  const load = useCallback(async () => {
    try {
      const [l, p, r] = await Promise.all([
        listMyLeases(),
        listMyPayments(),
        listMyReceipts(),
      ]);
      setLeases(l);
      setPayments(p);
      setReceipts(r);
    } catch {
      // silencieux : l'espace s'affiche vide en cas d'erreur
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) void load();
  }, [loading, load]);

  if (!loading && !user) redirect('/login');
  if (!loading && user && role === 'bailleur') redirect('/landlord');

  const active = leases.filter((l) => l.status === 'active');
  const overdue = active.filter((l) => new Date(l.date_fn_couverture) < new Date()); // note : couverture expirée -> impayé
  const latestPayment = payments.find((p) => p.status === 'confirmed');

  if (dataLoading || loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">
        Bonjour {user?.full_name.split(' ')[0]}
      </h1>
      <p className="mt-1 text-sm text-kaza-muted">Votre espace locataire — loyers, paiements, quittances.</p>

      {/* Alerte impayé */}
      {overdue.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 rounded-kaza-lg border border-kaza-danger/30 bg-kaza-danger/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-kaza-danger" aria-hidden />
            <div>
              <p className="font-medium text-kaza-text">Un loyer est en retard</p>
              <p className="text-sm text-kaza-muted">
                Celui de « {overdue[0].residence?.title} » — couverture expirée le {formatDate(overdue[0].date_fn_couverture)}. Régularisez pour éviter la relance au bailleur.
              </p>
            </div>
          </div>
          <Button onClick={() => setPayLease(overdue[0])} className="shrink-0">
            Payer maintenant
          </Button>
        </div>
      )}

      {/* Baux actifs */}
      <section className="mt-8" aria-labelledby="leases">
        <h2 id="leases" className="font-display text-lg font-semibold text-kaza-text">
          Mes baux <span className="text-kaza-faint">({active.length})</span>
        </h2>
        <div className="mt-3 space-y-3">
          {active.length === 0 && (
            <EmptyState
              title="Aucun bail actif"
              body="Aucune location en cours. Explorez les biens disponibles pour votre prochain logement."
            />
          )}
          {active.map((l) => (
            <div key={l.id} className="kaza-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-kaza border border-kaza-brand/25 bg-kaza-brand/10 text-kaza-brand">
                  <KeyRound className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="font-medium text-kaza-text">{l.residence?.title ?? 'Bien'}</p>
                  <p className="text-xs text-kaza-muted">
                    Loyer {formatXof(l.monthly_rent)}/mois · couverture jusqu'au {formatDate(l.date_fn_couverture)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {new Date(l.date_fn_couverture) < new Date() ? (
                  <span className="rounded-full border border-kaza-danger/30 bg-kaza-danger/10 px-2.5 py-0.5 text-[11px] font-medium text-kaza-danger">
                    Impayé
                  </span>
                ) : (
                  <span className="rounded-full border border-kaza-success/30 bg-kaza-success/10 px-2.5 py-0.5 text-[11px] font-medium text-kaza-success">
                    À jour
                  </span>
                )}
                <Button size="sm" onClick={() => setPayLease(l)} data-testid="pay-loyer">
                  <CreditCard className="h-4 w-4" aria-hidden />
                  Payer
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Historique */}
      <section className="mt-10 grid gap-6 lg:grid-cols-2" aria-labelledby="history">
        <div>
          <h2 id="history" className="font-display text-lg font-semibold text-kaza-text">Paiements récents</h2>
          <ul className="mt-3 space-y-2">
            {payments.slice(0, 6).map((p) => (
              <li key={p.id} className="kaza-card flex items-center justify-between px-4 py-3">
                <div>
                  <p className="price text-sm font-semibold text-kaza-text">{formatXof(p.amount)}</p>
                  <p className="text-xs text-kaza-faint">
                    {p.period_start} → {p.period_end} · {PROVIDER_LABELS[p.provider]}
                  </p>
                </div>
                <PaymentStatusBadge status={p.status} />
              </li>
            ))}
            {payments.length === 0 && <p className="text-sm text-kaza-faint">Aucun paiement pour le moment.</p>}
          </ul>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold text-kaza-text">Mes quittances</h2>
          <ul className="mt-3 space-y-2">
            {receipts.slice(0, 6).map((r) => (
              <li key={r.id} className="kaza-card flex items-center justify-between px-4 py-3">
                <div>
                  <p className="price text-sm font-semibold text-kaza-text">{formatXof(r.amount)}</p>
                  <p className="text-xs text-kaza-faint">
                    {r.period_start} → {r.period_end} · {r.status === 'signed' ? 'signée' : 'en attente de signature'}
                  </p>
                </div>
                {r.status === 'signed' && r.file_url ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    data-testid="download-receipt"
                    onClick={async () => {
                      const signed = await getSignedStorageUrl('receipts', r.file_url as string);
                      if (signed) window.open(signed, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    <FileDown className="h-4 w-4" aria-hidden />
                    PDF
                  </Button>
                ) : (
                  <span className="text-xs text-kaza-faint">dès validation bailleur</span>
                )}
              </li>
            ))}
            {receipts.length === 0 && (
              <p className="text-sm text-kaza-faint">
                Vos quittances signées apparaîtront ici après chaque paiement validé.
              </p>
            )}
          </ul>
        </div>
      </section>

      {latestPayment && (
        <p className="mt-8 text-xs text-kaza-faint">
          Dernier paiement confirmé : {formatDate(latestPayment.created_at)}
        </p>
      )}

      {payLease && (
        <PaymentModal
          lease={payLease}
          open={Boolean(payLease)}
          onClose={() => setPayLease(null)}
          onPaid={() => void load()}
        />
      )}
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: Payment['status'] }) {
  const map = {
    pending: ['En attente', 'bg-kaza-warning/10 text-kaza-warning border-kaza-warning/30'],
    confirmed: ['Confirmé', 'bg-kaza-success/10 text-kaza-success border-kaza-success/30'],
    rejected: ['Rejeté', 'bg-kaza-danger/10 text-kaza-danger border-kaza-danger/30'],
  } as const;
  const [label, cls] = map[status];
  return <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>;
}