-- ============================================================================
-- 1000001_residences_and_payment_guard_finalization.sql
-- Portage des invariants finaux dans la chaîne active.
--
-- Contexte :
--   Les migrations 033/034 sont archivées (supabase/migrations-archive/) :
--   leur contenu nécessaire à la production est convergé par 1000000.
--   Deux invariants n'étaient toutefois définis QUE dans ces fichiers :
--     1. residences_guard_owner() durci (034) — suppression du bypass
--        current_user = 'postgres' dans une fonction SECURITY DEFINER ;
--     2. payments_before_update_guard() idempotent (033) — retry
--        confirmed -> confirmed en NO-OP.
--   Cette migration les porte dans la chaîne active pour que la chaîne
--   locale (utilisée par les tests CI et tout futur environnement neuf)
--   produise un état final identique à la production convergée.
--
--   Aucun autre objet n'est touché : conversations_select (is_admin),
--   l'index payments_one_active_per_period et les objets expenses/dashboard
--   sont déjà posés par 1000000.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. residences_guard_owner : sans bypass current_user.
--    La fonction est SECURITY DEFINER : current_user y vaut toujours le
--    propriétaire ('postgres') — ce bypass neutralisait le garde pour tous.
--    Logique :
--      - service_role / voie interne (auth.role() null) : laisse passer ;
--      - admin authentifié (is_admin()) : laisse passer ;
--      - utilisateur normal : is_verified et owner_id écrasés par les
--        valeurs existantes (intouchables), le reste reste éditable.
-- ---------------------------------------------------------------------------
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

drop trigger if exists residences_before_update_owner on public.residences;
create trigger residences_before_update_owner before update on public.residences
  for each row execute procedure public.residences_guard_owner();

-- ---------------------------------------------------------------------------
-- 2. payments_before_update_guard : confirmation idempotente.
--    Retry réseau : confirmed -> confirmed (champs métier identiques)
--    = NO-OP. Tout autre changement d'un paiement confirmé reste interdit.
--    Le corps est identique à celui de la production convergée (033).
-- ---------------------------------------------------------------------------
create or replace function public.payments_before_update_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  -- Retry idempotent : confirmed -> confirmed sans changement métier
  -- (les champs d'audit peuvent différer) = no-op.
  if old.status = 'confirmed' and new.status = 'confirmed'
     and new.amount is not distinct from old.amount
     and new.period_start is not distinct from old.period_start
     and new.period_end is not distinct from old.period_end
     and new.provider_ref is not distinct from old.provider_ref
     and new.method is not distinct from old.method
     and new.provider is not distinct from old.provider then
    return old;
  end if;

  -- Immutabilité : un paiement confirmé ne peut plus être modifié
  if old.status = 'confirmed' then
    raise exception 'Un paiement confirmé est immuable' using errcode = '42501';
  end if;

  -- Cohérence : confirmed exige confirmed_at
  if new.status = 'confirmed' and new.confirmed_at is null then
    raise exception 'confirmed_at requis pour confirmer' using errcode = '23514';
  end if;

  -- Confirmation : couverture étendue + quittance créée + notif locataire
  if new.status = 'confirmed' and old.status = 'pending' then
    update public.leases
       set date_fn_couverture = greatest(date_fn_couverture, new.period_end)
     where id = new.lease_id;

    insert into public.receipts (payment_id, lease_id, tenant_id, landlord_id, amount, period_start, period_end, status)
    values (new.id, new.lease_id, new.tenant_id, new.landlord_id, new.amount, new.period_start, new.period_end, 'pending_signature')
    on conflict (payment_id) do nothing;

    insert into public.notifications (user_id, type, title, body, data)
    values (new.tenant_id, 'payment', 'Paiement confirmé',
            concat(new.amount, ' FCFA — bail à jour jusqu''au ', new.period_end),
            jsonb_build_object('payment_id', new.id));
  end if;

  -- Rejet : notif locataire UNIQUEMENT si le paiement était parti
  -- chez FedaPay (provider_ref présent).
  if new.status = 'rejected' and old.status = 'pending'
     and old.provider_ref is not null then
    insert into public.notifications (user_id, type, title, body, data)
    values (new.tenant_id, 'payment', 'Paiement rejeté',
            concat('Votre paiement de ', new.amount, ' FCFA a été refusé.'),
            jsonb_build_object('payment_id', new.id));
  end if;

  return new;
end;
$$;

drop trigger if exists payments_before_update on public.payments;
create trigger payments_before_update before update on public.payments
  for each row execute procedure public.payments_before_update_guard();

-- ---------------------------------------------------------------------------
-- Vérifications intégrées — échec => migration annulée
-- ---------------------------------------------------------------------------
do $$
begin
  -- residences_guard_owner : plus aucun bypass current_user
  if position('current_user' in lower(pg_get_functiondef(
       'public.residences_guard_owner()'::regprocedure
     ))) > 0 then
    raise exception 'residences_guard_owner contient encore un bypass current_user';
  end if;

  -- Trigger residences présent
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

  -- Trigger paiements présent (nom attendu par les tests CI)
  if not exists (
    select 1 from pg_trigger tg
     join pg_class c on c.oid = tg.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'payments'
      and tg.tgname = 'payments_before_update'
      and not tg.tgisinternal
  ) then
    raise exception 'trigger payments_before_update absent';
  end if;

  -- Idempotence confirmed -> confirmed bien présente dans le corps
  if position('return old' in lower(pg_get_functiondef(
       'public.payments_before_update_guard()'::regprocedure
     ))) = 0 then
    raise exception 'payments_before_update_guard a perdu le NO-OP confirmed->confirmed';
  end if;

  -- Invariants déjà posés par 1000000 doivent rester présents
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public'
       and indexname = 'payments_one_active_per_period'
  ) then
    raise exception 'index payments_one_active_per_period absent (1000000)';
  end if;

  raise notice 'OK : guard residences sans bypass, paiements idempotents, invariants 1000000 verifies.';
end;
$$;
