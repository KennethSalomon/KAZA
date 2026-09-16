'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, TrendingUp, DollarSign, AlertCircle, CreditCard, Building2 } from 'lucide-react';
import { getCashflow, type CashflowMonth } from '@/lib/supabase-api';
import { formatXof } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { apiToast } from '@/lib/api-toast';
import { cn } from '@/lib/cn';

function formatMonthKey(month: string): string {
  const d = new Date(month + '-01');
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function CashflowRow({ month, data, isTotal = false }: { month: string; data: CashflowMonth; isTotal?: boolean }) {
  const positive = data.net >= 0;
  return (
    <div className={cn(
      'flex flex-col sm:flex-row sm:items-center gap-3 rounded-kaza border p-3',
      isTotal ? 'bg-kaza-bg font-semibold' : 'bg-kaza-surface hover:bg-kaza-raised/50 transition-colors'
    )}>
      <div className="shrink-0 w-full sm:w-40 text-center sm:text-left">
        <span className={cn('text-sm font-medium', isTotal ? 'text-kaza-text' : 'text-kaza-text')}>
          {isTotal ? 'Total' : formatMonthKey(month)}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 sm:gap-4 flex-1 justify-center sm:justify-start">
        <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-kaza bg-kaza-brand/10 text-kaza-brand', isTotal && 'font-semibold')}>
          <DollarSign className="h-3.5 w-3.5" aria-hidden />
          <span className="text-sm tabular-nums">{formatXof(data.expected)}</span>
          <span className="text-[10px] text-kaza-muted">Attendu</span>
        </div>
        <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-kaza bg-kaza-success/10 text-kaza-success', isTotal && 'font-semibold')}>
          <TrendingUp className="h-3.5 w-3.5" aria-hidden />
          <span className="text-sm tabular-nums">{formatXof(data.collected)}</span>
          <span className="text-[10px] text-kaza-muted">Encaissé</span>
        </div>
        <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-kaza bg-kaza-danger/10 text-kaza-danger', isTotal && 'font-semibold')}>
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
          <span className="text-sm tabular-nums">{formatXof(data.overdue)}</span>
          <span className="text-[10px] text-kaza-muted">Impayé</span>
        </div>
        <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-kaza bg-kaza-warning/10 text-kaza-warning', isTotal && 'font-semibold')}>
          <CreditCard className="h-3.5 w-3.5" aria-hidden />
          <span className="text-sm tabular-nums">{formatXof(data.expenses)}</span>
          <span className="text-[10px] text-kaza-muted">Dépenses</span>
        </div>
        <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-kaza', isTotal && 'font-semibold', positive ? 'bg-kaza-success/10 text-kaza-success' : 'bg-kaza-danger/10 text-kaza-danger')}>
          <Building2 className="h-3.5 w-3.5" aria-hidden />
          <span className="text-sm tabular-nums">{formatXof(data.net)}</span>
          <span className="text-[10px] text-kaza-muted">Net</span>
        </div>
      </div>
    </div>
  );
}

function CashflowChart({ months, data }: { months: string[]; data: CashflowMonth[] }) {
  if (months.length === 0) return null;

  const maxVal = Math.max(
    ...data.map(d => Math.max(d.expected, d.collected, d.overdue, d.expenses, Math.abs(d.net), 1))
  );
  const height = 200;
  const barWidth = Math.max(40, Math.min(80, 600 / months.length));
  const gap = 16;

  return (
    <div className="kaza-card p-4 overflow-x-auto" role="img" aria-label="Graphique cash-flow mensuel">
      <h3 className="font-display text-sm font-semibold text-kaza-text mb-3">Évolution mensuelle</h3>
      <div className="flex items-end gap-2 h-[200px] min-w-max pb-4" style={{ minWidth: months.length * (barWidth + gap) }}>
        {months.map((month, i) => {
          const d = data[i];
          const maxH = height - 20;
          const expectedH = Math.round((d.expected / maxVal) * maxH);
          const collectedH = Math.round((d.collected / maxVal) * maxH);
          const overdueH = Math.round((d.overdue / maxVal) * maxH);
          const expensesH = Math.round((d.expenses / maxVal) * maxH);
          const netH = Math.round((Math.abs(d.net) / maxVal) * maxH);

          return (
            <div key={month} className="flex flex-col items-center gap-1" style={{ width: barWidth }}>
              <div className="flex items-end gap-1 h-[200px]" style={{ height: maxH }}>
                <div className="flex flex-col items-center gap-1 flex-1" style={{ height: '100%' }}>
                  <div className="mt-auto flex items-end gap-1" style={{ height: '100%' }}>
                    <div className="w-full flex flex-col-reverse items-center gap-1" style={{ height: '100%' }}>
                      <div className="flex flex-col-reverse items-center gap-1" style={{ height: '100%' }}>
                        <div
                          className="w-full bg-kaza-brand/20 rounded-t transition-all duration-300"
                          style={{ height: expectedH }}
                          title={`Attendu: ${new Intl.NumberFormat('fr-FR').format(d.expected)} FCFA`}
                        />
                        <div
                          className="w-full bg-kaza-success/30 rounded-t transition-all duration-300"
                          style={{ height: collectedH }}
                          title={`Encaissé: ${new Intl.NumberFormat('fr-FR').format(d.collected)} FCFA`}
                        />
                        <div
                          className="w-full bg-kaza-danger/30 rounded-t transition-all duration-300"
                          style={{ height: overdueH }}
                          title={`Impayé: ${new Intl.NumberFormat('fr-FR').format(d.overdue)} FCFA`}
                        />
                        <div
                          className="w-full bg-kaza-warning/30 rounded-t transition-all duration-300"
                          style={{ height: expensesH }}
                          title={`Dépenses: ${new Intl.NumberFormat('fr-FR').format(d.expenses)} FCFA`}
                        />
                        {d.net !== 0 && (
                          <div
                            className={`w-1.5 rounded-t transition-all duration-300 ${d.net >= 0 ? 'bg-kaza-success' : 'bg-kaza-danger'}`}
                            style={{ height: netH, marginTop: -netH }}
                            title={`Net: ${new Intl.NumberFormat('fr-FR').format(d.net)} FCFA`}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-kaza-muted text-center whitespace-nowrap">{formatMonthKey(month)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 justify-center text-[10px] text-kaza-muted">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-kaza-brand/30" /> Attendu</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-kaza-success/30" /> Encaissé</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-kaza-danger/30" /> Impayé</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-kaza-warning/30" /> Dépenses</span>
      </div>
    </div>
  );
}

export default function CashflowPage() {
  const toast = useToast();
  const [cashflow, setCashflow] = useState<CashflowMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 11);
    return d.toISOString().slice(0, 7) + '-01';
  });
  const [to, setTo] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 7) + '-01';
  });

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await getCashflow(from, to);
      setCashflow(data);
    } catch (err) {
      apiToast(toast, err, 'Chargement du cash-flow impossible');
      setError('Impossible de charger le cash-flow');
    } finally {
      setLoading(false);
    }
  }, [from, to, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const months = cashflow.map(c => c.month);
  const totals = cashflow.reduce(
    (acc, c) => ({
      expected: acc.expected + c.expected,
      collected: acc.collected + c.collected,
      overdue: acc.overdue + c.overdue,
      expenses: acc.expenses + c.expenses,
      net: acc.net + c.net,
    }),
    { expected: 0, collected: 0, overdue: 0, expenses: 0, net: 0 }
  );

  const totalsWithMonth = { ...totals, month: 'total' as const };

  const exportCSV = () => {
    const headers = ['Mois', 'Attendu', 'Encaissé', 'Impayé', 'Dépenses', 'Net'];
    const rows = cashflow.map(c => [
      formatMonthKey(c.month),
      c.expected.toString(),
      c.collected.toString(),
      c.overdue.toString(),
      c.expenses.toString(),
      c.net.toString(),
    ]);
    rows.push(['Total', totals.expected.toString(), totals.collected.toString(), totals.overdue.toString(), totals.expenses.toString(), totals.net.toString()]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashflow-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-64" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-4 text-center">
        <div>
          <p className="text-5xl font-bold text-kaza-danger">Erreur</p>
          <h1 className="mt-4 font-display text-xl font-semibold text-kaza-text">Impossible de charger</h1>
          <p className="mt-2 text-sm text-kaza-muted">{error}</p>
          <Button onClick={load} className="mt-4" size="lg">Réessayer</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">
            Cash-flow patrimonial
          </h1>
          <p className="mt-1 text-sm text-kaza-muted">
            Évolution mensuelle : attendu, encaissé, impayés, dépenses, net
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Input
              type="month"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-auto"
              aria-label="Mois de début"
            />
            <span className="text-kaza-muted">→</span>
            <Input
              type="month"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-auto"
              aria-label="Mois de fin"
            />
          </div>
          <Button variant="secondary" onClick={exportCSV} className="btn-responsive">
            <Download className="h-4 w-4 mr-2" aria-hidden />
            Exporter CSV
          </Button>
        </div>
      </div>

      {/* KPI RÉSUMÉ */}
      <section aria-labelledby="summary-title" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <h2 id="summary-title" className="sr-only">Résumé cash-flow</h2>
        <div className="kaza-card p-4">
          <p className="text-xs font-medium text-kaza-muted tracking-wide uppercase">Attendu</p>
          <p className="mt-1 text-2xl font-bold text-kaza-brand tabular-nums">{formatXof(totals.expected)}</p>
        </div>
        <div className="kaza-card p-4">
          <p className="text-xs font-medium text-kaza-muted tracking-wide uppercase">Encaissé</p>
          <p className="mt-1 text-2xl font-bold text-kaza-success tabular-nums">{formatXof(totals.collected)}</p>
        </div>
        <div className="kaza-card p-4">
          <p className="text-xs font-medium text-kaza-muted tracking-wide uppercase">Impayés</p>
          <p className="mt-1 text-2xl font-bold text-kaza-danger tabular-nums">{formatXof(totals.overdue)}</p>
        </div>
        <div className="kaza-card p-4">
          <p className="text-xs font-medium text-kaza-muted tracking-wide uppercase">Dépenses</p>
          <p className="mt-1 text-2xl font-bold text-kaza-warning tabular-nums">{formatXof(totals.expenses)}</p>
        </div>
        <div className="kaza-card p-4">
          <p className="text-xs font-medium text-kaza-muted tracking-wide uppercase">Net</p>
          <p className="mt-1 text-2xl font-bold tabular-nums" style={{ color: totals.net >= 0 ? 'var(--kaza-success)' : 'var(--kaza-danger)' }}>
            {formatXof(totals.net)}
          </p>
        </div>
      </section>

      {/* GRAPHIQUE */}
      <CashflowChart months={months} data={cashflow} />

      {/* TABLEAU */}
      <section aria-labelledby="table-title" className="space-y-3">
        <h2 id="table-title" className="sr-only">Détail mensuel</h2>
        {cashflow.length === 0 ? (
          <div className="kaza-card p-8">
            <EmptyState
              title="Aucune donnée"
              body="Aucun bail actif ni dépense sur la période sélectionnée."
            />
          </div>
        ) : (
          <>
            {cashflow.map((c) => (
              <CashflowRow key={c.month} month={c.month} data={c} />
            ))}
            <CashflowRow month="total" data={totalsWithMonth} isTotal />
          </>
        )}
      </section>
    </div>
  );
}