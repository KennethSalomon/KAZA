'use client';

import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from './navbar';
import { PwaRegister } from '../pwa-register';

// note : shell applicatif — entrées animées en fondu, barre de navigation,
// enregistrement PWA. Les pages enfant daignent par-dessus.
export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const { loading } = useAuth();

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[1000] focus:rounded-kaza focus:bg-kaza-brand focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Aller au contenu principal
      </a>
      <PwaRegister />
      <Navbar />
      <motion.main
        id="main"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6"
        tabIndex={-1}
      >
        {!loading ? children : null}
      </motion.main>
    </div>
  );
}