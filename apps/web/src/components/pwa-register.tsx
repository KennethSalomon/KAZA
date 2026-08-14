'use client';

import { useEffect } from 'react';

// note : enregistre le service worker PWA une seule fois, si navigator
// serviceWorker est disponible et hors environnement de développement.
export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const swUrl = '/sw.js';
    if (process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register(swUrl).catch(() => undefined);
    }
  }, []);

  return null;
}