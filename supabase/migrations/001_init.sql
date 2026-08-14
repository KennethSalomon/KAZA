-- ============================================================
-- KAZA.BJ — Migration 001 : schéma complet (architecture Supabase seule)
-- PostgreSQL 15 + PostGIS. La logique métier vit dans les triggers
-- et fonctions RPC (SECURITY DEFINER) ; l'API est lisible directement
-- depuis le frontend via RLS.
-- ============================================================

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
create type public.user_role as enum ('visiteur', 'locataire', 'bailleur', 'admin');
create type public.residence_status as enum ('libre', 'occupee', 'en_visite', 'maintenance');
create type public.residence_type as enum ('studio', 'chambre', 'appartement', 'villa', 'magasin', 'terrain');
create type public.lease_status as enum ('active', 'terminated', 'pending');
create type public.payment_method as enum ('mobile_money', 'cash');
create type public.payment_provider as enum ('mtn', 'moov', 'celtiis', 'cash');
create type public.payment_status as enum ('pending', 'confirmed', 'rejected');
create type public.notification_type as enum ('message', 'payment', 'receipt', 'lease', 'overdue', 'system', 'visit');

-- ------------------------------------------------------------
-- Paramètres applicatifs (secrets partagés, flags, URLs)
-- ------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  phone text,
  full_name text not null default '',
  role public.user_role not null default 'visiteur',
  avatar_url text,
  country text default 'BJ',
  is_premium boolean not null default false,
  consent_apdp boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);

-- ------------------------------------------------------------
-- residences
-- ------------------------------------------------------------
create table public.residences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  type public.residence_type not null default 'appartement',
  price_monthly numeric(12,2) not null check (price_monthly >= 0),
  deposit numeric(12,2) default 0,
  bedrooms int default 1 check (bedrooms >= 0),
  bathrooms int default 1 check (bathrooms >= 0),
  surface numeric(10,2) check (surface > 0),
  address text,
  city text,
  zone text,
  lat double precision,
  lng double precision,
  geom geography(Point, 4326),
  photos text[] not null default '{}',
  status public.residence_status not null default 'libre',
  is_published boolean not null default false,
  is_verified boolean not null default false,
  views_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index residences_owner_idx on public.residences (owner_id);
create index residences_status_idx on public.residences (status) where is_published = true and is_verified = true;
create index residences_geom_idx on public.residences using gist (geom);
create index residences_city_idx on public.residences (city, zone);

-- ------------------------------------------------------------
-- conversations + messages
-- ------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences (id) on delete cascade,
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  tenant_id uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz not null default now(),
  unique (residence_id, tenant_id)
);

create index conversations_tenant_idx on public.conversations (tenant_id);
create index conversations_landlord_idx on public.conversations (landlord_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text,
  attachments text[] not null default '{}',
  kind text not null default 'text' check (kind in ('text', 'image', 'document', 'visit_request', 'visit_agreed', 'system')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

-- ------------------------------------------------------------
-- leases (baux)
-- ------------------------------------------------------------
create table public.leases (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences (id) on delete cascade,
  tenant_id uuid not null references public.profiles (id) on delete cascade,
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  monthly_rent numeric(12,2) not null check (monthly_rent > 0),
  deposit numeric(12,2) not null default 0,
  start_date date not null,
  end_date date,
  status public.lease_status not null default 'active',
  date_fn_couverture date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leases_tenant_idx on public.leases (tenant_id, status);
create index leases_landlord_idx on public.leases (landlord_id, status);
create index leases_residence_idx on public.leases (residence_id);

-- ------------------------------------------------------------
-- payments
-- ------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases (id) on delete cascade,
  tenant_id uuid not null references public.profiles (id) on delete cascade,
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  period_start date not null,
  period_end date not null,
  method public.payment_method not null,
  provider public.payment_provider not null default 'cash',
  provider_ref text,
  checkout_url text,
  status public.payment_status not null default 'pending',
  confirmed_by uuid references public.profiles (id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index payments_lease_idx on public.payments (lease_id);
create index payments_status_idx on public.payments (status) where status = 'pending';
create index payments_tenant_idx on public.payments (tenant_id, created_at desc);

-- ------------------------------------------------------------
-- receipts (quittances)
-- ------------------------------------------------------------
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade unique,
  lease_id uuid not null references public.leases (id) on delete cascade,
  tenant_id uuid not null references public.profiles (id) on delete cascade,
  landlord_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(12,2) not null,
  period_start date not null,
  period_end date not null,
  file_url text,
  signature_hash text,
  signed_by uuid references public.profiles (id) on delete set null,
  signed_at timestamptz,
  status text not null default 'pending_signature' check (status in ('pending_signature', 'signed')),
  created_at timestamptz not null default now()
);

create index receipts_tenant_idx on public.receipts (tenant_id, created_at desc);

-- ------------------------------------------------------------
-- notifications
-- ------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null default 'system',
  title text not null,
  body text,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc) where read_at is null;

-- ============================================================
-- Triggers utilitaires
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, phone, full_name, role)
  values (new.id, new.email, new.phone,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1)),
          'visiteur')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute procedure public.touch_updated_at();
