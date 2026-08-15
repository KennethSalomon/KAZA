import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-kaza-brand">404</p>
        <h1 className="mt-4 font-display text-xl font-semibold text-kaza-text">Page introuvable</h1>
        <p className="mt-2 text-sm text-kaza-muted">
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
        </p>
        <Link href="/explorer" className="mt-6 inline-block">
          <Button>Retour à la recherche</Button>
        </Link>
      </div>
    </div>
  );
}
