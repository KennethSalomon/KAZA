'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LandlordHomePage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/landlord/dashboard');
  }, [router]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div>
        <Home className="mx-auto h-12 w-12 text-kaza-brand" aria-hidden />
        <h1 className="mt-4 font-display text-xl font-semibold text-kaza-text">
          Redirection vers le tableau de bord…
        </h1>
        <p className="mt-2 text-sm text-kaza-muted">
          Veuillez patienter, vous allez être redirigé automatiquement.
        </p>
        <Link href="/landlord/dashboard" className="mt-4 inline-block">
          <Button>
            <Home className="h-4 w-4 mr-2" aria-hidden />
            Aller au tableau de bord
          </Button>
        </Link>
      </div>
    </div>
  );
}