create trigger residences_touch before update on public.residences
  for each row execute procedure public.touch_updated_at();
create trigger leases_touch before update on public.leases
  for each row execute procedure public.touch_updated_at();

-- ============================================================
-- Trigger : message inséré -> fil de conversation + notification
-- ============================================================
create or replace function public.on_message_inserted()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  recipient uuid;
begin
  update public.conversations
     set last_message_at = new.created_at,
         last_message_preview = case when new.kind in ('image', 'document') then new.kind else left(coalesce(new.body, ''), 80) end
   where id = new.conversation_id;

  select case when c.tenant_id = new.sender_id then c.landlord_id else c.tenant_id end
    into recipient
    from public.conversations c where c.id = new.conversation_id;

  if recipient is not null and recipient <> new.sender_id then
    insert into public.notifications (user_id, type, title, body, data)
    values (recipient, 'message', 'Nouveau message', coalesce(new.body, 'Pièce jointe'),
            jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id));
  end if;
  return new;
end;
$$;

create trigger messages_after_insert after insert on public.messages
  for each row execute procedure public.on_message_inserted();

-- ============================================================
-- Trigger : paiement signalé / confirmé / rejeté
-- (couvre : notification, extension de couverture, quittance auto)
-- ============================================================
create or replace function public.on_payment_changed()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
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

  -- Rejet : notif locataire
  if new.status = 'rejected' and old.status = 'pending' then
    insert into public.notifications (user_id, type, title, body, data)
    values (new.tenant_id, 'payment', 'Paiement rejeté',
            concat('Le bailleur n''a pas confirmé votre paiement de ', new.amount, ' FCFA.'),
            jsonb_build_object('payment_id', new.id));
  end if;

  return new;
end;
$$;

create trigger payments_before_update before update on public.payments
  for each row execute procedure public.on_payment_changed();

-- Signalement en espèces (INSERT) : alerte le bailleur
create or replace function public.on_payment_inserted()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.method = 'cash' and new.status = 'pending' then
    insert into public.notifications (user_id, type, title, body, data)
    values (new.landlord_id, 'payment', 'Paiement en espèces signalé',
            concat(new.amount, ' FCFA — validez la réception'),
            jsonb_build_object('payment_id', new.id));
  end if;
  return new;
end;
$$;

create trigger payments_after_insert after insert on public.payments
  for each row execute procedure public.on_payment_inserted();

-- ============================================================
-- Trigger : quittance créée -> notif bailleur ("à signer")
-- ============================================================
create or replace function public.on_receipt_created()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, body, data)
  values (new.landlord_id, 'receipt', 'Quittance à signer',
          concat('Quittance de ', new.amount, ' FCFA générée — signez-la pour l''envoyer au locataire.'),
          jsonb_build_object('receipt_id', new.id));
  return new;
end;
$$;

