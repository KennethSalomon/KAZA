'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Clock,
  FileDown,
  FileText,
  Home,
  MapPin,
  Pencil,
  Users,
  XCircle,
} from 'lucide-react';
import {
  getResidence,
  getSignedStorageUrl,
  listMyLeases,
  listMyPayments,
  listMyReceipts,
} from '@/lib/supabase-api';
import type {
  LeaseWithRelations,
  PaymentWithRelations,
  ReceiptWithRelations,
  ResidenceWithRelations,
} from '@/lib/types';
import { formatDate, formatXof, PROVIDER_LABELS, TYPE_LABELS } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { apiToast } from '@/lib/api-toast';
import { cn } from '@/lib/cn';
import {
  HEALTH_META,
  computeResidenceHealth,
} from '@/components/property/property-health';

type TabKey = 'lots' | 'tenants' | 'payments' | 'documents';

const TABS: { id: TabKey; label: string; icon: typeof Boxes }[] = [
  { id: 'lots', label: 'Lots', icon: Boxes },
  { id: 'tenants', label: 'Locataires', icon: Users },
  { id: 'payments', label: 'Historique loyers', icon: Clock },
  { id: 'documents', label: 'Documents', icon: FileText },
];

export default function ResidenceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const toast = useToast();

  const [residence, setResidence] = useState<ResidenceWithRelations | null>(null);
  const [leases, setLeases] = useState<LeaseWithRelations[]>([]);
  const [payments, setPayments] = useState<PaymentWithRelations[]>([]);
  const [receipts, setReceipts] = useState<ReceiptWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('lots');

  const load = useCallback(async () => {
    try {
      const [r, l, p, rec] = await Promise.all([
        getResidence(id),
        listMyLeases(),
        listMyPayments(),
        listMyReceipts(),
      ]);
      setResidence(r);
      setLeases(l);
      setPayments(p);
      setReceipts(rec);
    } catch (err) {
      apiToast(toast, err, 'Bien introuvable ou accès refusé');
      router.push('/landlord/properties');
    } finally {
      setLoading(false);
    }
  }, [id, router, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // note : receipts n'a pas de residence_id direct ; on remonte via lease_id.
  // Les baux liés à cette résidence donnent l'ensemble des IDs à filtrer.
  const residenceLeaseIds = useMemo(
    () => new Set(leases.filter((l) => l.residence_id === id).map((l) => l.id)),
    [leases, id],
  );
  const residenceLeases = useMemo(
    () => leases.filter((l) => l.residence_id === id),
    [leases, id],
  );
  const residencePayments = useMemo(
    () =>
      payments
        .filter((p) => residenceLeaseIds.has(p.lease_id))
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')),
    [payments, residenceLeaseIds],
  );
  const residenceReceipts = useMemo(
    () =>
      receipts
        .filter((r) => residenceLeaseIds.has(r.lease_id))
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')),
    [receipts, residenceLeaseIds],
  );

  const health = useMemo(
    () => (residence ? computeResidenceHealth(residence.id, leases, payments) : null),
    [residence, leases, payments],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-56" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (!residence || !health) return null;

  const totalRent = (residence.price_monthly ?? 0) + (residence.charges_monthly ?? 0);
  const cover = residence.photos[0];
  const healthMeta = HEALTH_META[health.status];

  return (
    <div className="space-y-6">
      {/* Fil d'Ariane + retour */}
      <Link
        href="/landlord/properties"
        className="inline-flex items-center gap-1 text-sm text-kaza-muted hover:text-kaza-brand"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Retour au parc
      </Link>

      {/* Hero */}
      <header className="overflow-hidden rounded-kaza-lg border border-kaza-border bg-white shadow-card">
        <div className="relative h-52 w-full bg-kaza-raised sm:h-64">
          {cover ? (
            <Image src={cover} alt="" fill priority sizes="100vw" className="object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-kaza-faint">
              <Home className="h-10 w-10" aria-hidden />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">
              {residence.title}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-kaza-muted">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {[residence.address, residence.zone, residence.city].filter(Boolean).join(' · ') || '—'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-kaza-border bg-kaza-raised px-2.5 py-0.5 text-[11px] font-semibold text-kaza-muted">
                {TYPE_LABELS[residence.type] ?? residence.type}
              </span>
              {residence.is_published && residence.is_verified ? (
                <span className="rounded-full border border-kaza-mint/30 bg-kaza-mint/10 px-2.5 py-0.5 text-[11px] font-semibold text-kaza-mint">
                  En ligne
                </span>
              ) : residence.is_published ? (
                <span className="rounded-full border border-kaza-warning/30 bg-kaza-warning/10 px-2.5 py-0.5 text-[11px] font-semibold text-kaza-warning">
                  En modération
                </span>
              ) : (
                <span className="rounded-full border border-kaza-border bg-white px-2.5 py-0.5 text-[11px] font-semibold text-kaza-muted">
                  Brouillon
                </span>
              )}
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                  healthMeta.className,
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', healthMeta.dot)} aria-hidden />
                {healthMeta.label}
              </span>
            </div>
          </div>
          <Link href={`/landlord/residences/${residence.id}/edit`}>
            <Button variant="secondary">
              <Pencil className="h-4 w-4" aria-hidden />
              Modifier
            </Button>
          </Link>
        </div>

        {/* Métriques financières */}
        <dl className="grid grid-cols-2 gap-px border-t border-kaza-border bg-kaza-border sm:grid-cols-4">
          <MetricCell label="Loyer hors charges" value={`${formatXof(residence.price_monthly)}/mois`} />
          <MetricCell label="Charges" value={`${formatXof(residence.charges_monthly ?? 0)}/mois`} />
          <MetricCell label="Loyer TTC" value={`${formatXof(totalRent)}/mois`} accent />
          <MetricCell label="Dépôt de garantie" value={formatXof(residence.deposit)} />
        </dl>
      </header>

      {/* Onglets */}
      <div className="border-b border-kaza-border">
        <div role="tablist" aria-label="Détails de la propriété" className="flex flex-wrap gap-1">
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={active}
                aria-controls={`panel-${t.id}`}
                id={`tab-${t.id}`}
                onClick={() => setTab(t.id)}
                className={cn(
                  '-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'border-kaza-vert text-kaza-vert'
                    : 'border-transparent text-kaza-muted hover:text-kaza-text',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panels */}
      {tab === 'lots' && (
        <TabPanel id="lots">
          <LotsPanel residence={residence} health={health} />
        </TabPanel>
      )}
      {tab === 'tenants' && (
        <TabPanel id="tenants">
          <TenantsPanel leases={residenceLeases} />
        </TabPanel>
      )}
      {tab === 'payments' && (
        <TabPanel id="payments">
          <PaymentsPanel payments={residencePayments} />
        </TabPanel>
      )}
      {tab === 'documents' && (
        <TabPanel id="documents">
          <DocumentsPanel receipts={residenceReceipts} onToast={toast} />
        </TabPanel>
      )}
    </div>
  );
}

function TabPanel({ id, children }: Readonly<{ id: string; children: React.ReactNode }>) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`}>
      {children}
    </div>
  );
}

function MetricCell({
  label,
  value,
  accent = false,
}: Readonly<{ label: string; value: string; accent?: boolean }>) {
  return (
    <div className="bg-white p-4">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-kaza-faint">{label}</dt>
      <dd
        className={cn(
          'price mt-1 font-display text-base font-semibold',
          accent ? 'text-kaza-brand' : 'text-kaza-text',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

// ─── Panels ─────────────────────────────────────────────────

function LotsPanel({
  residence,
  health,
}: Readonly<{
  residence: ResidenceWithRelations;
  health: ReturnType<typeof computeResidenceHealth>;
}>) {
  // note : Modèle DB actuel = 1 residence = 1 lot. Ce panneau prépare la vue
  // « immeuble avec plusieurs lots » sans nécessiter de nouvelle table pour le MVP.
  return (
    <div className="rounded-kaza border border-kaza-border bg-white">
      <div className="flex items-center justify-between border-b border-kaza-border px-4 py-3">
        <div>
          <h2 className="font-display text-sm font-semibold text-kaza-text">1 lot</h2>
          <p className="text-xs text-kaza-muted">
            {health.status === 'libre' ? 'Aucune location en cours' : `${health.activeLeases} lot(s) loué(s)`}
          </p>
        </div>
        <span className="text-xs text-kaza-faint">Type : {TYPE_LABELS[residence.type] ?? residence.type}</span>
      </div>
      <ul className="divide-y divide-kaza-border">
        <li className="flex items-center gap-3 px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-kaza bg-kaza-vert/10 text-kaza-vert">
            <Boxes className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-kaza-text">Lot principal</p>
            <p className="text-xs text-kaza-muted">
              {residence.bedrooms} ch. · {residence.bathrooms} sdb
              {residence.surface ? ` · ${residence.surface} m²` : ''}
            </p>
          </div>
          {health.status === 'libre' ? (
            <span className="rounded-full border border-kaza-border bg-white px-2 py-0.5 text-[11px] font-semibold text-kaza-muted">
              Libre
            </span>
          ) : (
            <span className="rounded-full border border-kaza-mint/30 bg-kaza-mint/10 px-2 py-0.5 text-[11px] font-semibold text-kaza-mint">
              Occupé
            </span>
          )}
        </li>
      </ul>
    </div>
  );
}

function TenantsPanel({ leases }: Readonly<{ leases: LeaseWithRelations[] }>) {
  if (leases.length === 0) {
    return (
      <EmptyState
        title="Aucun locataire pour l’instant"
        body="Créez un bail depuis le tableau de bord pour associer un locataire à ce bien."
      />
    );
  }
  return (
    <ul className="space-y-2">
      {leases.map((l) => (
        <li key={l.id} className="flex items-center justify-between gap-3 rounded-kaza border border-kaza-border bg-white p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-kaza-text">
              {l.tenant?.full_name ?? 'Locataire inconnu'}
            </p>
            <p className="text-xs text-kaza-muted">
              {formatXof(l.monthly_rent)}/mois · depuis le {formatDate(l.start_date)}
              {l.end_date ? ` · jusqu’au ${formatDate(l.end_date)}` : ''}
            </p>
          </div>
          {l.status === 'active' ? (
            new Date(l.date_fn_couverture) < new Date() ? (
              <span className="rounded-full border border-kaza-danger/30 bg-kaza-danger/10 px-2.5 py-0.5 text-[11px] font-semibold text-kaza-danger">
                Impayé
              </span>
            ) : (
              <span className="rounded-full border border-kaza-mint/30 bg-kaza-mint/10 px-2.5 py-0.5 text-[11px] font-semibold text-kaza-mint">
                À jour
              </span>
            )
          ) : (
            <span className="rounded-full border border-kaza-border bg-white px-2.5 py-0.5 text-[11px] font-semibold text-kaza-muted">
              Terminé
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function PaymentsPanel({ payments }: Readonly<{ payments: PaymentWithRelations[] }>) {
  if (payments.length === 0) {
    return (
      <EmptyState
        title="Aucun paiement enregistré"
        body="Les paiements FedaPay ou signalements espèces apparaîtront ici."
      />
    );
  }
  return (
    <ul className="space-y-2">
      {payments.map((p) => (
        <li
          key={p.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-kaza border border-kaza-border bg-white p-4"
        >
          <div className="min-w-0">
            <p className="price text-sm font-semibold text-kaza-text">{formatXof(p.amount)}</p>
            <p className="text-xs text-kaza-muted">
              {p.period_start} → {p.period_end} · {PROVIDER_LABELS[p.provider] ?? p.provider}
            </p>
          </div>
          {p.status === 'confirmed' ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-kaza-mint/30 bg-kaza-mint/10 px-2.5 py-0.5 text-[11px] font-semibold text-kaza-mint">
              <CheckCircle2 className="h-3 w-3" aria-hidden />
              Confirmé
            </span>
          ) : p.status === 'pending' ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-kaza-warning/30 bg-kaza-warning/10 px-2.5 py-0.5 text-[11px] font-semibold text-kaza-warning">
              <Clock className="h-3 w-3" aria-hidden />
              En attente
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-kaza-danger/30 bg-kaza-danger/10 px-2.5 py-0.5 text-[11px] font-semibold text-kaza-danger">
              <XCircle className="h-3 w-3" aria-hidden />
              Rejeté
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

interface ToastAPI {
  success: (msg: string, sub?: string) => void;
  error: (msg: string, sub?: string) => void;
}

function DocumentsPanel({
  receipts,
  onToast,
}: Readonly<{ receipts: ReceiptWithRelations[]; onToast: ToastAPI }>) {
  if (receipts.length === 0) {
    return (
      <EmptyState
        title="Aucune quittance émise"
        body="Les quittances signées pour ce bien apparaîtront ici après chaque paiement confirmé."
      />
    );
  }
  async function downloadReceipt(url: string) {
    const signed = await getSignedStorageUrl('receipts', url);
    if (!signed) {
      onToast.error('Impossible de générer le lien de téléchargement');
      return;
    }
    window.open(signed, '_blank', 'noopener,noreferrer');
  }
  return (
    <ul className="space-y-2">
      {receipts.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 rounded-kaza border border-kaza-border bg-white p-4">
          <div className="min-w-0">
            <p className="price text-sm font-semibold text-kaza-text">{formatXof(r.amount)}</p>
            <p className="text-xs text-kaza-muted">
              Quittance {r.period_start} → {r.period_end} ·{' '}
              {r.status === 'signed' ? 'signée' : 'en attente de signature'}
            </p>
          </div>
          {r.status === 'signed' && r.file_url ? (
            <Button variant="secondary" size="sm" onClick={() => void downloadReceipt(r.file_url as string)}>
              <FileDown className="h-4 w-4" aria-hidden />
              PDF
            </Button>
          ) : (
            <span className="rounded-full border border-kaza-warning/30 bg-kaza-warning/10 px-2.5 py-0.5 text-[11px] font-semibold text-kaza-warning">
              À signer
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
