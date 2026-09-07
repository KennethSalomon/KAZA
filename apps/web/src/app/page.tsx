import type { Metadata } from 'next';
import { PublicNav } from '@/components/landing/public-nav';
import { Hero } from '@/components/landing/hero';
import { Features } from '@/components/landing/features';
import { Pricing } from '@/components/landing/pricing';
import { FAQ } from '@/components/landing/faq';
import { PublicFooter } from '@/components/landing/public-footer';
import { env } from '@/lib/env';

export const metadata: Metadata = {
  title: 'KAZA — Louer au Bénin, simplement et en sécurité',
  description:
    'KAZA : la plateforme de gestion locative du Bénin. Recherche géolocalisée, paiement mobile money (MTN, Moov, Celtiis), quittances signées légalement. Gratuit pour les locataires.',
  alternates: { canonical: '/' },
};

// note : structured data JSON-LD (Organization + FAQPage + WebSite) requis
// pour la visibilité Google et le rich snippet FAQ. Injection statique via
// <script type="application/ld+json"> — Next.js RSC autorisé.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'KAZA',
      url: env.appUrl,
      logo: `${env.appUrl}/icons/icon.svg`,
      email: 'kazagroupe0@gmail.com',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Cotonou',
        addressCountry: 'BJ',
      },
      sameAs: [] as string[],
    },
    {
      '@type': 'WebSite',
      name: 'KAZA',
      url: env.appUrl,
      inLanguage: 'fr-BJ',
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'La quittance PDF signée est-elle valable légalement au Bénin ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Oui — chaque quittance contient l\'empreinte SHA-256, l\'horodatage et l\'identité vérifiée du bailleur, opposable au titre de la loi 2017-20 sur les transactions électroniques.',
          },
        },
        {
          '@type': 'Question',
          name: 'Quels moyens de paiement mobile money sont acceptés ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'MTN Mobile Money, Moov Money et Celtiis Cash via FedaPay.',
          },
        },
        {
          '@type': 'Question',
          name: 'Combien coûte KAZA pour un locataire ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Zéro. L\'utilisation est 100 % gratuite pour les locataires.',
          },
        },
      ],
    },
  ],
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // note : le JSON-LD n'est jamais lu comme du HTML — pas de risque XSS.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicNav />
      <main>
        <Hero />
        <Features />
        <Pricing />
        <FAQ />
      </main>
      <PublicFooter />
    </>
  );
}
