import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description:
    'Politique de protection des données personnelles de MARSAL TECHNOLOGIES — conformité APDP (Bénin).',
};

export default function ConfidentialitePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-sm leading-relaxed text-kaza-text">
      <h1 className="mb-6 font-sora text-2xl font-bold">Politique de confidentialité</h1>
      <p className="mb-4 text-xs text-kaza-muted">Dernière mise à jour : 15 août 2026</p>

      <section className="space-y-6">
        <div>
          <h2 className="mb-2 font-sora text-lg font-semibold">1. Responsable du traitement</h2>
          <p>
            MARSAL TECHNOLOGIES (« nous »), plateforme de gestion locative et de mise en relation entre locataires
            et bailleurs au Bénin. Contact :{' '}
            <a href="mailto:contact@marsal-tech.bj" className="underline hover:text-kaza-brand">
              contact@marsal-tech.bj
            </a>
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-sora text-lg font-semibold">2. Données collectées</h2>
          <ul className="list-inside list-disc space-y-1">
            <li>
              <strong>Inscription :</strong> nom complet, adresse e-mail, numéro de téléphone, rôle
              (locataire ou bailleur).
            </li>
            <li>
              <strong>Profils :</strong> photo de profil (optionnelle), statut premium.
            </li>
            <li>
              <strong>Logements :</strong> informations publiées par les bailleurs (adresse, photos,
              description, loyer).
            </li>
            <li>
              <strong>Paiements :</strong> transactions FedaPay (identifiant transaction, montant,
              statut). Les données de carte bancaire ne transitent jamais par nos serveurs.
            </li>
            <li>
              <strong>Messagerie :</strong> échanges entre locataires et bailleurs.
            </li>
            <li>
              <strong>Quittances :</strong> reçus de paiement signés électroniquement.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 font-sora text-lg font-semibold">3. Finalités du traitement</h2>
          <ul className="list-inside list-disc space-y-1">
            <li>Gestion des comptes et authentification.</li>
            <li>Mise en relation locataire-bailleur et gestion des conversations.</li>
            <li>Traitement des paiements de loyer via FedaPay.</li>
            <li>Génération et signature de quittances de paiement.</li>
            <li>Notifications par e-mail (confirmations, rappels, alertes de paiement).</li>
            <li>Amélioration de la plateforme (statistiques agrégées, anonymisées).</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 font-sora text-lg font-semibold">4. Base légale</h2>
          <p>
            Le traitement repose sur votre <strong>consentement</strong> (inscription et acceptation
            de la présente politique) et sur l’<strong>exécution du contrat</strong> de service
            (gestion locative, paiements).
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-sora text-lg font-semibold">5. Durée de conservation</h2>
          <ul className="list-inside list-disc space-y-1">
            <li>Compte actif : données conservées pendant la durée d&apos;utilisation.</li>
            <li>
              Compte supprimé : toutes les données personnelles sont effacées sous 30 jours (fonction
              de suppression de compte).
            </li>
            <li>
              Quittances et transactions : conservées 10 ans conformément à la législation
              comptable.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 font-sora text-lg font-semibold">6. Partage des données</h2>
          <p>Vos données ne sont partagées qu&apos;avec :</p>
          <ul className="list-inside list-disc space-y-1">
            <li>
              <strong>FedaPay</strong> — traitement des paiements (données de transaction
              uniquement).
            </li>
            <li>
              <strong>Vercel / Supabase</strong> — hébergement de la plateforme et de la base de
              données.
            </li>
            <li>
              <strong>Brevo</strong> — envoi d&apos;e-mails transactionnels.
            </li>
          </ul>
          <p className="mt-2">
            Aucune donnée n&apos;est vendue ou communiquée à des tiers à des fins commerciales.
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-sora text-lg font-semibold">7. Vos droits</h2>
          <p>Conformément à la loi APDP du Bénin, vous disposez des droits suivants :</p>
          <ul className="list-inside list-disc space-y-1">
            <li>
              <strong>Droit d&apos;accès</strong> — obtenir une copie de vos données.
            </li>
            <li>
              <strong>Droit de rectification</strong> — corriger vos données inexactes.
            </li>
            <li>
              <strong>Droit de suppression</strong> — supprimer votre compte et vos données.
            </li>
            <li>
              <strong>Droit d&apos;opposition</strong> — vous opposer à un traitement.
            </li>
          </ul>
          <p className="mt-2">
            Pour exercer ces droits, contactez-nous à{' '}
            <a href="mailto:contact@kaza.bj" className="underline hover:text-kaza-brand">
              contact@kaza.bj
            </a>{' '}
            ou via la fonctionnalité de suppression de compte dans votre profil.
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-sora text-lg font-semibold">8. Sécurité</h2>
          <p>
            Nous mettons en œuvre des mesures techniques et organisationnelles appropriées :
            chiffrement des données en transit (TLS), politiques d&apos;accès strictes (RLS),
            authentification sécurisée, et sauvegardes régulières.
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-sora text-lg font-semibold">9. Cookies</h2>
          <p>
            MARSAL TECHNOLOGIES utilise uniquement des cookies strictement nécessaires au fonctionnement
            (authentification de session). Aucun cookie publicitaire ou de tracking n&apos;est
            utilisé.
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-sora text-lg font-semibold">10. Modifications</h2>
          <p>
            Cette politique peut être mise à jour. En cas de changement substantiel, vous serez
            notifié par e-mail.
          </p>
        </div>
      </section>
    </main>
  );
}
