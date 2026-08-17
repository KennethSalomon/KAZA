'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, LayoutDashboard, LogOut, MessageSquare, Home, Search, UserRound, Heart, X, Menu } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { cn } from '@/lib/cn';
import { motion, AnimatePresence } from 'framer-motion';

const LINKS = [
  { href: '/explorer', label: 'Explorer', icon: Search },
  { href: '/chat', label: 'Messages', icon: MessageSquare },
  { href: '/dashboard', label: 'Mon espace', icon: LayoutDashboard },
];

export function Navbar() {
  const { user, role, signOut } = useAuth();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Close menus on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-kaza-border bg-kaza-bg/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-6 sm:px-6" aria-label="Principal">
        <Link href="/explorer" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-kaza bg-kaza-brand text-white">
            <Building2 className="h-4.5 w-4.5" aria-hidden />
          </span>
          <span className="text-kaza-text">
            MARSAL<span className="text-kaza-peach"> TECHNOLOGIES</span>
          </span>
        </Link>

        {/* Mobile menu button */}
        <button
          className="ml-auto rounded-kaza p-1.5 text-kaza-muted transition-colors hover:bg-kaza-surface hover:text-kaza-text md:hidden"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-menu"
          aria-label={isMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          {isMenuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>

        {/* Desktop navigation */}
        <div className="hidden ml-auto flex-1 items-center gap-1 sm:gap-2 md:flex">
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
                <l.icon className="h-4.5 w-4.5 shrink-0" aria-hidden />
                <span className="hidden sm:inline">{l.label}</span>
              </Link>
            );
          })}

          {user && (
            <Link
              href="/favorites"
              aria-label="Mes favoris"
              title="Mes favoris"
              className="grid h-9 w-9 place-items-center rounded-kaza text-kaza-muted transition-colors hover:bg-kaza-surface hover:text-kaza-text"
            >
              <Heart className="h-4.5 w-4.5" aria-hidden />
            </Link>
          )}

          {user && <NotificationBell />}

          {(role === 'bailleur' || role === 'admin') && (
            <Link
              href={role === 'admin' ? '/admin' : '/landlord'}
              className="hidden items-center gap-2 rounded-kaza px-3 py-2 text-sm font-medium text-kaza-muted transition-colors hover:bg-kaza-surface hover:text-kaza-text md:flex"
            >
              <Home className="h-4 w-4" aria-hidden />
              {role === 'admin' ? 'Administration' : 'Mes biens'}
            </Link>
          )}

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

      {/* Mobile menu drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 md:hidden"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30"
              onClick={() => setIsMenuOpen(false)}
              aria-hidden="true"
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-kaza-surface border-l border-kaza-border flex flex-col shadow-2xl"
            >
              <div className="flex h-16 items-center gap-3 border-b border-kaza-border px-4">
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="ml-auto rounded-kaza p-1.5 text-kaza-muted transition-colors hover:bg-kaza-surface hover:text-kaza-text"
                  aria-label="Fermer le menu"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-1" aria-label="Menu mobile">
                {LINKS.map((l) => {
                  const active = pathname?.startsWith(l.href);
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setIsMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-kaza px-3 py-3 text-base font-medium transition-colors',
                        active ? 'bg-kaza-brand/10 text-kaza-brand' : 'text-kaza-text hover:bg-kaza-bg',
                      )}
                    >
                      <l.icon className="h-5.5 w-5.5 shrink-0" aria-hidden />
                      {l.label}
                    </Link>
                  );
                })}
                {user && (
                  <>
                    <Link
                      href="/favorites"
                      aria-label="Mes favoris"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 rounded-kaza px-3 py-3 text-base font-medium text-kaza-text hover:bg-kaza-bg"
                    >
                      <Heart className="h-5.5 w-5.5 shrink-0" aria-hidden />
                      Mes favoris
                    </Link>
                    {(role === 'bailleur' || role === 'admin') && (
                      <Link
                        href={role === 'admin' ? '/admin' : '/landlord'}
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-3 rounded-kaza px-3 py-3 text-base font-medium text-kaza-text hover:bg-kaza-bg"
                      >
                        <Home className="h-5.5 w-5.5 shrink-0" aria-hidden />
                        {role === 'admin' ? 'Administration' : 'Mes biens'}
                      </Link>
                    )}
                    <hr className="border-kaza-border my-2" />
                    <Link
                      href="/profile"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 rounded-kaza px-3 py-3 text-base font-medium text-kaza-text hover:bg-kaza-bg"
                    >
                      <UserRound className="h-5.5 w-5.5 shrink-0" aria-hidden />
                      Mon profil
                    </Link>
                    <button
                      onClick={() => { void signOut(); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-3 rounded-kaza px-3 py-3 text-base font-medium text-kaza-danger hover:bg-kaza-bg"
                    >
                      <LogOut className="h-5.5 w-5.5 shrink-0" aria-hidden />
                      Se déconnecter
                    </button>
                  </>
                )}
                {!user && (
                  <div className="pt-4">
                    <Link href="/login" onClick={() => setIsMenuOpen(false)} className="block">
                      <Button variant="primary" className="w-full" size="lg">
                        Connexion
                      </Button>
                    </Link>
                    <p className="mt-3 text-center text-sm text-kaza-muted">
                      Pas encore de compte ?
                      <Link href="/register" className="text-kaza-brand font-medium hover:opacity-80" onClick={() => setIsMenuOpen(false)}>
                        S&apos;inscrire
                      </Link>
                    </p>
                  </div>
                )}
              </nav>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}