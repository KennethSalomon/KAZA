'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const FAQ_ITEMS = [
  {
    q: 'La quittance PDF signée est-elle valable légalement au Bénin ?',
    a: 'Oui. Chaque quittance contient l\'empreinte SHA-256 du document, l\'horodatage et l\'identité vérifiée du bailleur, ce qui la rend opposable en cas de litige au titre de la loi 2017-20 sur les transactions électroniques.',
  },
  {
    q: 'Quels moyens de paiement mobile money sont acceptés ?',
    a: 'MTN Mobile Money, Moov Money et Celtiis Cash — les trois opérateurs actifs au Bénin. Le paiement passe par FedaPay ; les fonds arrivent directement sur le compte mobile money du bailleur.',
  },
  {
    q: 'Combien coûte l\'utilisation de KAZA pour un locataire ?',
    a: 'Zéro. Les locataires ne paient rien pour utiliser KAZA : recherche, messagerie, paiement du loyer et téléchargement des quittances sont totalement gratuits.',
  },
  {
    q: 'Mes données personnelles sont-elles protégées ?',
    a: 'Oui. KAZA est conforme à la loi APDP (Autorité de Protection des Données Personnelles) : consentement explicite au sign-up, hébergement des données en Europe (Supabase Frankfurt), et droit à la suppression complète du compte en un clic.',
  },
  {
    q: 'Puis-je publier plusieurs biens avec le plan gratuit ?',
    a: 'Le plan gratuit permet de publier 1 bien à la fois. Pour gérer plusieurs annonces simultanément, passez à Premium (4 900 F/mois) — la limite est levée immédiatement.',
  },
  {
    q: 'Que se passe-t-il si mon locataire ne paie pas à temps ?',
    a: 'KAZA envoie automatiquement un rappel par SMS et WhatsApp au locataire 3 jours avant l\'échéance, puis à J+1 et J+7 en cas de retard. Vous êtes également notifié en temps réel.',
  },
] as const;

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="mx-auto max-w-3xl px-5 py-20 lg:py-28"
    >
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-kaza-brand">
          Questions fréquentes
        </p>
        <h2
          id="faq-title"
          className="mt-2 font-display text-3xl font-semibold tracking-tight text-balance text-kaza-text sm:text-4xl"
        >
          Une question ? La réponse est probablement ici.
        </h2>
      </div>
      <ul className="mt-12 space-y-3">
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = open === i;
          return (
            <li
              key={item.q}
              className="rounded-kaza border border-kaza-border bg-kaza-surface"
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${i}`}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="font-medium text-kaza-text">{item.q}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-kaza-muted transition-transform duration-200',
                    isOpen && 'rotate-180',
                  )}
                  aria-hidden
                />
              </button>
              <div
                id={`faq-panel-${i}`}
                role="region"
                hidden={!isOpen}
                className="px-5 pb-5 text-sm leading-relaxed text-kaza-muted"
              >
                {item.a}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
