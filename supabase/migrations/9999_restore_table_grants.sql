-- ============================================================
-- 9999_restore_table_grants.sql — Parité privilèges avec Supabase Cloud
-- ------------------------------------------------------------
-- Le reset local (supabase db reset, CLI 2.1xx) n'applique PAS les
-- privilèges par défaut de Supabase Cloud sur les tables (grant ALL à
-- anon/authenticated). Résultat : toute requête REST (profiles,
-- messages, payments, …) échoue avec « permission denied for table »,
-- alors que les fonctions RPC fonctionnent (default PUBLIC EXECUTE).
--
-- On restaure ici l'état exact de Cloud : grants table/sequence pour
-- anon + authenticated, la protection restant assurée par les policies
-- RLS de chaque table (aucune table n'est exposée sans policy).
-- ============================================================

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;
