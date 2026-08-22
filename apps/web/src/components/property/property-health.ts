// note : Calcul de la « santé financière » d'un bien pour la vue grille/liste
// bailleur (Phase 6.1). Purement fonctionnel — aucune requête réseau.
//
// Règles métier :
//   sain     : au moins 1 paiement confirmé dans les 45 derniers jours
//              ET aucun bail actif dont la couverture a expiré
//   attention: bail actif à jour mais aucun paiement récent (nouveau bien
//              ou entre deux échéances)
//   critique : au moins 1 bail actif dont date_fn_couverture < now
//   libre    : aucun bail actif (pas de locataire → pas de flux)

import type { LeaseWithRelations, PaymentWithRelations } from '@/lib/types';

export type HealthStatus = 'sain' | 'attention' | 'critique' | 'libre';

export interface HealthResult {
  status: HealthStatus;
  activeLeases: number;
  overdueLeases: number;
  lastPaymentAt: string | null;
}

const RECENT_PAYMENT_WINDOW_DAYS = 45;

export function computeResidenceHealth(
  residenceId: string,
  leases: readonly LeaseWithRelations[],
  payments: readonly PaymentWithRelations[],
): HealthResult {
  const now = new Date();

  const own = leases.filter((l) => l.residence_id === residenceId && l.status === 'active');
  const overdue = own.filter((l) => new Date(l.date_fn_couverture) < now);

  const paidHere = payments
    .filter(
      (p) =>
        p.status === 'confirmed' &&
        (p.lease?.residence_id === residenceId ||
          own.some((l) => l.id === p.lease_id)),
    )
    .sort((a, b) => (b.confirmed_at ?? b.created_at).localeCompare(a.confirmed_at ?? a.created_at));

  const lastPaymentAt = paidHere[0]?.confirmed_at ?? paidHere[0]?.created_at ?? null;

  if (own.length === 0) {
    return { status: 'libre', activeLeases: 0, overdueLeases: 0, lastPaymentAt };
  }
  if (overdue.length > 0) {
    return { status: 'critique', activeLeases: own.length, overdueLeases: overdue.length, lastPaymentAt };
  }
  const recent =
    lastPaymentAt &&
    (now.getTime() - new Date(lastPaymentAt).getTime()) / 86_400_000 <= RECENT_PAYMENT_WINDOW_DAYS;
  return {
    status: recent ? 'sain' : 'attention',
    activeLeases: own.length,
    overdueLeases: 0,
    lastPaymentAt,
  };
}

export const HEALTH_META: Record<HealthStatus, { label: string; className: string; dot: string }> = {
  sain: {
    label: 'Sain',
    className: 'bg-kaza-mint/10 text-kaza-mint border-kaza-mint/30',
    dot: 'bg-kaza-mint',
  },
  attention: {
    label: 'À surveiller',
    className: 'bg-kaza-warning/10 text-kaza-warning border-kaza-warning/30',
    dot: 'bg-kaza-warning',
  },
  critique: {
    label: 'Impayé',
    className: 'bg-kaza-danger/10 text-kaza-danger border-kaza-danger/30',
    dot: 'bg-kaza-danger',
  },
  libre: {
    label: 'Libre',
    className: 'bg-kaza-raised text-kaza-muted border-kaza-border',
    dot: 'bg-kaza-faint',
  },
};
