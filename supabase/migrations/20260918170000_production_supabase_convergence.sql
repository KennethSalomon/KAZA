-- ============================================================================
-- 20260918170000_production_supabase_convergence.sql
-- KAZA — convergence finale de l'état Supabase avec main.
--
-- Objectif :
--   1) rétablir les objets 030-034 réellement attendus par l'application ;
--   2) rendre la migration idempotente sur reset et sur le remote actuel ;
--   3) supprimer le cron visit-reminders historique (Bearer/app.settings) ;
--   4) créer les cron modernes visit-reminders + overdue-cron ;
--   5) conserver les secrets existants et créer uniquement les entrées manquantes
--      nécessaires au fallback Edge Function.
--
-- Cette migration ne supprime/modifie aucune donnée métier.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. LANDLORD DASHBOARD STATS (030)
-- ----------------------------------------------------------------------------

create or replace function public.landlord_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;

  select role into v_role
    from public.profiles
   where id = v_uid;

  if v_role not in ('bailleur', 'admin') then
    raise exception 'Accès réservé aux bailleurs' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_properties', coalesce(prop_stats.total, 0),
    'occupied', coalesce(prop_stats.occupied, 0),
    'vacant', coalesce(prop_stats.vacant, 0),
    'in_visit', coalesce(prop_stats.in_visit, 0),
    'maintenance', coalesce(prop_stats.maintenance, 0),
    'total_monthly_rent', coalesce(lease_stats.total_monthly_rent, 0),
    'collected_this_month', coalesce(payment_stats.collected_this_month, 0),
    'overdue_total', coalesce(overdue_stats.overdue_total, 0),
    'overdue_count', coalesce(overdue_stats.overdue_count, 0),
    'pending_receipts', coalesce(receipt_stats.pending_count, 0),
    'upcoming_due_7d', coalesce(upcoming_stats.upcoming_count, 0),
    'expenses_this_month', coalesce(expense_stats.expenses_this_month, 0)
  )
  into v_result
  from (
    select
      count(*)::int as total,
      count(distinct l.residence_id)::int as occupied,
      count(*) filter (where r.status = 'libre')::int as vacant,
      count(*) filter (where r.status = 'en_visite')::int as in_visit,
      count(*) filter (where r.status = 'maintenance')::int as maintenance
    from public.residences r
    left join public.leases l
      on l.residence_id = r.id
     and l.landlord_id = r.owner_id
     and l.status = 'active'
    where r.owner_id = v_uid
  ) prop_stats
  cross join (
    select coalesce(sum(monthly_rent), 0)::numeric(12,2) as total_monthly_rent
      from public.leases
     where landlord_id = v_uid
       and status = 'active'
  ) lease_stats
  cross join (
    select coalesce(sum(allocated_amount), 0)::numeric(12,2) as collected_this_month
      from (
        select
          p.amount *
          (
            least(
              p.period_end,
              (date_trunc('month', now()) + interval '1 month - 1 day')::date
            )
            -
            greatest(
              p.period_start,
              date_trunc('month', now())::date
            ) + 1
          )::numeric
          /
          nullif((p.period_end - p.period_start + 1)::numeric, 0) as allocated_amount
        from public.payments p
        where p.landlord_id = v_uid
          and p.status = 'confirmed'
          and p.period_start <= (date_trunc('month', now()) + interval '1 month - 1 day')::date
          and p.period_end >= date_trunc('month', now())::date
      ) allocated
  ) payment_stats
  cross join (
    select
      coalesce(sum(monthly_rent), 0)::numeric(12,2) as overdue_total,
      count(*)::int as overdue_count
      from public.leases l
     where l.landlord_id = v_uid
       and l.status = 'active'
       and l.date_fn_couverture < current_date
       and not exists (
         select 1
           from public.payments p
          where p.lease_id = l.id
            and p.status = 'pending'
            and p.period_end >= l.date_fn_couverture
       )
  ) overdue_stats
  cross join (
    select count(*)::int as pending_count
      from public.receipts
     where landlord_id = v_uid
       and status = 'pending_signature'
  ) receipt_stats
  cross join (
    select count(*)::int as upcoming_count
      from public.leases l
     where l.landlord_id = v_uid
       and l.status = 'active'
       and l.date_fn_couverture >= current_date
       and l.date_fn_couverture <= current_date + 7
  ) upcoming_stats
  cross join (
    select coalesce(sum(e.amount), 0)::numeric(12,2) as expenses_this_month
      from public.expenses e
     where e.landlord_id = v_uid
       and e.date >= date_trunc('month', current_date)::date
       and e.date <= (date_trunc('month', current_date) + interval '1 month - 1 day')::date
  ) expense_stats;

  return v_result;