create trigger receipts_after_insert after insert on public.receipts
  for each row execute procedure public.on_receipt_created();

-- ============================================================
-- Trigger : conversation créée -> notif bailleur
-- ============================================================
create or replace function public.on_conversation_created()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.tenant_id <> new.landlord_id then
    insert into public.notifications (user_id, type, title, body, data)
    values (new.landlord_id, 'message', 'Nouvelle conversation',
            'Un locataire vous a contacté au sujet de votre bien.',
            jsonb_build_object('conversation_id', new.id));
  end if;
  return new;
end;
$$;

create trigger conversations_after_insert after insert on public.conversations
  for each row execute procedure public.on_conversation_created();

-- ============================================================
-- Trigger : limite freemium (1 bien publié pour le plan gratuit)
-- ============================================================
create or replace function public.enforce_freemium_limit()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  p_is_premium boolean;
  p_role public.user_role;
  n int;
begin
  select is_premium, role into p_is_premium, p_role from public.profiles where id = new.owner_id;
  if coalesce(p_role, 'visiteur') = 'visiteur' then
    raise exception 'Créez un compte bailleur pour publier un bien' using errcode = '42501';
  end if;
  if coalesce(p_is_premium, false) or p_role = 'admin' then
    return new;
  end if;
  -- La limite ne s'applique qu'aux biens publiés : un brouillon (is_published
  -- = false) reste autorisé, même si un bien est déjà publié.
  if not new.is_published then
    return new;
  end if;
  select count(*) into n from public.residences
   where owner_id = new.owner_id and is_published = true;
  if n >= 1 then
    raise exception 'Limite du plan gratuit atteinte (1 bien). Passez au Premium.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger residences_before_insert before insert on public.residences
  for each row execute procedure public.enforce_freemium_limit();

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.residences enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.leases enable row level security;
alter table public.payments enable row level security;
alter table public.receipts enable row level security;
alter table public.notifications enable row level security;

-- profiles
create policy profiles_select on public.profiles
  for select using (auth.uid() = id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_update_admin on public.profiles
  for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);

-- residences
create policy residences_select on public.residences
  for select using (is_published = true and is_verified = true or owner_id = auth.uid());
create policy residences_select_admin on public.residences
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy residences_insert_owner on public.residences
  for insert with check (owner_id = auth.uid());
create policy residences_update_owner on public.residences
  for update using (owner_id = auth.uid());
create policy residences_update_admin on public.residences
  for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy residences_delete_owner on public.residences
  for delete using (owner_id = auth.uid());

-- conversations : lecture par participants uniquement (insertion via RPC open_conversation)
create policy conversations_select on public.conversations
  for select using (tenant_id = auth.uid() or landlord_id = auth.uid());

-- messages : participants, envoi réservé à l'expéditeur
create policy messages_select on public.messages
  for select using (
    exists (select 1 from public.conversations c
             where c.id = conversation_id and (c.tenant_id = auth.uid() or c.landlord_id = auth.uid())));
create policy messages_insert on public.messages
  for insert with check (
    sender_id = auth.uid() and
    exists (select 1 from public.conversations c
             where c.id = conversation_id and (c.tenant_id = auth.uid() or c.landlord_id = auth.uid())));
create policy messages_update_read on public.messages
  for update using (
    exists (select 1 from public.conversations c
             where c.id = conversation_id and (c.tenant_id = auth.uid() or c.landlord_id = auth.uid()))
    and sender_id <> auth.uid())
  with check (sender_id <> auth.uid());

-- Garde-fou : un participant ne peut modifier QUE read_at (jamais le contenu)
create or replace function public.messages_guard_read_only()
returns trigger language plpgsql
as $$
begin
  new.conversation_id := old.conversation_id;
  new.sender_id := old.sender_id;
  new.body := old.body;
  new.attachments := old.attachments;
  new.kind := old.kind;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger messages_before_update before update on public.messages
  for each row execute procedure public.messages_guard_read_only();

