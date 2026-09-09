-- ============================================================
-- 999999_remove_test_admin_rpcs_and_restrict_payments.sql
-- Correctif de sécurité — audit final KAZA (C1, C2, H1, H2)
-- ------------------------------------------------------------
-- Contexte :
--   Les RPC "test / admin" créés par 019_test_helpers.sql et
--   022_test_infrastructure.sql exposent SECURITY DEFINER sans
--   garde is_admin() : reset_test_database() (destruction totale),
--   admin_list_users() (fuite PII), admin_list_residences()
--   (exposition des biens internes). L'application web ne les
--   appelle JAMAIS (vérifié : apps/web ne contient aucune
--   référence, seuls les tests d'intégration les utilisent).
--   La policy payments_insert_tenant laissée par
--   999_fix_rls_complete.sql permettait à un locataire d'insérer
--   un paiement en direct avec status / montant / période /
--   provider_ref arbitraires.
--
-- Correction :
--   - suppression définitive des RPC non gardés (les objets DROPés
--     emportent leurs ACL — plus aucune exécution possible) ;
--   - suppression de l'INSERT direct sur payments : la création
--     d'un paiement passe exclusivement par report_cash_payment
--     (RPC SECURITY DEFINER), fedapay-init et fedapay-webhook
--     (Edge Functions service_role), qui contournent légitimement RLS.
--
-- Version 999999 : le CLI Supabase trie les versions comme chaînes
-- (comparaison lexicale), "999999" > "99999" > "999" : s'exécute en
-- dernier quel que soit l'historique, après 999_fix_rls_complete.sql
-- qui recrée la policy payments_insert_tenant. Ne pas renommer.
-- ============================================================

-- ------------------------------------------------------------
-- C1 — reset_test_database() : wipe total de la base
-- Supression définitive (REVOKE explicite avant DROP).
-- ------------------------------------------------------------
do $$
begin
  revoke execute on function public.reset_test_database() from public, anon, authenticated;
exception when undefined_function then null;
end $$;

drop function if exists public.reset_test_database();

-- ------------------------------------------------------------
-- C2 — admin_list_users(integer) : fuite de tous les profils (PII)
-- ------------------------------------------------------------
do $$
begin
  revoke execute on function public.admin_list_users(integer) from public, anon, authenticated;
exception when undefined_function then null;
end $$;

drop function if exists public.admin_list_users(integer);

-- ------------------------------------------------------------
-- H1 — admin_list_residences(integer) : exposition des biens internes
-- ------------------------------------------------------------
do $$
begin
  revoke execute on function public.admin_list_residences(integer) from public, anon, authenticated;
exception when undefined_function then null;
end $$;

drop function if exists public.admin_list_residences(integer);

-- ------------------------------------------------------------
-- H2 — payments_insert_tenant : plus aucun INSERT direct en RLS
-- L'application n'insère jamais en direct (payments.ts) ; la
-- création passe par report_cash_payment / fedapay-init / webhook.
-- => un locataire ne peut plus choisir status / montant / période /
--    provider_ref / confirmed_at.
-- ------------------------------------------------------------
drop policy if exists payments_insert_tenant on public.payments;

-- ------------------------------------------------------------
-- Vérifications intégrées (aucune donnée sensible affichée)
-- Échec => la migration est annulée par RAISE EXCEPTION.
-- ------------------------------------------------------------
do $$
declare
  v_count int;
begin
  -- C1 : reset_test_database() inexistante
  if to_regprocedure('public.reset_test_database()') is not null then
    raise exception 'ECHEC C1 : reset_test_database() existe encore';
  end if;

  -- C2 : admin_list_users(integer) inexistante
  if to_regprocedure('public.admin_list_users(integer)') is not null then
    raise exception 'ECHEC C2 : admin_list_users(integer) existe encore';
  end if;

  -- H1 : admin_list_residences(integer) inexistante
  if to_regprocedure('public.admin_list_residences(integer)') is not null then
    raise exception 'ECHEC H1 : admin_list_residences(integer) existe encore';
  end if;

  -- H2 : aucune policy INSERT sur payments (plus d'ingestion directe)
  select count(*) into v_count
    from pg_policies
   where schemaname = 'public'
     and tablename = 'payments'
     and cmd = 'INSERT';
  if v_count > 0 then
    raise exception 'ECHEC H2 : % policy INSERT restent sur payments', v_count;
  end if;

  -- Les triggers financiers (verrou anti-fraude UPDATE) restent actifs
  if not exists (
    select 1
      from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'payments'
       and tg.tgname in ('payments_before_update', 'payments_before_update_financial')
  ) then
    raise exception 'ECHEC : trigger payments_before_update* absent';
  end if;

  raise notice 'OK : C1, C2, H1, H2 appliqués — reset/admin RPC supprimés, INSERT direct payments bloqué, triggers anti-fraude actifs.';
end $$;