end;
$$;

revoke execute on function public.landlord_dashboard_stats() from public, anon;
grant execute on function public.landlord_dashboard_stats() to authenticated;

create or replace function public.list_upcoming_due(days int default 7)
returns table (
  lease_id uuid,
  tenant_id uuid,
  landlord_id uuid,
  monthly_rent numeric,
  due_on date
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if days < 0 then
    raise exception 'Fenêtre invalide' using errcode = '22023';
  end if;

  return query
  select
    l.id,
    l.tenant_id,
    l.landlord_id,
    l.monthly_rent,
    l.date_fn_couverture
  from public.leases l
  where l.status = 'active'
    and l.date_fn_couverture >= current_date
    and l.date_fn_couverture <= current_date + days
  order by l.date_fn_couverture asc;
end;
$$;

revoke execute on function public.list_upcoming_due(int) from public, anon;
grant execute on function public.list_upcoming_due(int) to authenticated;

create index if not exists payments_landlord_confirmed_month_idx
  on public.payments (landlord_id, status, period_start, period_end)
  where status = 'confirmed';

create index if not exists leases_landlord_active_due_idx
  on public.leases (landlord_id, status, date_fn_couverture)
  where status = 'active';

create index if not exists receipts_landlord_pending_idx
  on public.receipts (landlord_id, status)
  where status = 'pending_signature';

create index if not exists residences_owner_status_idx
  on public.residences (owner_id, status);

create index if not exists leases_landlord_active_residence_idx
  on public.leases (landlord_id, residence_id)
  where status = 'active';

-- ----------------------------------------------------------------------------
-- 2. EXPENSES + CASHFLOW (031)
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where t.typname = 'expense_category'
       and n.nspname = 'public'
  ) then
    create type public.expense_category as enum (
      'travaux',
      'charges',
      'taxes',
      'assurance',
      'autre'
    );
  end if;
end
$$;

