import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatFCFA } from '@/lib/utils/currency';
import { formatDateShort } from '@/lib/utils/date';
import type { PaymentWithRelations } from '@/types/payment';

export interface PaymentStatusCardProps {
  payment: PaymentWithRelations;
  onReceiptClick?: () => void;
}

// note : Carte de suivi individuel de paiement et de quittance associée
export function PaymentStatusCard({
  payment,
  onReceiptClick,
}: PaymentStatusCardProps) {
  const isConfirmed = payment.status === 'confirmed';
  const isRejected = payment.status === 'rejected';

  const badgeVariant = isConfirmed ? 'mint' : isRejected ? 'red' : 'amber';
  const badgeLabel = isConfirmed
    ? 'Confirmé'
    : isRejected
      ? 'Rejeté'
      : 'En attente';

  return (
    <Card className="flex flex-col justify-between p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs text-kaza-muted">
            Période : {formatDateShort(payment.period_start)} — {formatDateShort(payment.period_end)}
          </p>
          <p className="font-display text-lg font-bold text-kaza-text tabular-nums">
            {formatFCFA(payment.amount)}
          </p>
        </div>

        <Badge variant={badgeVariant}>{badgeLabel}</Badge>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-kaza-border/40 pt-2 text-xs text-kaza-muted">
        <span className="capitalize">{payment.provider || payment.method}</span>

        {isConfirmed && onReceiptClick && (
          <button
            type="button"
            onClick={onReceiptClick}
            className="font-medium text-kaza-vert hover:underline"
          >
            Voir la quittance
          </button>
        )}
      </div>
    </Card>
  );
}
