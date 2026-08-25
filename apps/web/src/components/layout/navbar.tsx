'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

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
    <>
      <header className="sticky top-0 z-40 border-b border-kaza-border bg-kaza-bg/90 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-6 sm:px-6" aria-label="Principal">
          <Link href="/explorer" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-kaza bg-kaza-brand text-white shadow-sm">
              <Building2 className="h-4.5 w-4.5" aria-hidden />
            </span>
            <span className="text-kaza-text font-extrabold tracking-tight font-display">
              KAZA
            </span>
          </Link>

          {/* Mobile menu button */}
          <button
            className="ml-auto rounded-kaza p-2 text-kaza-muted transition-colors hover:bg-kaza-surface hover:text-kaza-text md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            aria-label={isMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {isMenuOpen ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
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
                    active ? 'bg-kaza-surface text-kaza-brand shadow-sm border border-kaza-border/50' : 'text-kaza-muted hover:bg-kaza-surface hover:text-kaza-text',
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
                <Button variant="primary" size="sm" className="ml-1 bg-kaza-brand hover:bg-kaza-brand-dark text-white font-medium">
                  Connexion
                </Button>
              </Link>
            )}
          </div>
        </nav>
      </header>

      {/* Mobile menu drawer & overlay Portaled directly to body */}
      {mounted && createPortal(
        <AnimatePresence>
          {isMenuOpen && (
            <div className="fixed inset-0 z-[9999] md:hidden" id="mobile-menu">
              {/* Backdrop overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setIsMenuOpen(false)}
                aria-hidden="true"
              />

              {/* Drawer */}
              <motion.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 240 }}
                className="fixed top-0 right-0 bottom-0 w-full max-w-xs sm:max-w-sm bg-white border-l border-kaza-border flex flex-col shadow-2xl z-[10000]"
              >
                <div className="flex h-16 items-center justify-between border-b border-kaza-border px-5 bg-kaza-surface">
                  <div className="flex items-center gap-2 font-display text-lg font-bold text-kaza-brand">
                    <span className="grid h-8 w-8 place-items-center rounded-kaza bg-kaza-brand text-white shadow-sm">
                      <Building2 className="h-4.5 w-4.5" aria-hidden />
                    </span>
                    <span>KAZA</span>
                  </div>
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="rounded-kaza p-2 text-kaza-muted transition-colors hover:bg-kaza-raised hover:text-kaza-text"
                    aria-label="Fermer le menu"
                  >
                    <X className="h-6 w-6" aria-hidden />
                  </button>
                </div>

                <nav className="flex-1 overflow-y-auto py-6 px-5 space-y-2 bg-white" aria-label="Menu mobile">
                  {LINKS.map((l) => {
                    const active = pathname?.startsWith(l.href);
                    return (
                      <Link
                        key={l.href}
                        href={l.href}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setIsMenuOpen(false)}
                        className={cn(
                          'flex items-center gap-3.5 rounded-xl px-4 py-3 text-base font-medium transition-colors',
                          active ? 'bg-kaza-brand/10 text-kaza-brand font-semibold' : 'text-kaza-text hover:bg-kaza-raised',
                        )}
                      >
                        <l.icon className="h-5 w-5 shrink-0" aria-hidden />
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
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-base font-medium text-kaza-text hover:bg-kaza-raised"
                      >
                        <Heart className="h-5 w-5 shrink-0 text-kaza-muted" aria-hidden />
                        Mes favoris
                      </Link>
                      {(role === 'bailleur' || role === 'admin') && (
                        <Link
                          href={role === 'admin' ? '/admin' : '/landlord'}
                          onClick={() => setIsMenuOpen(false)}
                          className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-base font-medium text-kaza-text hover:bg-kaza-raised"
                        >
                          <Home className="h-5 w-5 shrink-0 text-kaza-muted" aria-hidden />
                          {role === 'admin' ? 'Administration' : 'Mes biens'}
                        </Link>
                      )}
                      <hr className="border-kaza-border my-3" />
                      <Link
                        href="/profile"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-base font-medium text-kaza-text hover:bg-kaza-raised"
                      >
                        <UserRound className="h-5 w-5 shrink-0 text-kaza-muted" aria-hidden />
                        Mon profil
                      </Link>
                      <button
                        onClick={() => { void signOut(); setIsMenuOpen(false); }}
                        className="w-full flex items-center gap-3.5 rounded-xl px-4 py-3 text-base font-medium text-kaza-danger hover:bg-kaza-raised transition-colors"
                      >
                        <LogOut className="h-5 w-5 shrink-0" aria-hidden />
                        Se déconnecter
                      </button>
                    </>
                  )}

                  {!user && (
                    <div className="pt-6 flex flex-col gap-3">
                      <Link href="/login" onClick={() => setIsMenuOpen(false)} className="block">
                        <Button variant="primary" className="w-full bg-kaza-brand hover:bg-kaza-brand-dark text-white font-medium" size="lg">
                          Connexion
                        </Button>
                      </Link>
                      <Link href="/register" onClick={() => setIsMenuOpen(false)} className="block">
                        <Button variant="secondary" className="w-full border-kaza-border text-kaza-text hover:bg-kaza-raised font-medium" size="lg">
                          S&apos;inscrire
                        </Button>
                      </Link>
                    </div>
                  )}
                </nav>
              </motion.aside>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}