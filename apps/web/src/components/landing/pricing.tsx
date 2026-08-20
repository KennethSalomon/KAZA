import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

// note : la limite freemium de 1 bien publié est imposée côté DB par
// enforce_freemium_limit — la page tarifs doit rester cohérente avec la migration.
const PLANS = [
  {
    id: 'gratuit',
    name: 'Gratuit',
    price: '0',
    period: 'toujours',
    tagline: 'Pour découvrir KAZA et publier un premier bien.',
    features: [
      '1 bien publié',
      'Recherche + messagerie',
      'Paiement mobile money',
      'Quittances signées',
    ],
    cta: 'Créer mon compte',
    href: '/register',
    highlight: false,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '4 900',
    period: '/mois',
    tagline: 'Pour les bailleurs qui gèrent plusieurs biens.',
    features: [
      'Biens illimités',
      'Badge « Bailleur vérifié »',
      'Rappels automatiques WhatsApp',
      'Statistiques avancées',
      'Support prioritaire',
    ],
    cta: 'Essayer Premium',
    href: '/register?plan=premium',
    highlight: true,
  },
  {
    id: 'annuel',
    name: 'Premium annuel',
    price: '49 000',
    period: '/an',
    tagline: 'Deux mois offerts sur l\'abonnement annuel.',
    features: [
      'Tout Premium mensuel',
      '2 mois offerts (économie 9 800 F)',
      'Facturation unique',
      'Résiliable à tout moment',
    ],
    cta: 'Choisir l\'annuel',
    href: '/register?plan=annuel',
    highlight: false,
  },
] as const;

export function Pricing() {
  return (
    <section
      id="tarifs"
      aria-labelledby="pricing-title"
      className="border-y border-kaza-border bg-kaza-raised/40"
    >
      <div className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-kaza-brand">
            Tarifs
          </p>
          <h2
            id="pricing-title"
            className="mt-2 font-display text-3xl font-semibold tracking-tight text-balance text-kaza-text sm:text-4xl"
          >
            Gratuit pour commencer, Premium quand vous grandissez.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-kaza-muted">
            Aucune commission sur les loyers encaissés. Vous payez pour les fonctionnalités, pas
            pour les transactions.
          </p>
        </div>

        <ul className="mt-12 grid gap-5 lg:grid-cols-3">
          {PLANS.map((p) => (
            <li
              key={p.id}
              className={
                p.highlight
                  ? 'relative rounded-kaza-lg border-2 border-kaza-vert bg-kaza-surface p-7 shadow-glow'
                  : 'rounded-kaza-lg border border-kaza-border bg-kaza-surface p-7 shadow-card'
              }
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-kaza-vert px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                  Recommandé
                </span>
              )}
              <h3 className="font-display text-lg font-semibold text-kaza-text">{p.name}</h3>
              <p className="mt-1 text-sm text-kaza-muted">{p.tagline}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="price font-display text-4xl font-bold text-kaza-text">
                  {p.price}
                </span>
                <span className="text-sm text-kaza-muted">
                  {p.price === '0' ? '' : 'F CFA'} {p.period}
                </span>
              </div>
              <ul className="mt-6 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-kaza-text">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-kaza-mint" aria-hidden />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href={p.href} className="mt-7 block">
                <Button
                  className="w-full"
                  variant={p.highlight ? 'cta' : 'secondary'}
                  size="lg"
                >
                  {p.cta}
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
