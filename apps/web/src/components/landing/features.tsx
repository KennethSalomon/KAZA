import { MapPin, Smartphone, ReceiptText, BellRing, ShieldCheck, MessageCircle } from 'lucide-react';

const FEATURES = [
  {
    icon: MapPin,
    title: 'Recherche géolocalisée',
    body: 'Trouvez un logement libre autour de vous sur carte, filtrez par zone, prix, type de bien.',
  },
  {
    icon: Smartphone,
    title: 'Mobile Money',
    body: 'MTN MoMo, Moov Money et Celtiis. Payez le loyer en 30 secondes, sans quitter l\'application.',
  },
  {
    icon: ReceiptText,
    title: 'Quittances signées',
    body: 'PDF horodaté, signature numérique du bailleur — reconnu légalement au Bénin.',
  },
  {
    icon: BellRing,
    title: 'Rappels automatiques',
    body: 'WhatsApp et SMS avant l\'échéance, alertes bailleur en cas de retard.',
  },
  {
    icon: MessageCircle,
    title: 'Messagerie intégrée',
    body: 'Discutez avec les propriétaires, planifiez une visite, sans échanger votre numéro personnel.',
  },
  {
    icon: ShieldCheck,
    title: 'Conforme APDP',
    body: 'Vos données restent au Bénin. Suppression totale garantie à la demande (droit à l\'oubli).',
  },
] as const;

export function Features() {
  return (
    <section
      id="fonctionnalites"
      aria-labelledby="features-title"
      className="mx-auto max-w-6xl px-5 py-20 lg:py-28"
    >
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-kaza-brand">
          Fonctionnalités
        </p>
        <h2
          id="features-title"
          className="mt-2 font-display text-3xl font-semibold tracking-tight text-balance text-kaza-text sm:text-4xl"
        >
          Tout ce dont un locataire ou un bailleur a besoin, dans une seule app.
        </h2>
      </div>
      <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <li
            key={f.title}
            className="kaza-card kaza-card-hover p-6"
          >
            <span className="grid h-11 w-11 place-items-center rounded-kaza border border-kaza-vert/25 bg-kaza-vert/10 text-kaza-vert">
              <f.icon className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="mt-4 font-display text-base font-semibold text-kaza-text">
              {f.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-kaza-muted">{f.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
