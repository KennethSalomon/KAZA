-- ============================================================
-- 034_finalize_remaining_security_invariants.sql
-- Invariants résiduels remontés par le run d'intégration #101
-- ------------------------------------------------------------

-- ============================================================
-- 1. open_conversation : privilège effectif EXECUTE pour authenticated.
--    Historique : 010/022/999 accordent EXECUTE à authenticated, mais
--    les GRANT sur une fonction sont réinitialisés par chaque
--    CREATE OR REPLACE de cette fonction (DROP implicite des ACL) —
--    tout CREATE OR REPLACE postérieur au dernier GRANT laisse la
--    fonction sans EXECUTE pour authenticated, d'où le
--    "permission denied for function open_conversation" au runtime.
--    Ce bloc DOIT donc rester APRES toute redéfinition de la fonction
--    (aucune migration de ce fichier ne redéfinit open_conversation).
--    anon et public restent explicitement sans EXECUTE.
-- ============================================================
revoke execute on function public.open_conversation(uuid)
  from public, anon;

grant execute on function public.open_conversation(uuid)
  to authenticated;

-- ============================================================
-- 2. residences_guard_owner : suppression du bypass
--    current_user = 'postgres'. La fonction est SECURITY DEFINER :
--    current_user y vaut toujours le propriétaire de la fonction
--    ('postgres') quel que soit l'appelant — le bypass neutralisait
--    donc le garde pour TOUS les utilisateurs, y compris un bailleur
--    tentant de s'auto-vérifier (faille remontée par le run #101 :
--    "landlord CANNOT self-verify" → received true).
--    Nouvelle logique :
--      - service_role (et voie interne sans auth) : laisse passer ;
--      - admin authentifié : laisse passer (is_verified modifiable) ;
--      - utilisateur normal : is_verified et owner_id écrasés par la
--        valeur existante (intouchables), le reste des champs reste
--        éditable normalement.
-- ============================================================
create or replace function public.residences_guard_owner()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  -- Voie interne légitime (webhooks, jobs, Edge Functions)
  if auth.role() = 'service_role' or auth.role() is null then
    return new;
  end if;

  -- Admin authentifié : modération complète autorisée
  if public.is_admin() then
    return new;
  end if;

  -- Utilisateur normal : is_verified et owner_id intouchables
  new.is_verified := old.is_verified;
  new.owner_id := old.owner_id;

  return new;
end;
$$;

-- Le trigger doit rester en place (recréé s'il manquait)
drop trigger if exists residences_before_update_owner on public.residences;
create trigger residences_before_update_owner before update on public.residences
  for each row execute procedure public.residences_guard_owner();

-- ============================================================
-- Vérifications intégrées — échec => migration annulée
-- ============================================================
do $$
begin
  -- A. EXECUTE open_conversation : authenticated oui, anon non
  if not has_function_privilege(
    'authenticated',
    'public.open_conversation(uuid)',
    'EXECUTE'
  ) then
    raise exception 'EXECUTE manquant pour authenticated sur open_conversation(uuid)';
  end if;
  if has_function_privilege(
    'anon',
    'public.open_conversation(uuid)',
    'EXECUTE'
  ) then
    raise exception 'EXECUTE ne doit pas etre accorde a anon sur open_conversation(uuid)';
  end if;

  -- B. La fonction finale reste SECURITY DEFINER avec le garde complet
  if position('security definer' in lower(pg_get_functiondef(
       'public.open_conversation(uuid)'::regprocedure
     ))) = 0 then
    raise exception 'open_conversation doit rester SECURITY DEFINER';
  end if;
  if position('is_verified = true' in lower(pg_get_functiondef(
       'public.open_conversation(uuid)'::regprocedure
     ))) = 0 then
    raise exception 'open_conversation a perdu son garde is_verified = true';
  end if;

  -- B'. residences_guard_owner : plus aucun bypass current_user
  if position('current_user' in lower(pg_get_functiondef(
       'public.residences_guard_owner()'::regprocedure
     ))) > 0 then
    raise exception 'residences_guard_owner contient encore un bypass current_user';
  end if;

  -- B''. Le trigger residences_before_update_owner existe
  if not exists (
    select 1 from pg_trigger tg
     join pg_class c on c.oid = tg.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'residences'
      and tg.tgname = 'residences_before_update_owner'
      and not tg.tgisinternal
  ) then
    raise exception 'trigger residences_before_update_owner absent';
  end if;

  -- C. Invariants paiements déjà posés par 033 doivent rester présents
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public'
       and indexname = 'payments_one_active_per_period'
  ) then
    raise exception 'index payments_one_active_per_period absent (033)';
  end if;
  if not exists (
    select 1 from pg_trigger tg
     join pg_class c on c.oid = tg.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'payments'
      and tg.tgname = 'payments_before_update'
      and not tg.tgisinternal
  ) then
    raise exception 'trigger payments_before_update absent (033)';
  end if;

  raise notice 'OK : EXECUTE open_conversation, garde is_verified sans bypass, invariants paiements verifies.';
end;
$$;
