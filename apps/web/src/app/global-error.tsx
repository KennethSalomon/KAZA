'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error, {
      extra: { digest: error.digest },
    });
  }, [error, error.digest]);

  return (
    <html lang="fr">
      <body className="grid min-h-dvh place-items-center bg-kaza-bg px-4">
        <div className="text-center max-w-md mx-auto">
          <div className="mb-6">
            <svg
              className="mx-auto h-16 w-16 text-kaza-danger/20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <p className="text-5xl font-bold text-kaza-danger">Erreur</p>
          <h1 className="mt-4 font-display text-xl font-semibold text-kaza-text">
            Une erreur inattendue s&apos;est produite
          </h1>
          <p className="mt-2 max-w-md text-sm text-kaza-muted">
            {error.message || 'Réessayez ou contactez le support si le problème persiste.'}
          </p>
          {error.digest && (
            <p className="mt-4 text-xs text-kaza-faint font-mono">
              ID erreur : {error.digest}
            </p>
          )}
          <div className="mt-6 flex gap-3 justify-center">
            <Button onClick={() => reset()} className="w-full sm:w-auto">
              Réessayer
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.location.href = '/'}
              className="w-full sm:w-auto"
            >
              Retour à l'accueil
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}