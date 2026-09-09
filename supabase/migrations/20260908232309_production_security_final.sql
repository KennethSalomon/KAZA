-- ============================================================
-- 20260908232309_production_security_final.sql
-- Migration canonique post-999999 — convergence sécurité prod.
--
-- Conçue pour fonctionner :
--   A) sur le remote actuel (objets déjà présents →
--      CREATE OR REPLACE / IF NOT EXISTS) ;
--   B) après un supabase db reset (tout doit être recréé).
--
-- Règles :
--   - 019/020/021/022/023/99999 ne sont PAS inclus (test-only
--     ou hors périmètre).
--   - Les RPC test (reset_test_database, get_function_source,
--     admin_list_users, admin_list_residences, create_residence)
--     ne sont JAMAIS recréés.
--   - is_admin() existe déjà (012/999) — non recréé ici.
--   - Les grants 9998 ne sont PAS inclus (déjà sur le remote
--     et abandonnés).
-- ============================================================

-- ============================================================
-- SECTION 1 : VISITS — table, enum, indexes, RLS, policies,
--             confirm_visit
-- ============================================================

-- 1.1 — Enum visit_status (CREATE TYPE IF NOT EXISTS n'existe pas)
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'visit_status'
      and n.nspname = 'public'
  ) then
    create type public.visit_status as enum (
      'proposed', 'confirmed', 'completed', 'cancelled'
    );
  end if;
end $$;

-- 1.2 — Table visits
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  proposed_by uuid not null references public.profiles(id),
  confirmed_by uuid references public.profiles(id),
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  status public.visit_status not null default 'proposed',
  note text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

-- 1.3 — Indexes
create index if not exists visits_conv_idx on public.visits (conversation_id);
create index if not exists visits_status_idx on public.visits (status)
  where status in ('proposed', 'confirmed');

-- 1.4 — RLS (idempotent via DO)
do $$
begin
  if not exists (
    select 1 from pg_class c
    where c.relname = 'visits' and c.relrowsecurity = true
  ) then
    alter table public.visits enable row level security;
  end if;
end $$;

-- 1.5 — Policies
drop policy if exists visits_select on public.visits;
create policy visits_select on public.visits
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.tenant_id = auth.uid() or c.landlord_id = auth.uid())
    )
  );

drop policy if exists visits_insert_tenant on public.visits;
create policy visits_insert_tenant on public.visits
  for insert with check (
    proposed_by = auth.uid() and
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.tenant_id = auth.uid()
    )
  );

drop policy if exists visits_update_landlord on public.visits;
create policy visits_update_landlord on public.visits
  for update using (
    confirmed_by = auth.uid() and
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.landlord_id = auth.uid()
    )
    and status = 'proposed'
  )
  with check (
    confirmed_by = auth.uid() and
    status = 'confirmed'
  );

