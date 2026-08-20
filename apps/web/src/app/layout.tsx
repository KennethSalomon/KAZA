import type { Metadata, Viewport } from 'next';
import { Geist, Sora } from 'next/font/google';
import { MotionConfig } from 'framer-motion';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/ui/toast';
import { env } from '@/lib/env';

// note : Polices officielles KAZA : Sora pour les titres, Geist Sans pour le corps & les tableaux
const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: {
    default: 'KAZA — Solutions Immobilières au Bénin',
    template: '%s · KAZA',
  },
  description:
    'KAZA : plateforme de gestion locative et solutions immobilières innovantes à Cotonou. Recherche géolocalisée, paiement mobile money, quittances signées légalement.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'KAZA',
  },
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/icon-180.png',
  },
  openGraph: {
    title: 'KAZA — Solutions Immobilières au Bénin',
    description:
      'Plateforme de gestion locative innovante : recherche géolocalisée, paiement mobile money, quittances signées.',
    type: 'website',
    locale: 'fr_BJ',
    siteName: 'KAZA',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'KAZA' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KAZA — Solutions Immobilières au Bénin',
    description:
      'Plateforme de gestion locative innovante : recherche géolocalisée, paiement mobile money, quittances signées.',
    images: ['/twitter-image'],
  },
};

export const viewport: Viewport = {
  themeColor: '#F8FAFC',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${sora.variable}`}
      style={{
        ['--font-geist' as string]: 'var(--font-geist-sans)',
      }}
      suppressHydrationWarning
    >
      <body className="min-h-dvh font-sans">
        <MotionConfig reducedMotion="user">
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </MotionConfig>
      </body>
    </html>
  );
}