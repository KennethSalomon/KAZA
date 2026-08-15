'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app error]', error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-kaza-warning" aria-hidden />
        <h1 className="mt-4 font-display text-xl font-semibold text-kaza-text">
          Une erreur est survenue
        </h1>
        <p className="mt-2 max-w-md text-sm text-kaza-muted">
          {error.message || 'Réessayez ou retournez à l\'accueil.'}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="rounded-kaza bg-kaza-brand px-5 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            Réessayer
          </button>
          <a
            href="/explorer"
            className="rounded-kaza border border-kaza-border bg-white px-5 py-2 text-sm font-medium text-kaza-text transition-colors hover:bg-kaza-raised"
          >
            Retour à l&apos;accueil
          </a>
        </div>
      </div>
    </div>
  );
}
