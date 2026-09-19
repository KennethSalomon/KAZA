# migrations-archive — chaîne historique hors migration active

Ce répertoire conserve l'historique des migrations **retirées de la chaîne
active** (`supabase/migrations/`). Elles ne sont plus exécutées par
`supabase db reset`, ne sont plus candidates à `db push`, et ne doivent
**jamais** être réexécutées en production telles quelles.

**`1000000_production_convergence.sql` est désormais le point de convergence
actif** : il reflète l'état de la base de production (projet
`qbogbuwnkwqgarbchtyr`), dont l'historique distant marque bien
`1000000` comme `applied`.

---

## 019_test_helpers.sql

- Migration historique de helpers de test (`get_function_source`,
  `reset_test_database`).
- **NE DOIT PAS être exécutée en production.**
- Les helpers nécessaires aux tests sont désormais injectés explicitement par
  le CI (`.github/workflows/ci.yml`) **après** `supabase db reset` — le dossier
  des migrations actives ne porte plus aucune infrastructure de test.

## 022_test_infrastructure.sql

- Ancienne infrastructure de test/admin (RPC admin de listage, grants).
- **NE DOIT PAS être exécutée en production.**
- Certaines de ces RPC ont été explicitement supprimées par
  `999999_remove_test_admin_rpcs_and_restrict_payments.sql` (toujours actif).

## 028_rls_spatial_ref_sys.sql

- Ancienne tentative de RLS sur `spatial_ref_sys` (table de l'extension
  PostGIS, hors schéma applicatif).
- Non présente dans l'état production actuel ; volontairement conservée hors
  de la chaîne active.
- **Ne pas la marquer `applied`** dans un historique distant.
- Toute réintroduction future devra être une **nouvelle** migration
  postérieure à `1000000`, après revue de sécurité.

## 030_landlord_dashboard_stats.sql

## 031_expenses_cashflow.sql

## 032_expenses_bucket.sql

## 033_admin_conversations_and_payment_invariants.sql

## 034_finalize_remaining_security_invariants.sql

Pour 030 → 034 :

- leurs changements fonctionnels/sécurité nécessaires à la production sont
  **convergés par `1000000`** (expenses + RPC cashflow, bucket storage
  `expenses`, `landlord_dashboard_stats`, `list_upcoming_due`, policy
  `conversations_select` avec `is_admin()`, index partiel unique
  `payments_one_active_per_period`, trigger financier
  `payments_before_update_financial`) ;
- les fichiers sont archivés **pour conserver l'historique** ; ils ne doivent
  plus être considérés comme des migrations actives indépendantes ;
- deux invariants définis uniquement dans 033/034 (guard
  `residences_guard_owner` sans bypass `current_user`, idempotence
  `confirmed → confirmed` des paiements) sont portés dans la chaîne active par
  **`1000001_residences_and_payment_guard_finalization.sql`**.

---

## Règles

1. Ne jamais relancer ces fichiers contre la production.
2. Ne jamais les replacer dans `supabase/migrations/` sans revue : ils
   redeviendraient des candidats `db push`.
3. Les nouveaux correctifs de schéma prennent la forme de migrations
   postérieures à `1000001`.
