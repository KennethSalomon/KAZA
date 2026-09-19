-- ============================================================
-- Migration 031: Expenses + Cashflow (P0-C + P0-D)
-- Gestion des dépenses et cash-flow patrimonial bailleur
-- ============================================================

-- ------------------------------------------------------------
-- Enum : catégorie de dépense
-- ------------------------------------------------------------
create type public.expense_category as enum (
  'travaux',
  'charges',
  'taxes',
  'assurance',
  'autre'
);

-- ------------------------------------------------------------
-- Table : expenses
-- ------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  residence_id uuid references public.residences (id) on delete set null,
  category public.expense_category not null,
  amount numeric(12,2) not null check (amount > 0),
  date date not null default current_date,
  description text,
  receipt_url text,
  receipt_sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_landlord_date_idx on public.expenses (landlord_id, date desc);
create index expenses_landlord_category_idx on public.expenses (landlord_id, category);
create index expenses_residence_date_idx on public.expenses (residence_id, date desc);
create index expenses_landlord_residence_idx on public.expenses (landlord_id, residence_id) where residence_id is not null;

alter table public.expenses enable row level security;

-- RLS : SELECT - le bailleur voit ses dépenses
create policy expenses_select on public.expenses
  for select using (landlord_id = auth.uid());

-- RLS : INSERT - le bailleur crée ses dépenses, avec vérification résidence
create policy expenses_insert on public.expenses
  for insert with check (
    landlord_id = auth.uid()
    and (
      residence_id is null
      or exists (
        select 1 from public.residences r
        where r.id = residence_id and r.owner_id = auth.uid()
      )
    )
  );

-- RLS : UPDATE - le bailleur modifie ses dépenses
create policy expenses_update on public.expenses
  for update using (landlord_id = auth.uid())
  with check (
    landlord_id = auth.uid()
    and (
      residence_id is null
      or exists (
        select 1 from public.residences r
        where r.id = residence_id and r.owner_id = auth.uid()
      )
    )
  );

-- RLS : DELETE - le bailleur supprime ses dépenses
create policy expenses_delete on public.expenses
  for delete using (landlord_id = auth.uid());

-- Trigger updated_at
create trigger expenses_touch before update on public.expenses
  for each row execute procedure public.touch_updated_at();

