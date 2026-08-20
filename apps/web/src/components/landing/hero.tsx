import Link from 'next/link';
import { ArrowRight, MapPin, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden border-b border-kaza-border"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(900px 500px at 90% -10%, rgba(14,71,40,0.08), transparent 60%), radial-gradient(700px 500px at -10% 110%, rgba(242,176,145,0.15), transparent 60%)',
        }}
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-[1.1fr_1fr] lg:py-28">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-kaza-vert/25 bg-kaza-vert/10 px-3 py-1 text-xs font-medium text-kaza-vert">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            Cotonou · Porto-Novo · Abomey-Calavi
          </p>
          <h1
            id="hero-title"
            className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance text-kaza-text sm:text-5xl lg:text-6xl"
          >
            Louer au Bénin,{' '}
            <span className="text-kaza-vert">simplement</span> et{' '}
            <span className="text-kaza-peach-dark">en sécurité</span>.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-kaza-muted sm:text-lg">
            KAZA connecte locataires et bailleurs : recherche géolocalisée, paiement mobile money,
            quittances signées reconnues légalement.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/register">
              <Button size="lg" variant="cta" className="gap-2">
                Créer un compte gratuit
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </Link>
            <Link href="/explorer">
              <Button size="lg" variant="secondary">
                Explorer les biens
              </Button>
            </Link>
          </div>
          <p className="mt-6 flex items-center gap-2 text-xs text-kaza-faint">
            <ShieldCheck className="h-4 w-4 text-kaza-mint" aria-hidden />
            Données protégées (APDP Bénin) · Sans engagement
          </p>
        </div>

        <div className="relative">
          <div
            aria-hidden
            className="absolute -inset-4 rounded-kaza-xl bg-gradient-to-tr from-kaza-vert/20 via-transparent to-kaza-peach/25 blur-2xl"
          />
          <div className="relative overflow-hidden rounded-kaza-lg border border-kaza-border bg-kaza-surface shadow-card">
            <div className="flex items-center gap-1.5 border-b border-kaza-border px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-kaza-danger/50" aria-hidden />
              <span className="h-2.5 w-2.5 rounded-full bg-kaza-warning/60" aria-hidden />
              <span className="h-2.5 w-2.5 rounded-full bg-kaza-mint/60" aria-hidden />
              <p className="ml-3 text-[11px] font-medium text-kaza-faint">
                app.kaza.bj / dashboard
              </p>
            </div>
            <div className="grid gap-3 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-kaza border border-kaza-border bg-kaza-bg p-3">
                  <p className="text-[10px] uppercase tracking-wide text-kaza-faint">
                    Total encaissé
                  </p>
                  <p className="price mt-1 font-display text-xl font-bold text-kaza-vert">
                    2 850 000 F
                  </p>
                </div>
                <div className="rounded-kaza border border-kaza-border bg-kaza-bg p-3">
                  <p className="text-[10px] uppercase tracking-wide text-kaza-faint">
                    Taux d&apos;occupation
                  </p>
                  <p className="price mt-1 font-display text-xl font-bold text-kaza-mint">92 %</p>
                </div>
              </div>
              <div className="rounded-kaza border border-kaza-border bg-kaza-bg p-3">
                <p className="text-[10px] uppercase tracking-wide text-kaza-faint">
                  Loyers 12 mois
                </p>
                <svg viewBox="0 0 220 60" className="mt-2 h-14 w-full" role="img" aria-label="Graphique des loyers encaissés">
                  <defs>
                    <linearGradient id="hero-spark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0E4728" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#0E4728" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,45 L20,40 L40,42 L60,32 L80,35 L100,28 L120,30 L140,22 L160,25 L180,15 L200,18 L220,10"
                    fill="none"
                    stroke="#0E4728"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M0,45 L20,40 L40,42 L60,32 L80,35 L100,28 L120,30 L140,22 L160,25 L180,15 L200,18 L220,10 L220,60 L0,60 Z"
                    fill="url(#hero-spark)"
                  />
                </svg>
              </div>
              <div className="rounded-kaza bg-kaza-vert/5 px-3 py-2 text-xs text-kaza-vert">
                📱 Loyer de mars encaissé — Moov Money
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
