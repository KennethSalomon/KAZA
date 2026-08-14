import type { Metadata, Viewport } from 'next';
import { Geist, Sora } from 'next/font/google';
import { MotionConfig } from 'framer-motion';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/ui/toast';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
});

export const metadata: Metadata = {
  title: {
    default: 'Kaza — Trouvez votre logement au Bénin',
    template: '%s · Kaza',
  },
  description:
    'Plateforme de gestion locative et mise en relation à Cotonou : recherchez un logement, payez votre loyer en mobile money, recevez vos quittances signées.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Kaza',
  },
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/icon-180.png',
  },
  openGraph: {
    title: 'Kaza — Trouvez votre logement au Bénin',
    description: 'Recherche géolocalisée, paiement mobile money, quittances signées.',
    type: 'website',
    locale: 'fr_BJ',
  },
};

export const viewport: Viewport = {
  themeColor: '#F8FAFC',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${geist.variable} ${sora.variable}`}>
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