create table if not exists public.expenses (
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

create index if not exists expenses_landlord_date_idx
  on public.expenses (landlord_id, date desc);
create index if not exists expenses_landlord_category_idx
  on public.expenses (landlord_id, category);
create index if not exists expenses_residence_date_idx
  on public.expenses (residence_id, date desc);
create index if not exists expenses_landlord_residence_idx
  on public.expenses (landlord_id, residence_id)
  where residence_id is not null;

alter table public.expenses enable row level security;

drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
  for select using (landlord_id = auth.uid());

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses
  for insert with check (
    landlord_id = auth.uid()
    and (
      residence_id is null
      or exists (
        select 1
          from public.residences r
         where r.id = residence_id
           and r.owner_id = auth.uid()
      )
    )
  );

drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses
  for update
  using (landlord_id = auth.uid())
  with check (
    landlord_id = auth.uid()
    and (
      residence_id is null
      or exists (
        select 1
          from public.residences r
         where r.id = residence_id
           and r.owner_id = auth.uid()
      )
    )
  );

drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses
  for delete using (landlord_id = auth.uid());

drop trigger if exists expenses_touch on public.expenses;
create trigger expenses_touch
  before update on public.expenses
  for each row execute procedure public.touch_updated_at();

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
  select
    e.id,
    e.landlord_id,
    e.residence_id,
    e.category,
    e.amount,
    e.date,
    e.description,
    e.receipt_url,
    e.receipt_sha256,
    e.created_at,
    e.updated_at
  from public.expenses e
  where e.landlord_id = v_uid
    and (p_from is null or e.date >= p_from)
    and (p_to is null or e.date <= p_to)
    and (p_category is null or e.category = p_category)
    and (p_residence_id is null or e.residence_id = p_residence_id)
  order by e.date desc, e.created_at desc;
end;
$$;

revoke execute on function public.list_landlord_expenses(date, date, public.expense_category, uuid) from public, anon;
grant execute on function public.list_landlord_expenses(date, date, public.expense_category, uuid) to authenticated;

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

  if p_residence_id is not null
     and not exists (
       select 1
         from public.residences r
        where r.id = p_residence_id
          and r.owner_id = v_uid
     ) then
    raise exception 'Résidence introuvable ou non autorisée' using errcode = '42501';
  end if;

  insert into public.expenses (
    landlord_id, residence_id, category, amount, date, description, receipt_url
  )
  values (
    v_uid, p_residence_id, p_category, p_amount, p_date, p_description, p_receipt_path
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.create_expense(public.expense_category, numeric, date, text, uuid, text) from public, anon;
grant execute on function public.create_expense(public.expense_category, numeric, date, text, uuid, text) to authenticated;

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

  if p_residence_id is not null
     and not exists (
       select 1
         from public.residences r
        where r.id = p_residence_id
          and r.owner_id = v_uid
     ) then
    raise exception 'Résidence introuvable ou non autorisée' using errcode = '42501';
  end if;

  if not exists (
    select 1
      from public.expenses
     where id = p_id
       and landlord_id = v_uid
  ) then
    raise exception 'Dépense introuvable' using errcode = 'P0002';
  end if;

  update public.expenses
     set category = p_category,
         amount = p_amount,
         date = p_date,
         description = p_description,
         residence_id = p_residence_id,
         receipt_url = p_receipt_path
   where id = p_id
     and landlord_id = v_uid;
end;
$$;

revoke execute on function public.update_expense(uuid, public.expense_category, numeric, date, text, uuid, text) from public, anon;
grant execute on function public.update_expense(uuid, public.expense_category, numeric, date, text, uuid, text) to authenticated;

create or replace function public.delete_expense(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;

  if not exists (
    select 1
      from public.expenses
     where id = p_id
       and landlord_id = v_uid
  ) then
    raise exception 'Dépense introuvable' using errcode = 'P0002';
  end if;

  delete from public.expenses
   where id = p_id
     and landlord_id = v_uid;
end;
$$;

revoke execute on function public.delete_expense(uuid) from public, anon;
grant execute on function public.delete_expense(uuid) to authenticated;

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
    select
      m.month_start,
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
    select
      m.month_start,
      coalesce(sum(
        p.amount *
        (
          least(
            p.period_end,
            (m.month_start + interval '1 month - 1 day')::date
          )
          -
          greatest(p.period_start, m.month_start) + 1
        )::numeric
        /
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
    select
      m.month_start,
      coalesce(sum(l.monthly_rent), 0)::numeric(12,2) as overdue
    from months m
    left join public.leases l
      on l.landlord_id = v_uid
     and l.status = 'active'
     and l.date_fn_couverture < m.month_start
     and not exists (
       select 1
         from public.payments p
        where p.lease_id = l.id
          and p.status = 'confirmed'
          and p.period_start <= (m.month_start + interval '1 month - 1 day')::date
          and p.period_end >= m.month_start
     )
    group by m.month_start
  ),
  expenses_monthly as (
    select
      date_trunc('month', e.date)::date as month_start,
      coalesce(sum(e.amount), 0)::numeric(12,2) as expenses
    from public.expenses e
    where e.landlord_id = v_uid
      and e.date >= p_from
      and e.date <= p_to
    group by date_trunc('month', e.date)
  )
  select
    m.month_start as month,
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

revoke execute on function public.landlord_cashflow(date, date) from public, anon;
grant execute on function public.landlord_cashflow(date, date) to authenticated;

create index if not exists payments_landlord_confirmed_period_idx
  on public.payments (landlord_id, status, period_start, period_end)
  where status = 'confirmed';

create index if not exists leases_landlord_active_period_idx
  on public.leases (landlord_id, status, start_date, end_date, date_fn_couverture)
  where status = 'active';

-- ----------------------------------------------------------------------------
-- 3. EXPENSES STORAGE BUCKET (032)
-- ----------------------------------------------------------------------------

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'expenses',
  'expenses',
  false,
  5 * 1024 * 1024,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 4. CONVERSATIONS + PAYMENT INVARIANT (033)
-- ----------------------------------------------------------------------------

drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select using (
    tenant_id = auth.uid()
    or landlord_id = auth.uid()
    or public.is_admin()
  );

create unique index if not exists payments_one_active_per_period
  on public.payments (lease_id, period_start, period_end)
  where status in ('pending', 'confirmed');

create or replace function public.payments_before_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lease_id is distinct from old.lease_id
     or new.tenant_id is distinct from old.tenant_id
     or new.landlord_id is distinct from old.landlord_id then
    raise exception 'Rattachement du paiement immuable' using errcode = '42501';
  end if;

  if old.status = 'confirmed' and new.status = 'confirmed'
     and new.amount is not distinct from old.amount
     and new.period_start is not distinct from old.period_start
     and new.period_end is not distinct from old.period_end
     and new.provider_ref is not distinct from old.provider_ref
     and new.method is not distinct from old.method
     and new.provider is not distinct from old.provider then
    return old;
  end if;

  if old.status = 'confirmed' then
    raise exception 'Un paiement confirmé est immuable' using errcode = '42501';
  end if;

  if new.status = 'confirmed' and new.confirmed_at is null then
    raise exception 'confirmed_at requis pour confirmer' using errcode = '23514';
  end if;

  if new.status = 'confirmed' and old.status = 'pending' then
    update public.leases
       set date_fn_couverture = greatest(date_fn_couverture, new.period_end)
     where id = new.lease_id;

    insert into public.receipts (
      payment_id,
      lease_id,
      tenant_id,
      landlord_id,
      amount,
      period_start,
      period_end,
      status
    )
    values (
      new.id,
      new.lease_id,
      new.tenant_id,
      new.landlord_id,
      new.amount,
      new.period_start,
      new.period_end,
      'pending_signature'
    )
    on conflict (payment_id) do nothing;

    insert into public.notifications (
      user_id,
      type,
      title,
      body,
      data
    )
    values (
      new.tenant_id,
      'payment',
      'Paiement confirmé',
      concat(new.amount, ' FCFA — bail à jour jusqu''au ', new.period_end),
      jsonb_build_object('payment_id', new.id)
    );
  end if;

  if new.status = 'rejected'
     and old.status = 'pending'
     and old.provider_ref is not null then
    insert into public.notifications (
      user_id,
      type,
      title,
      body,
      data
    )
    values (
      new.tenant_id,
      'payment',
      'Paiement rejeté',
      concat('Votre paiement de ', new.amount, ' FCFA a été refusé.'),
      jsonb_build_object('payment_id', new.id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists payments_before_update on public.payments;
create trigger payments_before_update
  before update on public.payments
  for each row execute procedure public.payments_before_update_guard();

-- ----------------------------------------------------------------------------
-- 5. REMAINING SECURITY INVARIANTS (034)
-- ----------------------------------------------------------------------------

revoke execute on function public.open_conversation(uuid) from public, anon;
grant execute on function public.open_conversation(uuid) to authenticated;

create or replace function public.residences_guard_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or auth.role() is null then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  new.is_verified := old.is_verified;
  new.owner_id := old.owner_id;

  return new;
end;
$$;

drop trigger if exists residences_before_update_owner on public.residences;
create trigger residences_before_update_owner
  before update on public.residences
  for each row execute procedure public.residences_guard_owner();

-- ----------------------------------------------------------------------------
-- 6. CRON SECRETS — KEEP EXISTING VALUES, CREATE ONLY MISSING ENTRIES
-- ----------------------------------------------------------------------------

insert into public._cron_secrets (name, secret)
values
  ('visit-reminders', md5(random()::text || clock_timestamp()::text || gen_random_uuid()::text)),
  ('overdue-cron', md5(random()::text || clock_timestamp()::text || gen_random_uuid()::text))
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- 7. CRON CONVERGENCE
--
-- Production rule:
--   - visit-reminders → x-cron-secret
--   - overdue-cron    → x-cron-secret
--   - push-emitter    → x-cron-secret
--
-- Existing secrets are read from _cron_secrets so their values are never
-- embedded in the migration.
-- ----------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron')
     and exists (select 1 from pg_namespace where nspname = 'net') then

    begin
      perform cron.unschedule('visit-reminders-daily');
    exception when others then
      null;
    end;

    perform cron.schedule(
      'visit-reminders-daily',
      '0 7 * * *',
      $cronjob$
        select net.http_post(
          url := coalesce(
            current_setting('app.settings.supabase_url', true),
            (select secret from public._cron_secrets where name = 'supabase_url')
          ) || '/functions/v1/visit-reminders',
          headers := jsonb_build_object(
            'x-cron-secret',
            (select secret from public._cron_secrets where name = 'visit-reminders')
          ),
          body := '{}'::jsonb
        );
      $cronjob$
    );

    begin
      perform cron.unschedule('overdue-cron-daily');
    exception when others then
      null;
    end;

    perform cron.schedule(
      'overdue-cron-daily',
      '0 8 * * *',
      $cronjob$
        select net.http_post(
          url := coalesce(
            current_setting('app.settings.supabase_url', true),
            (select secret from public._cron_secrets where name = 'supabase_url')
          ) || '/functions/v1/overdue-cron',
          headers := jsonb_build_object(
            'x-cron-secret',
            (select secret from public._cron_secrets where name = 'overdue-cron')
          ),
          body := '{}'::jsonb
        );
      $cronjob$
    );

    begin
      perform cron.unschedule('push-emitter-minutely');
    exception when others then
      null;
    end;

    perform cron.schedule(
      'push-emitter-minutely',
      '* * * * *',
      $cronjob$
        select net.http_post(
          url := coalesce(
            current_setting('app.settings.supabase_url', true),
            (select secret from public._cron_secrets where name = 'supabase_url')
          ) || '/functions/v1/push-emitter',
          headers := jsonb_build_object(
            'x-cron-secret',
            coalesce(
              (select secret from public._cron_secrets where name = 'push-emitter'),
              current_setting('app.settings.cron_secret', true)
            )
          ),
          body := '{}'::jsonb
        );
      $cronjob$
    );
  else
    raise notice 'pg_cron/net indisponible : jobs de production non replanifiés.';
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- 8. POST-CONDITIONS (FAIL FAST)
-- ----------------------------------------------------------------------------

do $$
begin
  if to_regprocedure('public.landlord_dashboard_stats()') is null then
    raise exception 'Convergence échouée : landlord_dashboard_stats() absent';
  end if;

  if to_regprocedure('public.list_landlord_expenses(date,date,public.expense_category,uuid)') is null then
    raise exception 'Convergence échouée : list_landlord_expenses() absent';
  end if;

  if to_regprocedure('public.landlord_cashflow(date,date)') is null then
    raise exception 'Convergence échouée : landlord_cashflow() absent';
  end if;

  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public'
       and indexname = 'payments_one_active_per_period'
  ) then
    raise exception 'Convergence échouée : payments_one_active_per_period absent';
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
    raise exception 'Convergence échouée : trigger payments_before_update absent';
  end if;
end
$$;