-- leases : lecture participants, écriture via RPC create_lease/terminate_lease
create policy leases_select on public.leases
  for select using (tenant_id = auth.uid() or landlord_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- payments
create policy payments_select on public.payments
  for select using (tenant_id = auth.uid() or landlord_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy payments_insert_tenant on public.payments
  for insert with check (tenant_id = auth.uid() and status = 'pending' and provider_ref is null);
create policy payments_update_landlord on public.payments
  for update using (landlord_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (confirmed_at is not null or status <> 'pending');

-- receipts : lecture participants, écriture via Edge Function (service role)
create policy receipts_select on public.receipts
  for select using (tenant_id = auth.uid() or landlord_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- notifications : lecture + lecture seule pour le destinataire
create policy notifications_select on public.notifications
  for select using (user_id = auth.uid());
create policy notifications_update on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- RPC : recherche géolocalisée (PostGIS, rayon en km)
-- ============================================================
create or replace function public.search_residences(
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km double precision default 10,
  p_type public.residence_type default null,
  p_max_price numeric default null,
  p_q text default null,
  p_city text default null,
  p_zone text default null,
  p_limit int default 40,
  p_offset int default 0
)
returns table (
  id uuid, title text, description text, type public.residence_type,
  price_monthly numeric, deposit numeric, bedrooms int, bathrooms int,
  surface numeric, city text, zone text, address text,
  lat double precision, lng double precision, photos text[], status public.residence_status,
  distance_km double precision
)
language plpgsql stable security definer set search_path = public
as $$
begin
  return query
  select
    r.id, r.title, r.description, r.type,
    r.price_monthly, r.deposit, r.bedrooms, r.bathrooms,
    r.surface, r.city, r.zone, r.address,
    r.lat, r.lng, r.photos, r.status,
    case when p_lat is not null and p_lng is not null
         then st_distance(r.geom, st_makepoint(p_lng, p_lat)::geography) / 1000.0
         else null end
  from public.residences r
  where r.is_published = true
    and r.is_verified = true
    and r.status = 'libre'
    and (p_type is null or r.type = p_type)
    and (p_max_price is null or r.price_monthly <= p_max_price)
    and (p_city is null or r.city ilike p_city)
    and (p_zone is null or r.zone ilike p_zone)
    and (p_q is null or (r.title ilike '%' || p_q || '%' or r.description ilike '%' || p_q || '%'))
    and (p_lat is null or p_lng is null
         or r.geom is null
         or st_distance(r.geom, st_makepoint(p_lng, p_lat)::geography) / 1000.0 <= p_radius_km)
  order by
    case when p_lat is not null and p_lng is not null
         then st_distance(r.geom, st_makepoint(p_lng, p_lat)::geography) else 0 end asc,
    r.created_at desc
  limit p_limit offset p_offset;
end;
$$;

-- ============================================================
-- RPC : compteur de vues
-- ============================================================
create or replace function public.increment_residence_views(p_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.residences set views_count = views_count + 1 where id = p_id;
end;
$$;

-- ============================================================
-- RPC : ouvrir (ou récupérer) la conversation d'un bien
-- ============================================================
create or replace function public.open_conversation(p_residence_id uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_owner uuid;
  v_id uuid;
begin
  select owner_id into v_owner from public.residences where id = p_residence_id;
  if v_owner is null then
    raise exception 'Bien introuvable' using errcode = 'P0002';
  end if;
  if v_owner = auth.uid() then
    raise exception 'Vous ne pouvez pas vous écrire à vous-même' using errcode = 'P0001';
  end if;

  select id into v_id from public.conversations
   where residence_id = p_residence_id and tenant_id = auth.uid();
  if v_id is null then
    insert into public.conversations (residence_id, landlord_id, tenant_id)
    values (p_residence_id, v_owner, auth.uid())
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- ============================================================
-- RPC : le bailleur valide la visite (message système + statut)
-- ============================================================
create or replace function public.agree_visit(p_conversation_id uuid, p_agreed boolean, p_note text default '')
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_conv public.conversations%rowtype;
  v_body text;
begin
  select * into v_conv from public.conversations where id = p_conversation_id;
  if v_conv is null then
    raise exception 'Conversation introuvable' using errcode = 'P0002';
  end if;
  if v_conv.landlord_id <> auth.uid() then
    raise exception 'Seul le bailleur valide les visites' using errcode = '42501';
  end if;

  v_body := case when p_agreed then concat('✅ Visite confirmée. ', p_note) else concat('❌ Visite refusée. ', p_note) end;

  insert into public.messages (conversation_id, sender_id, body, kind)
  values (p_conversation_id, auth.uid(), trim(v_body), case when p_agreed then 'visit_agreed' else 'system' end);

  if p_agreed then
    update public.residences set status = 'en_visite'
     where id = v_conv.residence_id and status = 'libre';
    insert into public.notifications (user_id, type, title, body, data)
    values (v_conv.tenant_id, 'visit', 'Visite confirmée',
            concat('Le bailleur vous reçoit', case when length(p_note) > 0 then concat(' : ', p_note) else '' end),
            jsonb_build_object('conversation_id', p_conversation_id));
  end if;
end;
$$;

-- ============================================================
-- RPC : création de bail (atomique : bail + statut "occupee")
-- ============================================================
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

-- ============================================================
-- RPC : déclaration de départ (bail terminé + bien libre)
-- ============================================================
create or replace function public.terminate_lease(p_lease_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_lease public.leases%rowtype;
begin
  select * into v_lease from public.leases where id = p_lease_id;
  if v_lease is null then raise exception 'Bail introuvable' using errcode = 'P0002'; end if;
  if v_lease.landlord_id <> auth.uid() then
    raise exception 'Seul le bailleur clôture le bail' using errcode = '42501';
  end if;

  update public.leases set status = 'terminated', end_date = current_date where id = p_lease_id;
  update public.residences set status = 'libre' where id = v_lease.residence_id;

  insert into public.notifications (user_id, type, title, body, data)
  values (v_lease.tenant_id, 'lease', 'Bail terminé',
          'Votre bail est clôturé. Le bien redevient disponible.',
          jsonb_build_object('lease_id', p_lease_id));
end;
$$;

-- ============================================================
-- RPC : suppression de compte (RGPD art. 17)
-- ============================================================
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

-- ============================================================
-- RPC : détection impayés (CRON)
-- ============================================================
create or replace function public.list_overdue_leases()
returns table (
  lease_id uuid, tenant_id uuid, landlord_id uuid, residence_id uuid,
  tenant_email text, landlord_email text, tenant_name text, landlord_name text,
  monthly_rent numeric, days_overdue int
)
language plpgsql stable security definer set search_path = public
as $$
begin
  return query
  select
    l.id, l.tenant_id, l.landlord_id, l.residence_id,
    tp.email, lp.email, tp.full_name, lp.full_name,
    l.monthly_rent,
    (current_date - l.date_fn_couverture) as days_overdue
  from public.leases l
  join public.profiles tp on tp.id = l.tenant_id
  join public.profiles lp on lp.id = l.landlord_id
  where l.status = 'active'
    and l.date_fn_couverture < current_date
    and not exists (
      select 1 from public.payments p
      where p.lease_id = l.id
        and p.status = 'pending'
        and p.period_end >= l.date_fn_couverture
    )
  order by l.date_fn_couverture asc;
end;
$$;

create or replace function public.list_upcoming_due(days int default 3)
returns table (lease_id uuid, tenant_id uuid, landlord_id uuid, monthly_rent numeric, due_on date)
language plpgsql stable security definer set search_path = public
as $$
begin
  return query
  select l.id, l.tenant_id, l.landlord_id, l.monthly_rent, l.date_fn_couverture
  from public.leases l
  where l.status = 'active'
    and l.date_fn_couverture = current_date + days;
end;
$$;

-- ============================================================
-- RPC : statistiques admin (KPI plateforme)
-- ============================================================
create or replace function public.admin_stats()
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_role public.user_role;
  v_json jsonb;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role <> 'admin' then
    raise exception 'Accès réservé à l''administration' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'users', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'by_role', (select jsonb_object_agg(role, n) from (
                    select role, count(*)::int n from public.profiles group by role) t)),
    'residences', jsonb_build_object(
      'total', (select count(*) from public.residences),
      'by_status', (select jsonb_object_agg(status, n) from (
                      select status, count(*)::int n from public.residences group by status) t)),
    'leases', (select count(*) from public.leases where status = 'active'),
    'payments', jsonb_build_object(
      'confirmed_count', (select count(*) from public.payments where status = 'confirmed'),
      'total_collected_xof', (select coalesce(sum(amount), 0) from public.payments where status = 'confirmed'))
  ) into v_json;

  return v_json;
end;
$$;

-- ============================================================
-- RPC : mes conversations (avec interlocuteur, bien, non-lus)
-- ============================================================
create or replace function public.list_my_conversations()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  v_json jsonb;
begin
  select jsonb_agg(row_to_json(t) order by t.last_message_at desc nulls last)
  into v_json
  from (
    select
      c.id, c.residence_id, c.landlord_id, c.tenant_id,
      c.last_message_at, c.last_message_preview,
      case when c.tenant_id = auth.uid() then c.landlord_id else c.tenant_id end as peer_id,
      (select jsonb_build_object('id', r.id, 'title', r.title, 'photos', r.photos,
                                 'price_monthly', r.price_monthly, 'city', r.city, 'zone', r.zone)
         from public.residences r where r.id = c.residence_id) as residence,
      (select jsonb_build_object('id', p.id, 'full_name', p.full_name, 'role', p.role, 'avatar_url', p.avatar_url)
         from public.profiles p where p.id = (case when c.tenant_id = auth.uid() then c.landlord_id else c.tenant_id end)) as peer,
      (select count(*)::int from public.messages m
        where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.read_at is null) as unread_count
    from public.conversations c
    where c.tenant_id = auth.uid() or c.landlord_id = auth.uid()
  ) t;

  return coalesce(v_json, '[]'::jsonb);
end;
$$;

-- ============================================================
-- RPC : détail d'un bien avec propriétaire (exposition RGPD-safe)
-- ============================================================
create or replace function public.get_residence(p_residence_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  v_row public.residences%rowtype;
  v_owner jsonb;
  v_result jsonb;
begin
  select * into v_row from public.residences where id = p_residence_id;
  if v_row.id is null then raise exception 'Bien introuvable' using errcode = 'P0002'; end if;
  if not (v_row.is_published and v_row.is_verified or v_row.owner_id = auth.uid()) then
    raise exception 'Bien introuvable' using errcode = 'P0002';
  end if;
  select jsonb_build_object('id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url, 'is_premium', p.is_premium)
    into v_owner
    from public.profiles p where p.id = v_row.owner_id;
  v_result := jsonb_build_object(
    'id', v_row.id, 'owner_id', v_row.owner_id, 'title', v_row.title, 'description', v_row.description,
    'type', v_row.type, 'price_monthly', v_row.price_monthly, 'deposit', v_row.deposit,
    'bedrooms', v_row.bedrooms, 'bathrooms', v_row.bathrooms, 'surface', v_row.surface,
    'address', v_row.address, 'city', v_row.city, 'zone', v_row.zone,
    'lat', v_row.lat, 'lng', v_row.lng, 'photos', v_row.photos, 'status', v_row.status,
    'is_published', v_row.is_published, 'is_verified', v_row.is_verified,
    'views_count', v_row.views_count, 'created_at', v_row.created_at, 'updated_at', v_row.updated_at,
    'owner', v_owner, 'distance_km', null
  );
  return v_result;
end;
$$;

-- ============================================================
-- RPC : mes baux (avec bien + profils embarqués)
-- ============================================================
create or replace function public.list_my_leases()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  v_json jsonb;
begin
  select jsonb_agg(row_to_json(t) order by t.created_at desc) into v_json
  from (
    select
      l.id, l.residence_id, l.tenant_id, l.landlord_id,
      l.monthly_rent, l.deposit, l.start_date, l.end_date,
      l.status, l.date_fn_couverture, l.created_at,
      (select jsonb_build_object('id', r.id, 'title', r.title, 'photos', r.photos,
                                 'price_monthly', r.price_monthly, 'city', r.city, 'zone', r.zone)
         from public.residences r where r.id = l.residence_id) as residence,
      (select jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email, 'phone', p.phone)
         from public.profiles p where p.id = l.tenant_id) as tenant,
      (select jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email, 'phone', p.phone)
         from public.profiles p where p.id = l.landlord_id) as landlord
    from public.leases l
    where l.tenant_id = auth.uid() or l.landlord_id = auth.uid()
  ) t;
  return coalesce(v_json, '[]'::jsonb);
end;
$$;

-- ============================================================
-- RPC : mes paiements (avec résumé du bail)
-- ============================================================
create or replace function public.list_my_payments()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  v_json jsonb;
begin
  select jsonb_agg(row_to_json(t) order by t.created_at desc) into v_json
  from (
    select
      p.id, p.lease_id, p.tenant_id, p.landlord_id, p.amount,
      p.period_start, p.period_end, p.method, p.provider, p.provider_ref,
      p.status, p.confirmed_at, p.created_at,
      (select jsonb_build_object('id', l.id, 'residence_id', l.residence_id, 'monthly_rent', l.monthly_rent, 'status', l.status)
         from public.leases l where l.id = p.lease_id) as lease
    from public.payments p
    where p.tenant_id = auth.uid() or p.landlord_id = auth.uid()
  ) t;
  return coalesce(v_json, '[]'::jsonb);
end;
$$;

-- ============================================================
-- RPC : mes quittances (avec bailleur)
-- ============================================================
create or replace function public.list_my_receipts()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  v_json jsonb;
begin
  select jsonb_agg(row_to_json(t) order by t.created_at desc) into v_json
  from (
    select
      r.id, r.payment_id, r.lease_id, r.tenant_id, r.landlord_id,
      r.amount, r.period_start, r.period_end,
      r.file_url, r.signature_hash, r.signed_at, r.status, r.created_at,
      (select jsonb_build_object('id', p.id, 'full_name', p.full_name)
         from public.profiles p where p.id = r.landlord_id) as landlord
    from public.receipts r
    where r.tenant_id = auth.uid() or r.landlord_id = auth.uid()
  ) t;
  return coalesce(v_json, '[]'::jsonb);
end;
$$;

-- ============================================================
-- RPC : annuaire des locataires (création de bail côté bailleur)
-- ============================================================
create or replace function public.list_tenants()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  v_role public.user_role;
  v_json jsonb;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role not in ('bailleur', 'admin') then
    raise exception 'Réservé aux bailleurs' using errcode = '42501';
  end if;
  select jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email, 'phone', p.phone) order by p.full_name)
    into v_json
    from public.profiles p where p.role = 'locataire';
  return coalesce(v_json, '[]'::jsonb);
end;
$$;

-- ============================================================
-- Storage buckets
-- ============================================================
insert into storage.buckets (id, name, public) values
  ('residence-photos', 'residence-photos', true),
  ('chat-files', 'chat-files', true),
  ('receipts', 'receipts', true)
on conflict (id) do nothing;

create policy "residence-photos-read" on storage.objects
  for select using (bucket_id = 'residence-photos');
create policy "residence-photos-upload" on storage.objects
  for insert with check (bucket_id = 'residence-photos' and auth.role() = 'authenticated');
create policy "chat-files-read" on storage.objects
  for select using (bucket_id = 'chat-files');
create policy "chat-files-upload" on storage.objects
  for insert with check (bucket_id = 'chat-files' and auth.role() = 'authenticated');
create policy "receipts-read" on storage.objects
  for select using (bucket_id = 'receipts');