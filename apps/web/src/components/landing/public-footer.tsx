import Link from 'next/link';
import { Building2 } from 'lucide-react';

export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-kaza-border bg-kaza-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold text-kaza-text">
            <Building2 className="h-5 w-5 text-kaza-brand" aria-hidden />
            KAZA
          </Link>
          <p className="mt-3 max-w-xs text-sm text-kaza-muted">
            La plateforme de gestion locative du Bénin. Cotonou, Bénin.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-kaza-text">Produit</p>
          <ul className="mt-3 space-y-2 text-sm text-kaza-muted">
            <li>
              <a href="#fonctionnalites" className="hover:text-kaza-vert">
                Fonctionnalités
              </a>
            </li>
            <li>
              <a href="#tarifs" className="hover:text-kaza-vert">
                Tarifs
              </a>
            </li>
            <li>
              <Link href="/explorer" className="hover:text-kaza-vert">
                Explorer les biens
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-kaza-text">Compte</p>
          <ul className="mt-3 space-y-2 text-sm text-kaza-muted">
            <li>
              <Link href="/login" className="hover:text-kaza-vert">
                Se connecter
              </Link>
            </li>
            <li>
              <Link href="/register" className="hover:text-kaza-vert">
                Créer un compte
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-kaza-text">Légal</p>
          <ul className="mt-3 space-y-2 text-sm text-kaza-muted">
            <li>
              <Link href="/confidentialite" className="hover:text-kaza-vert">
                Confidentialité (APDP)
              </Link>
            </li>
            <li>
              <a href="mailto:kazagroupe0@gmail.com" className="hover:text-kaza-vert">
                Contact
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-kaza-border">
        <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-kaza-faint">
          © {year} KAZA — Cotonou, Bénin. Données protégées (APDP).
        </p>
      </div>
    </footer>
  );
}
