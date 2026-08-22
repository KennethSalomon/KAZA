-- ============================================================
-- 027_fix_cron_auth_and_visits.sql
-- 1. Store cron secrets in a table (pg_cron can read them)
-- 2. Add cancel_visit / decline_visit RPCs
-- 3. Add price_monthly upper bound CHECK
-- ============================================================

-- 1. Cron secrets table (shared between pg_cron jobs and Edge Functions)
create table if not exists public._cron_secrets (
  name text primary key,
  secret text not null
);

-- RLS: only service_role can read (Edge Functions use service_role key)
alter table public._cron_secrets enable row level security;
create policy cron_secrets_service_only on public._cron_secrets
  for all using (auth.role() = 'service_role');

-- Seed CRON_SECRET placeholder (user must update via SQL Editor after setting env var)
-- In production: INSERT INTO _cron_secrets (name, secret) VALUES ('visit-reminders', '<CRON_SECRET>');
-- For local dev with app.settings: see pg_cron fix below.

-- 2. Fix pg_cron visit-reminders to use x-cron-secret from the table
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    -- Remove old job if it exists
    begin
      perform cron.unschedule('visit-reminders-daily');
    exception when others then
      null; -- job didn't exist
    end;

    -- Re-schedule with x-cron-secret read from _cron_secrets table
    perform cron.schedule('visit-reminders-daily', '0 7 * * *', $cronjob$
      select net.http_post(
        url := coalesce(
          current_setting('app.settings.supabase_url', true),
          (select secret from public._cron_secrets where name = 'supabase_url')
        ) || '/functions/v1/visit-reminders',
        headers := jsonb_build_object(
          'x-cron-secret',
          coalesce(
            (select secret from public._cron_secrets where name = 'visit-reminders'),
            current_setting('app.settings.cron_secret', true)
          )
        ),
        body := '{}'::jsonb
      );
    $cronjob$);
  end if;
end $$;

-- 3. Fix overdue-cron similarly (if pg_cron available)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    begin
      perform cron.unschedule('overdue-cron-daily');
    exception when others then
      null;
    end;

    perform cron.schedule('overdue-cron-daily', '0 8 * * *', $cronjob$
      select net.http_post(
        url := coalesce(
          current_setting('app.settings.supabase_url', true),
          (select secret from public._cron_secrets where name = 'supabase_url')
        ) || '/functions/v1/overdue-cron',
        headers := jsonb_build_object(
          'x-cron-secret',
          coalesce(
            (select secret from public._cron_secrets where name = 'overdue-cron'),
            current_setting('app.settings.cron_secret', true)
          )
        ),
        body := '{}'::jsonb
      );
    $cronjob$);
  end if;
end $$;

-- 4. cancel_visit RPC (locataire ou bailleur peut annuler une visite proposée/confirmée)
create or replace function public.cancel_visit(
  p_visit_id uuid,
  p_reason text default null
)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_visit public.visits%rowtype;
  v_conv public.conversations%rowtype;
  v_cancelled_by text;
begin
  select * into v_visit from public.visits where id = p_visit_id;
  if v_visit is null then
    raise exception 'Visite introuvable' using errcode = 'P0002';
  end if;
  if v_visit.status not in ('proposed', 'confirmed') then
    raise exception 'Cette visite ne peut plus être annulée' using errcode = 'P0001';
  end if;

  select * into v_conv from public.conversations where id = v_visit.conversation_id;

  -- Seul le bailleur, le locataire, ou un admin peut annuler
  if auth.uid() not in (v_visit.proposed_by, v_visit.confirmed_by, v_conv.landlord_id) then
    raise exception 'Vous ne pouvez pas annuler cette visite' using errcode = '42501';
  end if;

  if auth.uid() = v_visit.proposed_by then
    v_cancelled_by := 'locataire';
  elsif auth.uid() = v_conv.landlord_id then
    v_cancelled_by := 'bailleur';
  else
    v_cancelled_by := 'admin';
  end if;

  update public.visits
     set status = 'cancelled'
   where id = p_visit_id;

  -- Message système dans chat
  insert into public.messages (conversation_id, sender_id, body, kind)
  values (v_visit.conversation_id, auth.uid(),
          '❌ Visite annulée par le ' || v_cancelled_by ||
          case when p_reason is not null and p_reason != '' then ' (' || p_reason || ')' else '' end,
          'visit_cancelled');

  -- Notification au participant opposé
  insert into public.notifications (user_id, type, title, body, data)
  values (
    case when auth.uid() = v_conv.tenant_id then v_conv.landlord_id else v_conv.tenant_id end,
    'visit',
    'Visite annulée',
    'Une visite prévue le ' || to_char(v_visit.slot_start, 'DD/MM/YYYY à HH24:MI') || ' a été annulée.',
    jsonb_build_object('visit_id', p_visit_id, 'conversation_id', v_visit.conversation_id)
  );
end;
$$;

-- 5. decline_visit RPC (bailleur rejette une proposition de visite)
create or replace function public.decline_visit(
  p_visit_id uuid,
  p_reason text default null
)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_visit public.visits%rowtype;
  v_conv public.conversations%rowtype;
begin
  select * into v_visit from public.visits where id = p_visit_id;
  if v_visit is null then
    raise exception 'Visite introuvable' using errcode = 'P0002';
  end if;
  if v_visit.status <> 'proposed' then
    raise exception 'Seules les visites en attente peuvent être refusées' using errcode = 'P0001';
  end if;

  select * into v_conv from public.conversations where id = v_visit.conversation_id;
  if v_conv.landlord_id <> auth.uid() then
    raise exception 'Seul le bailleur peut refuser une visite' using errcode = '42501';
  end if;

  update public.visits
     set status = 'cancelled'
   where id = p_visit_id;

  -- Message système
  insert into public.messages (conversation_id, sender_id, body, kind)
  values (v_visit.conversation_id, auth.uid(),
          '❌ Proposition de visite refusée' ||
          case when p_reason is not null and p_reason != '' then ' (' || p_reason || ')' else '' end,
          'visit_cancelled');

  -- Notification au locataire
  insert into public.notifications (user_id, type, title, body, data)
  values (v_conv.tenant_id, 'visit', 'Proposition refusée',
          'Votre proposition de visite pour le ' || to_char(v_visit.slot_start, 'DD/MM/YYYY à HH24:MI') || ' a été refusée.',
          jsonb_build_object('visit_id', p_visit_id, 'conversation_id', v_visit.conversation_id));
end;
$$;

-- 6. price_monthly upper bound CHECK (500 000 FCFA/mois — prevents data entry typos)
do $$
begin
  -- Drop existing check if any, then add bounded one
  begin
    alter table public.residences drop constraint if exists residences_price_monthly_check;
  exception when others then
    null;
  end;
  alter table public.residences
    add constraint residences_price_monthly_check
    check (price_monthly >= 0 and price_monthly <= 500000);
end $$;
