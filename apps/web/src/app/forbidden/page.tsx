import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ForbiddenPage() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-kaza-danger">403</p>
        <h1 className="mt-4 font-display text-xl font-semibold text-kaza-text">Accès interdit</h1>
        <p className="mt-2 text-sm text-kaza-muted">
          Vous n&apos;avez pas les droits nécessaires pour accéder à cette page.
        </p>
        <Link href="/explorer" className="mt-6 inline-block">
          <Button>Retour à la recherche</Button>
        </Link>
      </div>
    </div>
  );
}
