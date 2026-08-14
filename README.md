# KAZA.BJ 🏠

Plateforme proptech de **gestion locative et mise en relation** au Bénin : recherche géolocalisée de
logements, messagerie temps réel, loyers mobile money (FedaPay), quittances PDF signées
(signature visuelle + empreinte SHA-256), détection automatique des impayés.

**Modèle économique** : Freemium SaaS (1 bien gratuit, Premium pour publier plus) — 0 % de commission.

---

## Architecture — « Supabase seule » (pas de backend applicatif)

```
kaza/
├── apps/web/                # Frontend Next.js 15 (App Router) — TS strict, Tailwind, Framer Motion
├── supabase/
│   ├── migrations/          # Schéma SQL : PostGIS, RLS, triggers, RPC (logique métier)
│   ├── seed.sql             # Données de démo (E2E : locataire.demo@kaza.bj / KazaDemo2026!)
│   ├── functions/           # Edge Functions Deno (FedaPay, quittances, CRON impayés)
│   └── config.toml          # Configuration CLI Supabase (ports, secrets de dev)
├── tests/                   # Tests Vitest (PDF, signature webhook, tiers impayés)
├── docker-compose.yml       # PostgreSQL de repli (option B)
└── .env.example
```

| Couche | Choix | Raison |
|---|---|---|
| Frontend | Next.js + Tailwind + Framer Motion + Leaflet | PWA installable, design premium sombre |
| API métier | **SQL + RPC** (triggers, SECURITY DEFINER) + Edge Functions | Zéro backend à maintenir, RLS au plus près des données |
| Base de données | PostgreSQL 15 + PostGIS (Supabase) | Recherche par rayon géographique |
| Auth | Supabase Auth (email + OTP SMS) | Rôles `visiteur/locataire/bailleur/admin` |
| Paiement | **FedaPay** (webhook HMAC-SHA256 vérifié) | MTN MoMo, Moov Money, Celtiis (Bénin) |
| Emails | Brevo | Relances impayés + notifications |
| Quittances | Générateur PDF maison + SHA-256 | Signature visuelle du bailleur (Yousign prévu V2) |
| Impayés | pg_cron → `overdue-cron` (J-3, J+1, J+7) | Relances email + in-app dédupliquées 7 j |

## Démarrage rapide

### 1. Supabase local (recommandé)

```bash
npx supabase start          # URL http://localhost:54321 (ports configurés dans config.toml)
npx supabase db reset       # applique supabase/migrations/* + seed.sql (comptes de démo)
```

Alternative : `docker compose up -d db` puis charger la migration à la main (pas d'Auth/Edge).

### 2. Configuration

```bash
cp .env.example .env
cp apps/web/.env.local.example apps/web/.env.local
```

`apps/web/.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé anon supabase (npx supabase status)>
```

> Les secrets Edge Functions (clés FedaPay, CRON_SECRET, Brevo…) sont déclarés dans
> `supabase/config.toml` pour le dev local ; en production, les définir dans le tableau
> de bord Supabase (Settings → Edge Functions → Secrets).

### 3. Lancement

```bash
npm install
npx supabase functions serve    # Edge Functions en local (port 54321)
npm run dev                     # web sur :3000
```

### 4. Tests

```bash
npm run test                    # Vitest : pdf-builder, signature webhook FedaPay, tiers impayés
npm run typecheck               # tsc --noEmit sur le frontend
npm run test:e2e                # Playwright (nécessite Supabase local + seed)
```

## Fonctionnalités livrées (MVP)

1. **Auth** : inscription/connexion email, OTP téléphone, rôles, consentement APDP (RGPD Bénin).
2. **Recherche géolocalisée** : Leaflet + OSM, filtres (type, budget, ville, zone), rayon km via PostGIS (`search_residences`).
3. **Annonces** : CRUD bailleur, photos (Storage), géocodage Nominatim, limite freemium 1 bien (trigger SQL).
4. **Messagerie** : chat 1-to-1 temps réel (Realtime), pièces jointes, validation de visite par le bailleur (`agree_visit` → bien « en visite »).
5. **Baux** : `create_lease` (bien → « occupée »), `terminate_lease`, caution ≤ 3 mois de loyer (Loi 2022-30).
6. **Paiements** : espèces (signalement + validation bailleur) ; mobile money FedaPay (edge `fedapay-init`, webhook vérifié → confirmation → couverture étendue + quittance auto via trigger).
7. **Quittances** : PDF A4 signé (edge `receipts-sign`), empreinte SHA-256 en pied de page, bucket `receipts`, téléchargement locataire.
8. **Impayés** : CRON quotidien J-3 / J+1 / J+7 — notifications in-app + emails Brevo, déduplication 7 jours.
9. **Admin** : KPIs (`admin_stats`), modération des annonces, gestion rôles/premium.
10. **PWA** : manifest, service worker, installable.

## Sécurité & conformité

- **Aucun secret dans le code ni en frontend** : la clé `service_role` vit exclusivement dans les Edge Functions ; le navigateur n'utilise que la clé anon + RLS.
- **RLS partout** : chacun ne voit/écrit que ses données ; les opérations sensibles passent par des RPC `SECURITY DEFINER` avec contrôles explicites.
- **Webhook FedaPay** : signature vérifiée (HMAC-SHA256, tolérance anti-rejeu 5 min) ; le CRON est protégé par `x-cron-secret`.
- Téléphones jamais loggés ; numéro de paiement non stocké en base (transmis à FedaPay uniquement).
- Suppression de compte complète (`delete_my_account`, RGPD art. 17 — cascades FK), consentement APDP enregistré.

## Règles métier clés

| Règle | Implémentation |
|---|---|
| Seuls les biens **libres** + publiés + vérifiés sont cherchables | `search_residences()` (RPC PostGIS) |
| 1 bien gratuit / Premium pour plus | trigger `enforce_freemium_limit` |
| Caution ≤ 3 mois de loyer | `create_lease` (Loi 2022-30) |
| Quittance auto après paiement confirmé, signée par le bailleur | trigger `on_payment_changed` + edge `receipts-sign` |
| Impayé si `date_fn_couverture < today` sans paiement en attente | `list_overdue_leases()` + CRON |

## En production

- **Frontend** : Vercel (`vercel --prod`), variables `NEXT_PUBLIC_*`.
- **Supabase Cloud** (`qbogbuwnkwqgarbchtyr`) : `supabase link` + `supabase db push`, secrets des Edge Functions dans le dashboard, planification du CRON :

```sql
select cron.schedule('kaza-overdue-daily', '0 6 * * *', $$
  select net.http_post(
    url := 'https://qbogbuwnkwqgarbchtyr.supabase.co/functions/v1/overdue-cron',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', value)
  ) from app_settings where key = 'cron_secret'
$$);
```

- **PWA** : activée automatiquement en build production (`sw.js`).
- Pensum légal : déclaration APDP avant mise en ligne grand public.

## Arborescence frontend notable

```
src/
├── app/(auth)/…          # login, register, verify-otp (split-screen premium)
├── app/(app)/explorer/   # recherche + carte Leaflet + filtres
├── app/(app)/chat/       # liste + fenêtre temps réel
├── app/(app)/dashboard/  # espace locataire (loyers, quittances)
├── app/(app)/landlord/   # biens, baux, paiements à valider, quittances à signer
├── app/(app)/admin/      # KPIs, modération
├── lib/supabase-api.ts   # couche d'accès unique : RPC + tables + edge functions
└── components/           # ui/, layout/, property/, chat/, payment/, notifications/
```