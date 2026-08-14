-- ============================================================
-- 011_notification_rejection_fix.sql — Correctifs audit v2
-- 1. Rejet : ne notifier le locataire QUE si le paiement avait
--    réellement démarré chez FedaPay (provider_ref présent).
--    Un init raté (FedaPay down, lien jamais généré) n'est pas
--    un rejet par le bailleur — le message actuel accuserait le
--    bailleur à tort.
-- 2. Anti-rejeu FedaPay symétrique : le timestamp futur est aussi
--    rejeté (skew d'horloge / rejeu dans le futur).
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

  -- 4. Rejet : notif locataire UNIQUEMENT si le paiement était parti
  --    chez FedaPay (provider_ref présent). Un échec d'init (transac-
  --    tion jamais créée) est silencieux — il n'y a rien à notifier.
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