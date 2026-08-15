import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AppNotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="text-center">
        <p className="text-5xl font-bold text-kaza-brand">404</p>
        <h1 className="mt-4 font-display text-xl font-semibold text-kaza-text">Page introuvable</h1>
        <p className="mt-2 text-sm text-kaza-muted">
          Cette page n&apos;existe pas ou n&apos;est plus disponible.
        </p>
        <Link href="/explorer" className="mt-6 inline-block">
          <Button>Retour à la recherche</Button>
        </Link>
      </div>
    </div>
  );
}