-- ------------------------------------------------------------
-- RPC : list_landlord_expenses
-- ------------------------------------------------------------
create or replace function public.list_landlord_expenses(
  p_from date default null,
  p_to date default null,
  p_category public.expense_category default null,
  p_residence_id uuid default null
)
returns table (
  id uuid,
  landlord_id uuid,
  residence_id uuid,
  category public.expense_category,
  amount numeric,
  date date,
  description text,
  receipt_url text,
  receipt_sha256 text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;

  return query
  select e.id, e.landlord_id, e.residence_id, e.category, e.amount, e.date,
         e.description, e.receipt_url, e.receipt_sha256, e.created_at, e.updated_at
  from public.expenses e
  where e.landlord_id = v_uid
    and (p_from is null or e.date >= p_from)
    and (p_to is null or e.date <= p_to)
    and (p_category is null or e.category = p_category)
    and (p_residence_id is null or e.residence_id = p_residence_id)
  order by e.date desc, e.created_at desc;
end;
$$;

revoke execute on function public.list_landlord_expenses(date,date,public.expense_category,uuid) from public, anon;
grant execute on function public.list_landlord_expenses(date,date,public.expense_category,uuid) to authenticated;

-- ------------------------------------------------------------
-- RPC : create_expense
-- ------------------------------------------------------------
create or replace function public.create_expense(
  p_category public.expense_category,
  p_amount numeric,
  p_date date,
  p_description text default null,
  p_residence_id uuid default null,
  p_receipt_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;

  if p_amount <= 0 then
    raise exception 'Montant invalide' using errcode = '22023';
  end if;

  if p_date > current_date then
    raise exception 'Date future non autorisée' using errcode = '22023';
  end if;

  if p_residence_id is not null then
    if not exists (
      select 1 from public.residences r
      where r.id = p_residence_id and r.owner_id = v_uid
    ) then
      raise exception 'Résidence introuvable ou non autorisée' using errcode = '42501';
    end if;
  end if;

  insert into public.expenses (landlord_id, residence_id, category, amount, date, description, receipt_url)
  values (v_uid, p_residence_id, p_category, p_amount, p_date, p_description, p_receipt_path)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.create_expense(public.expense_category,numeric,date,text,uuid,text) from public, anon;
grant execute on function public.create_expense(public.expense_category,numeric,date,text,uuid,text) to authenticated;

-- ------------------------------------------------------------
-- RPC : update_expense
-- ------------------------------------------------------------
create or replace function public.update_expense(
  p_id uuid,
  p_category public.expense_category,
  p_amount numeric,
  p_date date,
  p_description text default null,
  p_residence_id uuid default null,
  p_receipt_path text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_exists boolean;
begin
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;

  if p_amount <= 0 then
    raise exception 'Montant invalide' using errcode = '22023';
  end if;

  if p_date > current_date then
    raise exception 'Date future non autorisée' using errcode = '22023';
  end if;

  if p_residence_id is not null then
    if not exists (
      select 1 from public.residences r
      where r.id = p_residence_id and r.owner_id = v_uid
    ) then
      raise exception 'Résidence introuvable ou non autorisée' using errcode = '42501';
    end if;
  end if;

  select exists (select 1 from public.expenses where id = p_id and landlord_id = v_uid) into v_exists;
  if not v_exists then
    raise exception 'Dépense introuvable' using errcode = 'P0002';
  end if;

  update public.expenses
  set category = p_category,
      amount = p_amount,
      date = p_date,
      description = p_description,
      residence_id = p_residence_id,
      receipt_url = p_receipt_path
  where id = p_id and landlord_id = v_uid;
end;
$$;

revoke execute on function public.update_expense(uuid,public.expense_category,numeric,date,text,uuid,text) from public, anon;
grant execute on function public.update_expense(uuid,public.expense_category,numeric,date,text,uuid,text) to authenticated;

-- ------------------------------------------------------------
-- RPC : delete_expense
-- ------------------------------------------------------------
create or replace function public.delete_expense(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_receipt_path text;
begin
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;

  select receipt_url into v_receipt_path from public.expenses where id = p_id and landlord_id = v_uid;
  if v_receipt_path is null then
    raise exception 'Dépense introuvable' using errcode = 'P0002';
  end if;

  delete from public.expenses where id = p_id and landlord_id = v_uid;

  -- Note: suppression du fichier Storage laissée au frontend (ou job de nettoyage)
end;
$$;

revoke execute on function public.delete_expense(uuid) from public, anon;
grant execute on function public.delete_expense(uuid) to authenticated;

-- ------------------------------------------------------------
-- RPC : landlord_cashflow
-- Cash-flow mensuel : expected, collected, overdue, expenses, net
-- ------------------------------------------------------------
create or replace function public.landlord_cashflow(
  p_from date,
  p_to date
)
returns table (
  month date,
  expected numeric,
  collected numeric,
  overdue numeric,
  expenses numeric,
  net numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;

  if p_from > p_to then
    raise exception 'Période invalide' using errcode = '22023';
  end if;

  return query
  with months as (
    select generate_series(
             date_trunc('month', p_from)::date,
             date_trunc('month', p_to)::date,
             '1 month'
           )::date as month_start
  ),
  expected_monthly as (
    select m.month_start,
           coalesce(sum(l.monthly_rent), 0)::numeric(12,2) as expected
    from months m
    left join public.leases l
      on l.landlord_id = v_uid
     and l.status = 'active'
     and l.start_date <= (m.month_start + interval '1 month - 1 day')::date
     and (l.end_date is null or l.end_date >= m.month_start)
    group by m.month_start
  ),
  collected_monthly as (
    -- Ventilation proportionnelle des paiements confirmed sur les mois couverts
    select m.month_start,
           coalesce(sum(
             p.amount *
             (least(p.period_end, (m.month_start + interval '1 month - 1 day')::date) -
              greatest(p.period_start, m.month_start) + 1)::numeric /
             nullif((p.period_end - p.period_start + 1)::numeric, 0)
           ), 0)::numeric(12,2) as collected
    from months m
    left join public.payments p
      on p.landlord_id = v_uid
     and p.status = 'confirmed'
     and p.period_start <= (m.month_start + interval '1 month - 1 day')::date
     and p.period_end >= m.month_start
    group by m.month_start
  ),
  overdue_monthly as (
    -- Impayés : baux actifs dont date_fn_couverture < début du mois
    -- sans paiement confirmed couvrant ce mois
    select m.month_start,
           coalesce(sum(l.monthly_rent), 0)::numeric(12,2) as overdue
    from months m
    left join public.leases l
      on l.landlord_id = v_uid
     and l.status = 'active'
     and l.date_fn_couverture < m.month_start
     and not exists (
       select 1 from public.payments p
       where p.lease_id = l.id
         and p.status = 'confirmed'
         and p.period_start <= (m.month_start + interval '1 month - 1 day')::date
         and p.period_end >= m.month_start
     )
    group by m.month_start
  ),
  expenses_monthly as (
    select date_trunc('month', e.date)::date as month_start,
           coalesce(sum(e.amount), 0)::numeric(12,2) as expenses
    from public.expenses e
    where e.landlord_id = v_uid
      and e.date >= p_from
      and e.date <= p_to
    group by date_trunc('month', e.date)
  )
  select m.month_start as month,
         em.expected,
         coalesce(cm.collected, 0) as collected,
         coalesce(om.overdue, 0) as overdue,
         coalesce(xm.expenses, 0) as expenses,
         (coalesce(cm.collected, 0) - coalesce(xm.expenses, 0)) as net
  from months m
  left join expected_monthly em on em.month_start = m.month_start
  left join collected_monthly cm on cm.month_start = m.month_start
  left join overdue_monthly om on om.month_start = m.month_start
  left join expenses_monthly xm on xm.month_start = m.month_start
  order by m.month_start;
end;
$$;

revoke execute on function public.landlord_cashflow(date,date) from public, anon;
grant execute on function public.landlord_cashflow(date,date) to authenticated;

-- ------------------------------------------------------------
-- Index de performance pour cashflow
-- ------------------------------------------------------------
create index if not exists payments_landlord_confirmed_period_idx
  on public.payments (landlord_id, status, period_start, period_end)
  where status = 'confirmed';

create index if not exists leases_landlord_active_period_idx
  on public.leases (landlord_id, status, start_date, end_date, date_fn_couverture)
  where status = 'active';

create index if not exists expenses_landlord_date_idx
  on public.expenses (landlord_id, date desc);