'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LeaseWithRelations, PaymentWithRelations } from '@/lib/types';
import { formatXof } from '@/lib/format';

interface CashflowChartProps {
  payments: PaymentWithRelations[];
  leases: LeaseWithRelations[];
  residenceId?: string;
}

interface MonthlyPoint {
  month: string;
  encaisse: number;
  attendu: number;
}

// note : période = les 12 derniers mois calendaires glissants (mois en cours
// inclus). On construit la série côté client : les paiements confirmés sont
// agrégés par mois de `period_start`, et l'attendu = somme des loyers mensuels
// actifs pour chaque mois. Ce calcul est correct tant que le volume reste
// raisonnable ; au-delà, une RPC serveur serait plus efficace.
function buildSeries(
  payments: PaymentWithRelations[],
  leases: LeaseWithRelations[],
  residenceId: string | undefined,
): MonthlyPoint[] {
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth(), label: formatMonth(d) };
  });

  const relevantPayments = residenceId
    ? payments.filter((p) => p.lease?.residence_id === residenceId)
    : payments;

  const relevantLeases = residenceId
    ? leases.filter((l) => l.residence_id === residenceId)
    : leases;

  return months.map(({ year, month, label }) => {
    const encaisse = relevantPayments
      .filter((p) => {
        if (p.status !== 'confirmed') return false;
        const d = new Date(p.period_start);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((sum, p) => sum + p.amount, 0);

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const attendu = relevantLeases
      .filter((l) => {
        const start = new Date(l.start_date);
        const end = l.end_date ? new Date(l.end_date) : monthEnd;
        return start <= monthEnd && end >= monthStart;
      })
      .reduce((sum, l) => sum + l.monthly_rent, 0);

    return { month: label, encaisse, attendu };
  });
}

function formatMonth(d: Date): string {
  return d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
}

const TICK_STYLE = { fontSize: 11, fill: '#64748B' };

export function CashflowChart({ payments, leases, residenceId }: CashflowChartProps) {
  const data = useMemo(
    () => buildSeries(payments, leases, residenceId),
    [payments, leases, residenceId],
  );

  return (
    <div
      className="kaza-card p-5"
      role="region"
      aria-label="Loyers encaissés vs attendus sur 12 mois"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-kaza-text">
          Loyers 12 mois
        </h2>
        <p className="text-xs text-kaza-faint">Encaissés vs attendus</p>
      </div>
      <div className="mt-4 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis dataKey="month" tick={TICK_STYLE} axisLine={false} tickLine={false} />
            <YAxis
              tick={TICK_STYLE}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) =>
                v >= 1_000_000
                  ? `${(v / 1_000_000).toFixed(1)}M`
                  : v >= 1000
                    ? `${Math.round(v / 1000)}k`
                    : String(v)
              }
            />
            <Tooltip
              cursor={{ fill: '#F1F5F9' }}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #E2E8F0',
                fontSize: 12,
                boxShadow: '0 8px 20px -8px rgba(15,23,42,0.15)',
              }}
              formatter={(value, key) => [
                formatXof(typeof value === 'number' ? value : Number(value ?? 0)),
                key === 'encaisse' ? 'Encaissé' : 'Attendu',
              ]}
              labelStyle={{ fontWeight: 600, color: '#0F172A' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(v) => (v === 'encaisse' ? 'Encaissé' : 'Attendu')}
            />
            <Bar dataKey="attendu" fill="#F2B091" radius={[4, 4, 0, 0]} />
            <Bar dataKey="encaisse" fill="#0E4728" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