-- 1.6 — confirm_visit RPC
create or replace function public.confirm_visit(
  p_visit_id uuid,
  p_slot_index int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visit public.visits%rowtype;
  v_conv public.conversations%rowtype;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
begin
  select * into v_visit from public.visits where id = p_visit_id;
  if v_visit is null then
    raise exception 'Visite introuvable' using errcode = 'P0002';
  end if;
  if v_visit.status <> 'proposed' then
    raise exception 'Visite déjà traitée' using errcode = 'P0001';
  end if;

  select * into v_conv from public.conversations where id = v_visit.conversation_id;
  if v_conv.landlord_id <> auth.uid() then
    raise exception 'Seul le bailleur confirme la visite' using errcode = '42501';
  end if;

  v_slot_start := v_visit.slot_start;
  v_slot_end := v_visit.slot_end;

  update public.visits
     set status = 'confirmed',
         confirmed_by = auth.uid(),
         confirmed_at = now(),
         slot_start = v_slot_start,
         slot_end = v_slot_end
   where id = p_visit_id;

  insert into public.messages (conversation_id, sender_id, body, kind)
  values (v_visit.conversation_id, auth.uid(),
          '✅ Visite confirmée pour le ' || to_char(v_slot_start, 'DD/MM/YYYY à HH24:MI'),
          'visit_agreed');

  insert into public.notifications (user_id, type, title, body, data)
  values (v_conv.tenant_id, 'visit', 'Visite confirmée',
          'Le bailleur vous reçoit le ' || to_char(v_slot_start, 'DD/MM/YYYY à HH24:MI'),
          jsonb_build_object('visit_id', p_visit_id, 'conversation_id', v_visit.conversation_id));

  update public.residences
     set status = 'en_visite'
   where id = v_conv.residence_id and status = 'libre';
end;
$$;

grant execute on function public.confirm_visit(uuid, int) to authenticated;

-- 1.7 — pg_cron visit-reminders (garde-fou si extension absente)
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then
    begin
      create extension if not exists pg_cron;
    exception when others then
      raise notice 'pg_cron indisponible — visit-reminders ignoré';
    end;
  end if;

  if exists (select 1 from pg_namespace where nspname = 'cron') then
    begin
      perform cron.unschedule('visit-reminders-daily');
    exception when others then
      null;
    end;

    perform cron.schedule('visit-reminders-daily', '0 7 * * *', $cronjob$
      select net.http_post(
        url := 'https://' || current_setting('app.settings.supabase_url') || '/functions/v1/visit-reminders',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
        body := '{}'::jsonb
      );
    $cronjob$);
  end if;
end $$;

-- ============================================================
-- SECTION 2 : REPORT CASH PAYMENT
-- ============================================================

create or replace function public.report_cash_payment(
  p_lease_id uuid,
  p_amount numeric,
  p_period_start date,
  p_period_end date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_landlord_id uuid;
begin
  select tenant_id, landlord_id into v_tenant_id, v_landlord_id
    from public.leases
   where id = p_lease_id;

  if v_tenant_id is null then
    raise exception 'Bail introuvable' using errcode = 'P0002';
  end if;

  if v_tenant_id != auth.uid() then
    raise exception 'Vous n''êtes pas le locataire de ce bail' using errcode = '42501';
  end if;

  insert into public.payments (
    lease_id, tenant_id, landlord_id, amount,
    period_start, period_end, method, provider, status
  ) values (
    p_lease_id, v_tenant_id, v_landlord_id, p_amount,
    p_period_start, p_period_end, 'cash', 'cash', 'pending'
  );
end;
$$;

grant execute on function public.report_cash_payment(uuid, numeric, date, date) to authenticated;

-- ============================================================
-- SECTION 3 : ADMIN AUDIT LOGS
-- ============================================================

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  target_type text not null,
  target_id uuid,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_admin_idx on public.admin_audit_logs (admin_id, created_at desc);
create index if not exists admin_audit_logs_target_idx on public.admin_audit_logs (target_type, target_id);

-- RLS idempotent
do $$
begin
  if not exists (
    select 1 from pg_class c
    where c.relname = 'admin_audit_logs' and c.relrowsecurity = true
  ) then
    alter table public.admin_audit_logs enable row level security;
  end if;
end $$;

-- Policies : admin uniquement
drop policy if exists admin_audit_logs_select_admin on public.admin_audit_logs;
create policy admin_audit_logs_select_admin on public.admin_audit_logs
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists admin_audit_logs_insert_admin on public.admin_audit_logs;
create policy admin_audit_logs_insert_admin on public.admin_audit_logs
  for insert with check (
    auth.uid() = admin_id and
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- log_admin_action RPC
create or replace function public.log_admin_action(
  p_action text,
  p_target_type text,
  p_target_id uuid default null,
  p_old_value jsonb default null,
  p_new_value jsonb default null,
  p_metadata jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Accès réservé aux administrateurs' using errcode = '42501';
  end if;

  insert into public.admin_audit_logs (
    admin_id, action, target_type, target_id, old_value, new_value, metadata
  ) values (
    auth.uid(), p_action, p_target_type, p_target_id, p_old_value, p_new_value, p_metadata
  );
end;
$$;

grant execute on function public.log_admin_action(text, text, uuid, jsonb, jsonb, jsonb) to authenticated;

-- list_admin_audit_logs RPC
create or replace function public.list_admin_audit_logs(
  p_limit int default 100,
  p_offset int default 0,
  p_admin_id uuid default null,
  p_target_type text default null,
  p_action text default null
)
returns setof public.admin_audit_logs
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Accès réservé aux administrateurs' using errcode = '42501';
  end if;

  return query
  select * from public.admin_audit_logs
  where (p_admin_id is null or admin_id = p_admin_id)
    and (p_target_type is null or target_type = p_target_type)
    and (p_action is null or action = p_action)
  order by created_at desc
  limit p_limit offset p_offset;
end;
$$;

grant execute on function public.list_admin_audit_logs(int, int, uuid, text, text) to authenticated;

-- ============================================================
-- SECTION 4 : VISITS COMPLETION — _cron_secrets, cancel_visit,
--             decline_visit, price_monthly check
-- ============================================================

-- 4.1 — _cron_secrets table
create table if not exists public._cron_secrets (
  name text primary key,
  secret text not null
);

-- RLS idempotent (service_role only)
do $$
begin
  if not exists (
    select 1 from pg_class c
    where c.relname = '_cron_secrets' and c.relrowsecurity = true
  ) then
    alter table public._cron_secrets enable row level security;
  end if;
end $$;

drop policy if exists cron_secrets_service_only on public._cron_secrets;
create policy cron_secrets_service_only on public._cron_secrets
  for all using (auth.role() = 'service_role');

-- 4.2 — cancel_visit RPC
create or replace function public.cancel_visit(
  p_visit_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
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

  insert into public.messages (conversation_id, sender_id, body, kind)
  values (v_visit.conversation_id, auth.uid(),
          '❌ Visite annulée par le ' || v_cancelled_by ||
          case when p_reason is not null and p_reason != '' then ' (' || p_reason || ')' else '' end,
          'visit_cancelled');

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

grant execute on function public.cancel_visit(uuid, text) to authenticated;

-- 4.2.bis — Extension de messages.kind avec 'visit_cancelled'
-- La plage historique (001) est ('text','image','document','visit_request',
-- 'visit_agreed','system'). cancel_visit() et decline_visit() insèrent
-- 'visit_cancelled' : on remplace la contrainte en gardant TOUTES les
-- valeurs valides historiques + la nouvelle. Aucune ligne n'est modifiée.
do $$
begin
  alter table public.messages drop constraint if exists messages_kind_check;
  alter table public.messages
    add constraint messages_kind_check
    check (kind in ('text', 'image', 'document', 'visit_request', 'visit_agreed', 'visit_cancelled', 'system'));
end $$;

-- Post-vérification : messages_kind_check présente et couvre visit_cancelled
do $$
begin
  if not exists (
    select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where c.conname = 'messages_kind_check'
       and t.relname = 'messages'
       and n.nspname = 'public'
       and pg_get_constraintdef(c.oid) like '%visit_cancelled%'
  ) then
    raise exception 'ECHEC 20260908232309 : messages_kind_check absente ou sans visit_cancelled';
  end if;
end $$;

-- 4.3 — decline_visit RPC
create or replace function public.decline_visit(
  p_visit_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
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

  insert into public.messages (conversation_id, sender_id, body, kind)
  values (v_visit.conversation_id, auth.uid(),
          '❌ Proposition de visite refusée' ||
          case when p_reason is not null and p_reason != '' then ' (' || p_reason || ')' else '' end,
          'visit_cancelled');

  insert into public.notifications (user_id, type, title, body, data)
  values (v_conv.tenant_id, 'visit', 'Proposition refusée',
          'Votre proposition de visite pour le ' || to_char(v_visit.slot_start, 'DD/MM/YYYY à HH24:MI') || ' a été refusée.',
          jsonb_build_object('visit_id', p_visit_id, 'conversation_id', v_visit.conversation_id));
end;
$$;

grant execute on function public.decline_visit(uuid, text) to authenticated;

-- 4.4 — price_monthly upper bound CHECK (échec explicite si données invalides)
do $$
declare
  v_bad int;
begin
  select count(*) into v_bad
    from public.residences
   where price_monthly < 0 or price_monthly > 500000;

  if v_bad > 0 then
    raise exception 'ECHEC 20260908232309 : % résidence(s) avec price_monthly hors bornes (0 à 500000 FCFA)', v_bad;
  end if;

  alter table public.residences drop constraint if exists residences_price_monthly_check;
  alter table public.residences
    add constraint residences_price_monthly_check
    check (price_monthly >= 0 and price_monthly <= 500000);
end $$;

-- Vérification post : contrainte présente et validée
do $$
begin
  if not exists (
    select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where c.conname = 'residences_price_monthly_check'
       and t.relname = 'residences'
       and n.nspname = 'public'
       and c.convalidated
  ) then
    raise exception 'ECHEC 20260908232309 : residences_price_monthly_check absente ou non validée';
  end if;
end $$;

-- ============================================================
-- SECTION 5 : LEASE / PAYMENT GUARDS
-- ============================================================

-- 5.1 — create_lease RPC (version 028 avec gardes-fous)
create or replace function public.create_lease(
  p_residence_id uuid,
  p_tenant_id uuid,
  p_start_date date,
  p_monthly_rent numeric,
  p_deposit numeric default 0,
  p_end_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
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
  if p_deposit > p_monthly_rent * 3 then
    raise exception 'Caution supérieure à 3 mois de loyer (Loi 2022-30)' using errcode = 'P0001';
  end if;
  if p_monthly_rent <= 0 then
    raise exception 'Le loyer mensuel doit être strictement positif' using errcode = 'P0001';
  end if;
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

-- 5.2 — validate_cash_payment_amount trigger
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
  if new.method <> 'cash' and not (new.method = 'mobile_money' and new.provider = 'cash') then
    return new;
  end if;

  select * into v_lease from public.leases where id = new.lease_id;
  if v_lease is null then
    raise exception 'Bail introuvable pour validation montant' using errcode = 'P0002';
  end if;

  v_min := v_lease.monthly_rent * 0.5;
  v_max := v_lease.monthly_rent * 6;

  if new.amount < v_min or new.amount > v_max then
    raise exception 'Montant hors bornes autorisées (0.5x à 6x le loyer mensuel = % à % FCFA)', v_min, v_max using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_cash_payment_amount on public.payments;
create trigger validate_cash_payment_amount
  before insert on public.payments
  for each row execute function public.validate_cash_payment_amount();

grant execute on function public.validate_cash_payment_amount() to authenticated;

-- ============================================================
-- SECTION 6 : STORAGE OWNERSHIP (029 — policy restrictive finale)
-- ============================================================

drop policy if exists "residence-photos-upload" on storage.objects;
drop policy if exists "residence-photos-upload-owner" on storage.objects;

create policy "residence-photos-upload-owner" on storage.objects
  for insert with check (
    bucket_id = 'residence-photos' and auth.role() = 'authenticated'
      and (
        (storage.foldername(name))[1] = auth.uid()::text
        or (
          (storage.foldername(name))[1] = 'residences'
          and (storage.foldername(name))[2] = auth.uid()::text
        )
      )
  );

-- ============================================================
-- SECTION 7 : STORAGE MIME (030)
-- ============================================================

create or replace function public._allowed_upload_mime(p_mime text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_mime in (
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  );
$$;

create or replace function public._guard_storage_upload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket text := NEW.bucket_id;
  v_mime   text;
  v_size   int;
begin
  if v_bucket is null or v_bucket not in ('residence-photos', 'chat-files') then
    return NEW;
  end if;

  v_mime := coalesce(NEW.metadata->>'mimetype', '');
  v_size := coalesce((NEW.metadata->>'size')::int, 0);

  if v_mime = '' then
    return NEW;
  end if;

  if not public._allowed_upload_mime(v_mime) then
    raise exception 'Type MIME non autorisé : %', v_mime
      using errcode = 'check_violation';
  end if;

  if v_size > 20 * 1024 * 1024 then
    raise exception 'Fichier trop volumineux : % octets', v_size
      using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$;

drop trigger if exists guard_storage_upload on storage.objects;
create trigger guard_storage_upload
  before insert on storage.objects
  for each row
  execute function public._guard_storage_upload();

-- ============================================================
-- SECTION 8 : PROFILE PHONE (018 + 031 fusionnés)
-- ============================================================

-- 8.1 — Contrainte profiles_phone_format (idempotente)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_phone_format'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_phone_format
      check (phone is null or phone ~ '^\+229\d{10}$')
      not valid;
  end if;
end $$;

-- 8.2 — Réparation des 4 téléphones non conformes (UNIQUEMENT ces UUID)
with snapshot as (
  select id, updated_at
    from public.profiles
   where id in (
     'b97bc6a2-8f70-49ed-a5cd-d2c9b754416c'::uuid,
     'f0c10b49-2448-4d2f-8955-88c676b0aa11'::uuid,
     'd50767d7-b6fd-4fe7-89d6-55f1722932c5'::uuid,
     'ddeaa38e-499d-4414-891b-dfc66c385bb3'::uuid
   )
)
update public.profiles p
   set phone = null,
       updated_at = s.updated_at
  from snapshot s
 where p.id = s.id;

-- 8.3 — Validation de la contrainte
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'profiles_phone_format'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles validate constraint profiles_phone_format;
  end if;
end $$;

-- 8.4 — Vérification post : aucun téléphone non-conforme ne subsiste
do $$
declare
  v_bad int;
begin
  select count(*) into v_bad
    from public.profiles
   where phone is not null
     and phone !~ '^\+229\d{10}$';

  if v_bad > 0 then
    raise exception 'ECHEC 20260908232309 : % téléphone(s) non conforme(s) encore présent(s)', v_bad;
  end if;
end $$;

-- ============================================================
-- SECTION 9 : ADMIN RPCs (032 durcis)
-- ============================================================

-- 9.1 — admin_verify_residence
create or replace function public.admin_verify_residence(p_residence_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Seul un administrateur peut vérifier une résidence' using errcode = '42501';
  end if;

  if not exists (select 1 from public.residences where id = p_residence_id) then
    raise exception 'Résidence introuvable' using errcode = 'P0002';
  end if;

  update public.residences
     set is_verified = true,
         updated_at = now()
   where id = p_residence_id;

  insert into public.notifications (user_id, type, title, body, data)
  select owner_id, 'system', 'Résidence vérifiée',
         'Votre annonce « ' || title || ' » a été vérifiée et est maintenant visible.',
         jsonb_build_object('residence_id', id)
    from public.residences
   where id = p_residence_id;
end;
$$;

revoke execute on function public.admin_verify_residence(uuid) from public, anon, authenticated;
grant execute on function public.admin_verify_residence(uuid) to authenticated;

-- 9.2 — admin_unpublish_residence
create or replace function public.admin_unpublish_residence(p_residence_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.residence_status;
  v_owner_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Seul un administrateur peut dépublier une résidence' using errcode = '42501';
  end if;

  select status, owner_id into v_status, v_owner_id
    from public.residences
   where id = p_residence_id;

  if v_owner_id is null then
    raise exception 'Résidence introuvable' using errcode = 'P0002';
  end if;

  if v_status = 'occupee' then
    raise exception 'Impossible de dépublier une résidence occupée' using errcode = 'P0001';
  end if;

  update public.residences
     set is_published = false,
         updated_at = now()
   where id = p_residence_id;

  insert into public.notifications (user_id, type, title, body, data)
  values (v_owner_id, 'system', 'Résidence dépubliée',
          'Votre annonce a été retirée de la publication par l''administration.',
          jsonb_build_object('residence_id', p_residence_id));
end;
$$;

revoke execute on function public.admin_unpublish_residence(uuid) from public, anon, authenticated;
grant execute on function public.admin_unpublish_residence(uuid) to authenticated;

-- 9.3 — admin_set_premium
create or replace function public.admin_set_premium(p_user_id uuid, p_is_premium boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Seul un administrateur peut modifier le statut Premium' using errcode = '42501';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas modifier votre propre statut Premium' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Utilisateur introuvable' using errcode = 'P0002';
  end if;

  update public.profiles
     set is_premium = p_is_premium,
         updated_at = now()
   where id = p_user_id;

  insert into public.notifications (user_id, type, title, body, data)
  select p_user_id, 'system',
         case when p_is_premium then 'Statut Premium activé' else 'Statut Premium retiré' end,
         case when p_is_premium
              then 'Vous avez maintenant accès au plan Premium : publications illimitées, visibilité prioritaire.'
              else 'Votre statut Premium a été retiré. Vous retrouvez les limites du plan gratuit.'
         end,
         jsonb_build_object('is_premium', p_is_premium);
end;
$$;

revoke execute on function public.admin_set_premium(uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_set_premium(uuid, boolean) to authenticated;

-- 9.4 — admin_toggle_role
create or replace function public.admin_toggle_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Seul un administrateur peut modifier les rôles' using errcode = '42501';
  end if;

  if p_role not in ('locataire', 'bailleur') then
    raise exception 'Rôle invalide : seuls locataire et bailleur sont autorisés' using errcode = '22023';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas modifier votre propre rôle' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Utilisateur introuvable' using errcode = 'P0002';
  end if;

  update public.profiles
     set role = p_role,
         consent_apdp = true,
         updated_at = now()
   where id = p_user_id;

  insert into public.notifications (user_id, type, title, body, data)
  select p_user_id, 'system',
         'Votre rôle a été modifié',
         'Votre rôle sur Kaza est maintenant : ' || p_role || '.',
         jsonb_build_object('role', p_role);
end;
$$;

revoke execute on function public.admin_toggle_role(uuid, public.user_role) from public, anon, authenticated;
grant execute on function public.admin_toggle_role(uuid, public.user_role) to authenticated;

-- ============================================================
-- SECTION 10 : TEST DE NON-RECAPTURE
-- Les fonctions test doivent rester ABSENTES.
-- ============================================================

do $$
begin
  if to_regprocedure('public.reset_test_database()') is not null then
    raise exception 'ECHEC 20260908232309 : reset_test_database() existe encore';
  end if;

  if to_regprocedure('public.get_function_source(text)') is not null then
    raise exception 'ECHEC 20260908232309 : get_function_source(text) existe encore';
  end if;

  if to_regprocedure('public.admin_list_users(integer)') is not null then
    raise exception 'ECHEC 20260908232309 : admin_list_users(integer) existe encore';
  end if;

  if to_regprocedure('public.admin_list_residences(integer)') is not null then
    raise exception 'ECHEC 20260908232309 : admin_list_residences(integer) existe encore';
  end if;

  if to_regprocedure('public.create_residence(text, public.residence_type, numeric, text, text, text, numeric, int, int)') is not null then
    raise exception 'ECHEC 20260908232309 : create_residence(test helper) existe encore';
  end if;
end $$;

-- ============================================================
-- SECTION 11 : GRANTS REST MINIMAUX (remplace 9998, par-privilège)
-- ------------------------------------------------------------
-- Remplace l'ancien grant global de 9998 par des grants ciblés,
-- issus de l'audit apps/web/src/lib/api (accès direct PostgREST).
-- Authenticated SEULEMENT (l'app ne fait aucun accès anon : client
-- unique avec session JWT répliquée). Pas de séquences (aucun
-- serial/nextval dans le schéma — PK uuid via gen_random_uuid()).
-- Aucun grant ne contourne la RLS : chaque table reste protégée par
-- ses policies (couche 1 = grants, couche 2 = RLS).
-- Le postgrest seul met à jour le rôle authenticated par défaut.
-- ============================================================

-- profiles : SELECT (auth.ts:154, middleware.ts:91, admin.ts:23),
--            UPDATE (auth.ts:177 — full_name/phone de son propre profil)
grant select on public.profiles to authenticated;
grant update on public.profiles to authenticated;

-- residences : SELECT (residences.ts:52, admin.ts:13 — liste admin),
--              INSERT (residences.ts:114 — création),
--              UPDATE (residences.ts:132 — édition du bien)
grant select on public.residences to authenticated;
grant insert on public.residences to authenticated;
grant update on public.residences to authenticated;

-- payments : UPDATE uniquement (payments.ts:66/78 — confirm/reject).
--            SELECT passait par RPC list_my_payments, INSERT par
--            report_cash_payment ou Edge Functions service_role.
grant update on public.payments to authenticated;

-- notifications : SELECT (notifications.ts:7/18), UPDATE (27/34 — read_at)
grant select on public.notifications to authenticated;
grant update on public.notifications to authenticated;

-- conversations : SELECT (chat.ts:29 — getConversation). INSERT via RPC
--                 open_conversation, UPDATE via RPC.
grant select on public.conversations to authenticated;

-- messages : SELECT (chat.ts:38), INSERT (chat.ts:52 — envoi),
--            UPDATE (chat.ts:66 — read_at; garde-fou messages_before_update)
grant select on public.messages to authenticated;
grant insert on public.messages to authenticated;
grant update on public.messages to authenticated;

-- visits : INSERT (chat.ts:107 — proposition), SELECT (chat.ts:124/136).
--          UPDATE (confirmation) passe par RPC confirm_visit.
grant select on public.visits to authenticated;
grant insert on public.visits to authenticated;

-- admin_audit_logs : AUCUN grant table. Lecture/écriture exclusivement
--                    via RPC list_admin_audit_logs / log_admin_action
--                    (SECTION 3). Pas de DELETE REST nulle part.
