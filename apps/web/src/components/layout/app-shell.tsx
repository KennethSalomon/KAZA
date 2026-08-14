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
      <PwaRegister />
      <Navbar />
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6"
      >
        {!loading ? children : null}
      </motion.main>
    </div>
  );
}