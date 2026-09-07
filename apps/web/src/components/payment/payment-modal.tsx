'use client';

import { useState } from 'react';
import { reportCashPayment, initFedapayPayment, ApiError } from '@/lib/supabase-api';
import type { Lease } from '@/lib/types';
import { formatXof } from '@/lib/format';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';

// Opérateurs mobile money Bénin supportés par FedaPay.
const PROVIDERS = [
  { value: 'mtn', label: 'MTN Mobile Money' },
  { value: 'moov', label: 'Moov Money' },
  { value: 'celtiis', label: 'Celtiis' },
];

function monthRange(offsetMonths: number): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function PaymentModal({
  lease,
  open,
  onClose,
  onPaid,
}: Readonly<{ lease: Lease; open: boolean; onClose: () => void; onPaid?: () => void }>) {
  const toast = useToast();
  const [method, setMethod] = useState<'mobile_money' | 'cash'>('mobile_money');
  const [provider, setProvider] = useState('mtn');
  const [phone, setPhone] = useState('');
  const [months, setMonths] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = Number(lease.monthly_rent) * months;
  const period = monthRange(0);
  const monthsArray = Array.from({ length: Math.min(months, 6) }, (_, i) => monthRange(i));

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      if (method === 'cash') {
        const firstMonth = monthsArray[0] ?? period;
        const lastMonth = monthsArray[monthsArray.length - 1] ?? period;
        await reportCashPayment({
          lease_id: lease.id,
          amount,
          period_start: firstMonth.start,
          period_end: lastMonth.end,
        });
        toast.success('Paiement signalé', "Le bailleur doit valider la réception — vous recevrez votre quittance ensuite.");
      } else {
        // Mobile money : transaction créée via l'edge function FedaPay,
        // puis redirection vers la page de paiement hébergée.
        const res = await initFedapayPayment(lease.id, provider, phone, months);
        if (!res.payment_url) {
          throw new ApiError(502, 'Le fournisseur de paiement n\'a pas renvoyé de page de paiement.');
        }
        window.location.href = res.payment_url;
        return;
      }
      onPaid?.();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Paiement impossible');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Payer mon loyer">
      <div className="space-y-4">
        <div className="rounded-kaza border border-kaza-border bg-kaza-bg px-4 py-3">
          <p className="text-xs text-kaza-faint">Montant à régler ({months} mois)</p>
          <p className="price mt-0.5 font-display text-2xl font-bold text-kaza-brand">{formatXof(amount)}</p>
          <p className="text-xs text-kaza-faint">
            Couvre {period.start} → {period.end}
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-kaza border border-kaza-danger/30 bg-kaza-danger/10 px-4 py-2.5 text-sm text-kaza-danger">
            {error}
          </p>
        )}

        <div role="tablist" aria-label="Mode de paiement" className="grid grid-cols-2 gap-2">
          {(
            [
              { value: 'mobile_money', label: 'Mobile Money' },
              { value: 'cash', label: 'Espèces' },
            ] as const
          ).map((m) => (
            <button
              key={m.value}
              role="tab"
              aria-selected={method === m.value}
              onClick={() => setMethod(m.value)}
              className={`rounded-kaza border px-4 py-2.5 text-sm font-medium transition-colors ${
                method === m.value
                  ? 'border-kaza-brand bg-kaza-brand/10 text-kaza-brand'
                  : 'border-kaza-border text-kaza-muted hover:text-kaza-text'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div>
          <p className="kaza-label">Nombre de mois à payer</p>
          <div className="flex gap-2">
            {[1, 2, 3, 6].map((m) => (
              <button
                key={m}
                onClick={() => setMonths(m)}
                className={`h-9 flex-1 rounded-kaza border text-sm font-medium transition-colors ${
                  months === m ? 'border-kaza-brand bg-kaza-brand/10 text-kaza-brand' : 'border-kaza-border text-kaza-muted hover:text-kaza-text'
                }`}
              >
                {m} mois
              </button>
            ))}
          </div>
        </div>

        {method === 'mobile_money' ? (
          <>
            <Select
              label="Opérateur"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              options={PROVIDERS}
            />
            <Input
              label="Numéro mobile money"
              type="tel"
              required
              placeholder="+229 01 00 00 00 00"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              hint="Le numéro facturé n'est jamais affiché ni stocké en clair."
            />
          </>
        ) : (
          <p className="rounded-kaza border border-kaza-border bg-kaza-bg px-4 py-3 text-xs leading-relaxed text-kaza-muted">
            Remettez le montant au bailleur, puis signalez ici votre paiement. Il sera validé
            manuellement et votre quittance générée automatiquement.
          </p>
        )}

        <Button onClick={() => void submit()} loading={loading} className="w-full" size="lg">
          {method === 'cash' ? 'Signaler le paiement en espèces' : `Payer ${formatXof(amount)}`}
        </Button>
      </div>
    </Modal>
  );
}