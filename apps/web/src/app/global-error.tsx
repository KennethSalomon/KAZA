'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="grid min-h-dvh place-items-center bg-kaza-bg px-4">
        <div className="text-center">
          <p className="text-5xl font-bold text-kaza-danger">Erreur</p>
          <h1 className="mt-4 font-display text-xl font-semibold text-kaza-text">
            Une erreur inattendue s&apos;est produite
          </h1>
          <p className="mt-2 max-w-md text-sm text-kaza-muted">
            {error.message || 'Réessayez ou contactez le support si le problème persiste.'}
          </p>
          <button
            onClick={() => reset()}
            className="mt-6 rounded-kaza bg-kaza-brand px-6 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
