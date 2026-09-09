-- ============================================================
-- 20260909120000_harden_visit_rpc_grants.sql
-- Correctif post-production : EXECUTE des RPC visits hérité de
-- PUBLIC. Retrait de PUBLIC + anon, grant authenticated uniquement.
-- Ne recrée aucune fonction, ne touche ni tables, ni policies,
-- ni données, ni cron, ni RPC admin.
-- ============================================================

revoke execute on function public.confirm_visit(uuid, int) from public, anon;
grant execute on function public.confirm_visit(uuid, int) to authenticated;

revoke execute on function public.cancel_visit(uuid, text) from public, anon;
grant execute on function public.cancel_visit(uuid, text) to authenticated;

revoke execute on function public.decline_visit(uuid, text) from public, anon;
grant execute on function public.decline_visit(uuid, text) to authenticated;

-- Vérification : échec si authenticated n'a pas EXECUTE,
-- si anon a EXECUTE, ou si PUBLIC (explicite ou implicite)
-- a encore EXECUTE.
do $$
declare
  v_procs oid[] := array[
    'public.confirm_visit(uuid, int)'::regprocedure,
    'public.cancel_visit(uuid, text)'::regprocedure,
    'public.decline_visit(uuid, text)'::regprocedure
  ];
  v_oid oid;
begin
  foreach v_oid in array v_procs loop
    if not has_function_privilege('authenticated', v_oid, 'EXECUTE') then
      raise exception 'ECHEC 20260909120000 : EXECUTE manquant pour authenticated sur %', v_oid::regprocedure::text;
    end if;

    if has_function_privilege('anon', v_oid, 'EXECUTE') then
      raise exception 'ECHEC 20260909120000 : anon a encore EXECUTE sur %', v_oid::regprocedure::text;
    end if;

    if exists (
      select 1
        from pg_proc f
        cross join lateral aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) acl
       where f.oid = v_oid
         and acl.grantee = 0
         and acl.privilege_type = 'EXECUTE'
    ) then
      raise exception 'ECHEC 20260909120000 : PUBLIC a encore EXECUTE sur %', v_oid::regprocedure::text;
    end if;
  end loop;
end $$;