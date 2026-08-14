'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, LayoutDashboard, LogOut, MessageSquare, Home, Search, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { cn } from '@/lib/cn';

const LINKS = [
  { href: '/explorer', label: 'Explorer', icon: Search },
  { href: '/chat', label: 'Messages', icon: MessageSquare },
  { href: '/dashboard', label: 'Mon espace', icon: LayoutDashboard },
];

export function Navbar() {
  const { user, role, signOut } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-kaza-border bg-kaza-bg/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-6 sm:px-6" aria-label="Principal">
        <Link href="/explorer" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-kaza bg-kaza-brand text-white">
            <Building2 className="h-4.5 w-4.5" aria-hidden />
          </span>
          <span className="text-kaza-text">
            Kaza<span className="text-kaza-peach">.</span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {LINKS.map((l) => {
            const active = pathname?.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-kaza px-3 py-2 text-sm font-medium transition-colors duration-150',
                  active ? 'bg-kaza-surface text-kaza-brand' : 'text-kaza-muted hover:bg-kaza-surface hover:text-kaza-text',
                )}
              >
                <l.icon className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">{l.label}</span>
              </Link>
            );
          })}

          {user && <NotificationBell />}

          {role === 'bailleur' || role === 'admin' ? (
            <Link
              href={role === 'admin' ? '/admin' : '/landlord'}
              className="hidden items-center gap-2 rounded-kaza px-3 py-2 text-sm font-medium text-kaza-muted transition-colors hover:bg-kaza-surface hover:text-kaza-text md:flex"
            >
              <Home className="h-4 w-4" aria-hidden />
              {role === 'admin' ? 'Administration' : 'Mes biens'}
            </Link>
          ) : null}

          {user ? (
            <div className="flex items-center gap-1">
              <Link
                href="/profile"
                title={user.full_name}
                aria-label={`Mon profil — ${user.full_name}`}
                className="grid h-9 w-9 place-items-center rounded-full border border-kaza-border bg-kaza-surface text-kaza-brand"
              >
                <UserRound className="h-4 w-4" aria-hidden />
              </Link>
              <Button variant="ghost" size="icon" onClick={() => void signOut()} aria-label="Se déconnecter">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Link href="/login">
              <Button variant="primary" size="sm" className="ml-1">
                Connexion
              </Button>
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}