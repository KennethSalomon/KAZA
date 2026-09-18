-- ============================================================
-- 033_admin_conversations_and_payment_invariants.sql
-- Invariants résiduels remontés par les runs d'intégration #98/#99
-- ------------------------------------------------------------

-- 1. conversations : accès lecture admin, aligné sur leases/payments/
--    receipts (001_init) qui incluent déjà is_admin(). L'admin peut
--    examiner les conversations pour la modération / le support.
--    Messages hérite via sa policy EXISTS sur conversations : l'admin
--    obtient automatiquement la lecture sans policy distincte.
drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select using (
    tenant_id = auth.uid()
    or landlord_id = auth.uid()
    or public.is_admin()
  );

-- ============================================================
-- 2. Idempotence des paiements cash : un seul paiement
--    pending/confirmed par (bail, période).
--    Un paiement rejected reste retraitable (index partiel).
--    La contrainte fournit la garantie atomique en concurrence —
--    report_cash_payment garde son INSERT normal : le 2e appel
--    échoue avec une erreur de contrainte unique (23505).
-- ============================================================
create unique index if not exists payments_one_active_per_period
  on public.payments (lease_id, period_start, period_end)
  where status in ('pending', 'confirmed');

-- ============================================================
-- 3. Confirmation idempotente (retry réseau) : un UPDATE
--    confirmed -> confirmed (champs d'audit identiques) devient
--    un NO-OP : pas d'erreur, pas de seconde quittance (le
--    on conflict (payment_id) du trigger reste la 2e barrière),
--    pas de modification frauduleuse. Tout autre changement d'un
--    paiement confirmé (statut, montant, période) reste interdit.
-- ============================================================
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
  -- chez FedaPay (provider_ref présent). Un échec d'init (transac-
  -- tion jamais créée) est silencieux — il n'y a rien à notifier.
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

-- ============================================================
-- Vérifications intégrées — échec => migration annulée
-- ============================================================
do $$
declare
  v_old text;
begin
  -- conversations_select inclut bien is_admin()
  select pg_get_expr(pol.qual, pol.polrelid) into v_old
    from pg_policy pol
   where pol.polname = 'conversations_select'
     and pol.polrelid = 'public.conversations'::regclass;
  if v_old is null or position('is_admin' in lower(v_old)) = 0 then
    raise exception 'ECHEC : conversations_select sans is_admin()';
  end if;

  -- Index unique partiel présent
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public'
       and indexname = 'payments_one_active_per_period'
  ) then
    raise exception 'ECHEC : index payments_one_active_per_period absent';
  end if;

  -- Le trigger existe toujours
  if not exists (
    select 1 from pg_trigger tg
     join pg_class c on c.oid = tg.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'payments'
      and tg.tgname = 'payments_before_update'
  ) then
    raise exception 'ECHEC : trigger payments_before_update absent';
  end if;

  raise notice 'OK : admin conversations, idempotence paiements, retry confirmed->confirmed.';
end;
$$;
