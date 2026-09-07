import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatFCFA } from '@/lib/utils/currency';
import { formatDateShort } from '@/lib/utils/date';
import type { LeaseWithRelations } from '@/types/lease';

export interface LeaseSummaryCardProps {
  lease: LeaseWithRelations;
  onActionClick?: () => void;
  actionLabel?: string;
}

// note : Carte résumée d'un bail locatif avec statut et loyer mensuel
export function LeaseSummaryCard({
  lease,
  onActionClick,
  actionLabel = 'Détails',
}: LeaseSummaryCardProps) {
  const isOverdue = lease.is_overdue;

  return (
    <Card className="hover:border-kaza-vert/40 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold">
          {lease.residence?.title || 'Logement KAZA'}
        </CardTitle>
        <Badge variant={isOverdue ? 'red' : lease.status === 'active' ? 'mint' : 'neutral'}>
          {isOverdue ? 'Impayé' : lease.status === 'active' ? 'Actif' : lease.status}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3 pt-0 text-xs text-kaza-muted">
        <div className="flex justify-between">
          <span>Locataire :</span>
          <span className="font-medium text-kaza-text">
            {lease.tenant?.full_name || 'Non renseigné'}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Loyer mensuel :</span>
          <span className="font-semibold text-kaza-vert tabular-nums">
            {formatFCFA(lease.monthly_rent)}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Date de début :</span>
          <span>{formatDateShort(lease.start_date)}</span>
        </div>

        {onActionClick && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onActionClick}
              className="w-full rounded-kaza border border-kaza-border bg-kaza-raised py-2 text-center text-xs font-semibold text-kaza-text hover:bg-kaza-vert hover:text-white transition-colors"
            >
              {actionLabel}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
