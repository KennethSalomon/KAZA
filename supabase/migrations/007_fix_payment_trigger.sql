-- ============================================================
-- 007_fix_payment_trigger.sql — Fusionne payments_guard_immutable
-- et on_payment_changed en un seul trigger BEFORE UPDATE.
-- Corrige le bug introduit par 002 qui supprimait les
-- notifications/quittances lors de la confirmation d'un paiement.
-- ============================================================

create or replace function public.payments_before_update_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  -- 1. Immutabilité : un paiement confirmé ne peut plus être modifié
  if old.status = 'confirmed' then
    raise exception 'Un paiement confirmé est immuable' using errcode = '42501';
  end if;

  -- 2. Cohérence : confirmed exige confirmed_at
  if new.status = 'confirmed' and new.confirmed_at is null then
    raise exception 'confirmed_at requis pour confirmer' using errcode = '23514';
  end if;

  -- 3. Confirmation : couverture étendue + quittance créée + notif locataire
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

  -- 4. Rejet : notif locataire
  if new.status = 'rejected' and old.status = 'pending' then
    insert into public.notifications (user_id, type, title, body, data)
    values (new.tenant_id, 'payment', 'Paiement rejeté',
            concat('Le bailleur n''a pas confirmé votre paiement de ', new.amount, ' FCFA.'),
            jsonb_build_object('payment_id', new.id));
  end if;

  return new;
end;
$$;

drop trigger if exists payments_before_update on public.payments;
create trigger payments_before_update before update on public.payments
  for each row execute procedure public.payments_before_update_guard();
