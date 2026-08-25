import type { Metadata, Viewport } from 'next';
import { Geist, Sora } from 'next/font/google';
import { MotionConfig } from 'framer-motion';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/ui/toast';
import { env } from '@/lib/env';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
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
    description: 'Plateforme de gestion locative innovante : recherche géolocalisée, paiement mobile money, quittances signées.',
    type: 'website',
    locale: 'fr_BJ',
    siteName: 'KAZA',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'KAZA' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KAZA — Solutions Immobilières au Bénin',
    description: 'Plateforme de gestion locative innovante : recherche géolocalisée, paiement mobile money, quittances signées.',
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
    <html lang="fr" className={`${geist.variable} ${sora.variable}`} suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-dvh">
        <MotionConfig reducedMotion="user">
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </MotionConfig>
      </body>
    </html>
  );
}