# PRODUCT — KAZA.BJ

## Mission
Plateforme proptech béninoise de gestion locative et de mise en relation : recherche géolocalisée de logements, messagerie temps réel, paiement de loyer mobile money (FedaPay), quittances PDF signées, détection automatique des impayés. Freemium SaaS (1 bien gratuit, Premium pour publier plus), 0 % de commission.

## Audiences
- **Locataires** : chercher un logement (carte + filtres), chater avec le bailleur, payer le loyer (mobile money / espèces), télécharger les quittances.
- **Bailleurs** : publier et gérer leurs biens, créer des baux, valider les paiements, signaler les quittances, suivre les impayés.
- **Administrateurs** : KPIs, modération des annonces, gestion premium/rôles.

## Language & Voice
Français (bénin). Ton humain, proche, rassurant : la gestion locative expliquée simplement. Zéro jargon opaque. Tutoiement léger, impersonnel sur les données (montants, statuts).

## Fonctionnalités clés (MVP)
1. Auth email + OTP téléphone, rôles visiteur/locataire/bailleur/admin, consentement APDP.
2. Recherche géolocalisée PostGIS (rayon km, filtres type/budget/ville/zone), carte Leaflet.
3. Annonces CRUD bailleur, photos Storage, géocodage Nominatim, limite freemium 1 bien (trigger SQL).
4. Chat 1-to-1 temps réel (Realtime), pièces jointes, validation de visite (`agree_visit` → bien « en visite »).
5. Baux : `create_lease` (bien → occupée), `terminate_lease`, caution ≤ 3 mois (Loi 2022-30).
6. Paiements : espèces (signalement + validation bailleur) ; mobile money FedaPay (edge `fedapay-init`, webhook signé HMAC-SHA256 → confirmation → couverture étendue + quittance auto).
7. Quittances : PDF A4 signé (edge `receipts-sign`), SHA-256 en pied de page, bucket `receipts`.
8. Impayés : CRON J-3 / J+1 / J+7 (edge `overdue-cron`), notifications in-app + Brevo, dédup 7 j.
9. Admin : `admin_stats`, modération, rôles/premium.
10. PWA installable.

## Architecture
Frontend Next.js 15 (App Router, TS strict, Tailwind, Framer Motion, Leaflet, lucide) → Supabase Cloud (Auth, PostgreSQL 15 + PostGIS, Storage, Realtime) + Edge Functions Deno (FedaPay, quittances, CRON impayés). Pas de backend applicatif : logique métier en SQL (triggers, RPC security definer). Docker/local abandonné (BIOS verrouillé → cloud uniquement).

## Liens
- Dépôt GitHub (principal) : https://github.com/KennethSalomon/KAZA
- Projet Supabase cloud : `qbogbuwnkwqgarbchtyr` (https://qbogbuwnkwqgarbchtyr.supabase.co)
- Comptes démo (seed) : locataire.demo@kaza.bj / bailleur.demo@kaza.bj / admin@kaza.bj — `KazaDemo2026!`
- Charte graphique : `C:\Users\hp\Downloads\KAZA\kaza.md\kaza-charte-graphique.md` (source de vérité pour DESIGN.md)