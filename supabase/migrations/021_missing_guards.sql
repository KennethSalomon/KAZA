-- ============================================================
-- 021_missing_guards.sql — Garde-fous manquants sur baux & paiements cash
-- Ajoute les validations manquantes identifiées dans l'audit :
-- 1. create_lease : loyer > 0, date_fin > date_début
-- 2. report_cash_payment : montant borné par rapport au loyer du bail
-- ============================================================

-- 1. Renforcer create_lease
create or replace function public.create_lease(
  p_residence_id uuid,
  p_tenant_id uuid,
  p_start_date date,
  p_monthly_rent numeric,
  p_deposit numeric default 0,
  p_end_date date default null
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_res public.residences%rowtype;
  v_id uuid;
begin
  select * into v_res from public.residences where id = p_residence_id;
  if v_res is null then raise exception 'Bien introuvable' using errcode = 'P0002'; end if;
  if v_res.owner_id <> auth.uid() then
    raise exception 'Vous ne gérez pas ce bien' using errcode = '42501';
  end if;
  if v_res.status = 'occupee' then
    raise exception 'Ce bien est déjà occupé' using errcode = 'P0001';
  end if;
  -- note : Loi 2022-30 du Bénin — caution plafonnée à 3 mois de loyer
  if p_deposit > p_monthly_rent * 3 then
    raise exception 'Caution supérieure à 3 mois de loyer (Loi 2022-30)' using errcode = 'P0001';
  end if;
  -- NOUVEAU : loyer strictement positif
  if p_monthly_rent <= 0 then
    raise exception 'Le loyer mensuel doit être strictement positif' using errcode = 'P0001';
  end if;
  -- NOUVEAU : date de fin postérieure à date de début si fournie
  if p_end_date is not null and p_end_date <= p_start_date then
    raise exception 'La date de fin doit être postérieure à la date de début' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = p_tenant_id) then
    raise exception 'Locataire introuvable' using errcode = 'P0002';
  end if;

  insert into public.leases (residence_id, tenant_id, landlord_id, monthly_rent, deposit, start_date, end_date, date_fn_couverture)
  values (p_residence_id, p_tenant_id, auth.uid(), p_monthly_rent, p_deposit, p_start_date, p_end_date, p_start_date)
  returning id into v_id;

  update public.residences set status = 'occupee' where id = p_residence_id;

  insert into public.notifications (user_id, type, title, body, data)
  values (p_tenant_id, 'lease', 'Bail créé',
          concat('Votre bail pour « ', v_res.title, ' » a été créé — bienvenue chez vous.'),
          jsonb_build_object('lease_id', v_id));

  return v_id;
end;
$$;

grant execute on function public.create_lease(uuid, uuid, date, numeric, numeric, date) to authenticated;

-- 2. Borner le montant des paiements cash par rapport au loyer du bail
-- On ajoute un trigger BEFORE INSERT sur payments pour valider les paiements cash
create or replace function public.validate_cash_payment_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease public.leases%rowtype;
  v_min numeric;
  v_max numeric;
begin
  -- Ne valider que les paiements cash (méthode = 'cash' ou 'mobile_money' avec provider = 'cash')
  if new.method <> 'cash' and not (new.method = 'mobile_money' and new.provider = 'cash') then
    return new;
  end if;

  -- Récupérer le bail associé
  select * into v_lease from public.leases where id = new.lease_id;
  if v_lease is null then
    raise exception 'Bail introuvable pour validation montant' using errcode = 'P0002';
  end if;

  -- Bornes : entre 0.5x et 6x le loyer mensuel
  v_min := v_lease.monthly_rent * 0.5;
  v_max := v_lease.monthly_rent * 6;

  if new.amount < v_min or new.amount > v_max then
    raise exception
      'Montant hors bornes autorisées (0.5x à 6x le loyer mensuel = ' ||
      v_min || ' à ' || v_max || ' FCFA)' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_cash_payment_amount on public.payments;
create trigger validate_cash_payment_amount
  before insert on public.payments
  for each row execute function public.validate_cash_payment_amount();

grant execute on function public.validate_cash_payment_amount() to authenticated;