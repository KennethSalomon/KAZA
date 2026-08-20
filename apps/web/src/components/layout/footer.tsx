import Link from 'next/link';
import { Container } from './container';

// note : Pied de page sémantique <footer> officiel KAZA
export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-kaza-border bg-white text-sm text-kaza-muted">
      <Container size="xl" className="py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-bold tracking-tight text-kaza-vert">
                KAZA
              </span>
              <span className="rounded bg-kaza-peche/30 px-1.5 py-0.5 text-[10px] font-semibold text-kaza-vert">
                Bénin
              </span>
            </div>
            <p className="text-xs text-kaza-muted leading-relaxed">
              Plateforme SaaS de gestion locative, suivi des loyers et quittances certifiées à Cotonou et partout au Bénin.
            </p>
          </div>

          <div>
            <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-kaza-text">
              Plateforme
            </h4>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <Link href="/explorer" className="hover:text-kaza-vert transition-colors">
                  Explorer les biens
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-kaza-vert transition-colors">
                  Tableau de bord
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-kaza-vert transition-colors">
                  Tarifs & Abonnements
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-kaza-text">
              Propriétaires
            </h4>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <Link href="/landlord" className="hover:text-kaza-vert transition-colors">
                  Espace Bailleur
                </Link>
              </li>
              <li>
                <Link href="/landlord/residences/new" className="hover:text-kaza-vert transition-colors">
                  Publier un bien
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-kaza-vert transition-colors">
                  FAQ & Aide
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-kaza-text">
              Légal & Conformité
            </h4>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <Link href="/terms" className="hover:text-kaza-vert transition-colors">
                  Conditions Générales
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-kaza-vert transition-colors">
                  Protection des données (APDP)
                </Link>
              </li>
              <li>
                <Link href="/legal" className="hover:text-kaza-vert transition-colors">
                  Mentions légales
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between border-t border-kaza-border pt-6 text-xs text-kaza-faint sm:flex-row">
          <p>© {currentYear} KAZA Bénin. Tous droits réservés.</p>
          <p className="mt-2 sm:mt-0">Fait avec soin à Cotonou 🇧🇯</p>
        </div>
      </Container>
    </footer>
  );
}
