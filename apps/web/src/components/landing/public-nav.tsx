import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NAV_LINKS = [
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#tarifs', label: 'Tarifs' },
  { href: '#faq', label: 'FAQ' },
] as const;

export function PublicNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-kaza-border/70 bg-kaza-bg/85 backdrop-blur">
      <nav
        aria-label="Navigation principale"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5"
      >
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-xl font-bold text-kaza-text"
        >
          <Building2 className="h-5 w-5 text-kaza-brand" aria-hidden />
          KAZA
        </Link>
        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-sm font-medium text-kaza-muted transition-colors hover:text-kaza-vert"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Se connecter
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm">Créer un compte</Button>
          </Link>
        </div>
      </nav>
    </header>
  );
}
