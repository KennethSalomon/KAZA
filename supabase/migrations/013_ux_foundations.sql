-- ============================================================
-- 013_ux_foundations.sql — Améliorations UX (lots P0/P1/P2)
-- 1. Favoris : table + RLS + RPC toggle/list (cœur sur cartes)
-- 2. Bailleur vérifié : profiles.is_verified_landlord (badge),
--    visible dans search_residences / get_residence
-- 3. Modération admin : RPC admin_moderate_residence avec motif,
--    notification automatique au bailleur (approuver / rejeter)
-- 4. Avis locataires : table reviews + RPC add_review/list_reviews
--    (uniquement locataires ayant un bail) + agrégat dans get_residence
-- ============================================================

-- ------------------------------------------------------------
-- 1. FAVORITES
-- ------------------------------------------------------------
create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  residence_id uuid not null references public.residences (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, residence_id)
);

create index favorites_user_idx on public.favorites (user_id, created_at desc);

alter table public.favorites enable row level security;

create policy favorites_select on public.favorites
  for select using (user_id = auth.uid());
create policy favorites_insert on public.favorites
  for insert with check (user_id = auth.uid());
create policy favorites_delete on public.favorites
  for delete using (user_id = auth.uid());

-- Bascule : ajoute/retire, renvoie le nouvel état (true = favori)
create or replace function public.toggle_favorite(p_residence_id uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
declare
  v_owner uuid;
  v_now boolean;
begin
  select owner_id into v_owner from public.residences where id = p_residence_id;
  if v_owner is null then
    raise exception 'Bien introuvable' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.favorites where user_id = auth.uid() and residence_id = p_residence_id) then
    delete from public.favorites where user_id = auth.uid() and residence_id = p_residence_id;
    v_now := false;
  else
    insert into public.favorites (user_id, residence_id) values (auth.uid(), p_residence_id);
    v_now := true;
  end if;
  return v_now;
end;
$$;

-- Liste des favoris (mêmes colonnes que search_residences + bailleur)
create or replace function public.list_my_favorites()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  v_json jsonb;
begin
  select jsonb_agg(row_to_json(t) order by f.created_at desc) into v_json
  from (
    select
      r.id, r.title, r.description, r.type,
      r.price_monthly, r.deposit, r.bedrooms, r.bathrooms,
      r.surface, r.city, r.zone, r.address,
      r.lat, r.lng, r.photos, r.status,
      r.is_published, r.is_verified, r.views_count, r.created_at,
      r.owner_id,
      null::double precision as distance_km,
      jsonb_build_object(
        'id', p.id, 'full_name', p.full_name,
        'phone', p.phone, 'avatar_url', p.avatar_url,
        'is_premium', p.is_premium, 'is_verified_landlord', p.is_verified_landlord
      ) as owner
    from public.favorites f
    join public.residences r on r.id = f.residence_id
    left join public.profiles p on p.id = r.owner_id
    where f.user_id = auth.uid()
      and r.is_published = true
      and r.is_verified = true
  ) t;
  return coalesce(v_json, '[]'::jsonb);
end;
$$;

revoke execute on function public.toggle_favorite(uuid) from public, anon;
revoke execute on function public.list_my_favorites() from public, anon;
grant execute on function public.toggle_favorite(uuid) to authenticated;
grant execute on function public.list_my_favorites() to authenticated;

-- Légère : ensemble des IDs favoris (badge rempli sur les cartes de l'explorer)
create or replace function public.list_my_favorite_ids()
returns setof uuid language plpgsql stable security definer set search_path = public
as $$
begin
  return query select f.residence_id from public.favorites f where f.user_id = auth.uid();
end;
$$;

revoke execute on function public.list_my_favorite_ids() from public, anon;
grant execute on function public.list_my_favorite_ids() to authenticated;

-- ------------------------------------------------------------
-- 2. BAILLEUR VÉRIFIÉ
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists is_verified_landlord boolean not null default false;

-- Uniquement l'admin (ou service_role) peut changer le badge
create or replace function public.profiles_guard_verification()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.role() = 'service_role' or auth.role() is null then
    return new;
  end if;
  new.is_verified_landlord := old.is_verified_landlord;
  return new;
end;
$$;

drop trigger if exists profiles_before_update_verification on public.profiles;
create trigger profiles_before_update_verification before update on public.profiles
  for each row execute procedure public.profiles_guard_verification();

-- RPC admin : accorder/retirer le badge
create or replace function public.admin_set_landlord_verified(p_user_id uuid, p_verified boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration' using errcode = '42501';
  end if;
  update public.profiles set is_verified_landlord = p_verified where id = p_user_id;
end;
$$;

revoke execute on function public.admin_set_landlord_verified(uuid, boolean) from public, anon;
grant execute on function public.admin_set_landlord_verified(uuid, boolean) to authenticated;

-- Expose le badge dans la recherche (cartes) et le détail
-- Le type de retour change (ajout owner_id/owner_full_name/owner_is_verified_landlord/
-- owner_is_premium) : PostgreSQL interdit le CREATE OR REPLACE sur changement de
-- type de retour (42P13) => DROP explicite avant recréation.
drop function if exists public.search_residences(
  double precision, double precision, double precision,
  public.residence_type, numeric, text, text, text, int, int
);
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
  distance_km double precision,
  owner_id uuid, owner_full_name text, owner_is_verified_landlord boolean, owner_is_premium boolean
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_point geometry := null;
begin
  if p_lat is not null and p_lng is not null then
    v_point := st_setsrid(st_makepoint(p_lng, p_lat), 4326);
  end if;

  return query
  select
    r.id, r.title, r.description, r.type,
    r.price_monthly, r.deposit, r.bedrooms, r.bathrooms,
    r.surface, r.city, r.zone, r.address,
    r.lat, r.lng, r.photos, r.status,
    case when v_point is not null and r.geom is not null
         then st_distance(r.geom::geography, v_point::geography) / 1000.0
         else null end,
    r.owner_id, p.full_name, p.is_verified_landlord, p.is_premium
  from public.residences r
  left join public.profiles p on p.id = r.owner_id
  where r.is_published = true
    and r.is_verified = true
    and r.status = 'libre'
    and (p_type is null or r.type = p_type)
    and (p_max_price is null or r.price_monthly <= p_max_price)
    and (p_city is null or r.city ilike p_city)
    and (p_zone is null or r.zone ilike p_zone)
    and (p_q is null or (r.title ilike '%' || p_q || '%' or r.description ilike '%' || p_q || '%'))
    and (v_point is null or r.geom is null
         or st_dwithin(r.geom::geography, v_point::geography, p_radius_km * 1000))
  order by
    case when v_point is not null and r.geom is not null
         then r.geom <-> v_point else null end asc nulls last,
    r.created_at desc
  limit p_limit offset p_offset;
end;
$$;

-- get_residence : bailleur vérifié dans le JSON propriétaire
create or replace function public.get_residence(p_residence_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  v_row public.residences%rowtype;
  v_owner jsonb;
  v_rating numeric;
  v_rating_count int;
  v_result jsonb;
begin
  select * into v_row from public.residences where id = p_residence_id;
  if v_row.id is null then raise exception 'Bien introuvable' using errcode = 'P0002'; end if;
  if not (v_row.is_published and v_row.is_verified or v_row.owner_id = auth.uid()) then
    raise exception 'Bien introuvable' using errcode = 'P0002';
  end if;
  select jsonb_build_object(
      'id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url,
      'is_premium', p.is_premium, 'is_verified_landlord', p.is_verified_landlord)
    into v_owner
    from public.profiles p where p.id = v_row.owner_id;

  select coalesce(round(avg(rating)::numeric, 1), 0), count(*)
    into v_rating, v_rating_count
    from public.reviews where residence_id = p_residence_id;

  v_result := jsonb_build_object(
    'id', v_row.id, 'owner_id', v_row.owner_id, 'title', v_row.title, 'description', v_row.description,
    'type', v_row.type, 'price_monthly', v_row.price_monthly, 'deposit', v_row.deposit,
    'bedrooms', v_row.bedrooms, 'bathrooms', v_row.bathrooms, 'surface', v_row.surface,
    'address', v_row.address, 'city', v_row.city, 'zone', v_row.zone,
    'lat', v_row.lat, 'lng', v_row.lng, 'photos', v_row.photos, 'status', v_row.status,
    'is_published', v_row.is_published, 'is_verified', v_row.is_verified,
    'views_count', v_row.views_count, 'created_at', v_row.created_at, 'updated_at', v_row.updated_at,
    'owner', v_owner, 'distance_km', null,
    'rating_avg', v_rating, 'rating_count', v_rating_count
  );
  return v_result;
end;
$$;

-- ------------------------------------------------------------
-- 3. MODÉRATION ADMIN AVEC MOTIF + NOTIFICATION
-- ------------------------------------------------------------
-- Le garde actuel (residences_guard_owner) bloque is_verified pour tout
-- rôle client — y compris au sein d'une fonction SECURITY DEFINER (auth.role()
-- reste 'authenticated'). On autorise donc la voie interne (current_user =
-- postgres, le propriétaire des fonctions créées par la CLI).
create or replace function public.residences_guard_owner()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.role() = 'service_role' or auth.role() is null or current_user = 'postgres' then
    return new;
  end if;
  new.is_verified := old.is_verified;
  new.owner_id := old.owner_id;
  return new;
end;
$$;

drop trigger if exists residences_before_update_owner on public.residences;
create trigger residences_before_update_owner before update on public.residences
  for each row execute procedure public.residences_guard_owner();

-- p_action : 'approve' | 'reject'. p_reason : motif (rejet) / note (approbation)
create or replace function public.admin_moderate_residence(
  p_residence_id uuid,
  p_action text,
  p_reason text default ''
)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_row public.residences%rowtype;
  v_body text;
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à l''administration' using errcode = '42501';
  end if;
  if p_action not in ('approve', 'reject') then
    raise exception 'Action invalide' using errcode = '22023';
  end if;

  select * into v_row from public.residences where id = p_residence_id;
  if v_row.id is null then
    raise exception 'Bien introuvable' using errcode = 'P0002';
  end if;

  if p_action = 'approve' then
    update public.residences set is_verified = true, is_published = true where id = p_residence_id;
    v_body := 'Votre bien « ' || v_row.title || ' » est vérifié et en ligne.';
  else
    update public.residences set is_verified = false, is_published = false where id = p_residence_id;
    v_body := 'Votre bien « ' || v_row.title || ' » n''a pas été approuvé.'
      || case when length(trim(p_reason)) > 0 then ' Motif : ' || p_reason else '' end
      || ' Modifiez-le puis republiez-le depuis votre espace.';
  end if;

  insert into public.notifications (user_id, type, title, body, data)
  values (v_row.owner_id, 'system',
          case when p_action = 'approve' then 'Bien vérifié' else 'Annonce refusée' end,
          v_body,
          jsonb_build_object('residence_id', p_residence_id));
end;
$$;

revoke execute on function public.admin_moderate_residence(uuid, text, text) from public, anon;
grant execute on function public.admin_moderate_residence(uuid, text, text) to authenticated;

-- ------------------------------------------------------------
-- 4. AVIS LOCATAIRES (uniquement après un bail)
-- ------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences (id) on delete cascade,
  tenant_id uuid not null references public.profiles (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (residence_id, tenant_id)
);

create index reviews_residence_idx on public.reviews (residence_id, created_at desc);

alter table public.reviews enable row level security;

-- Lecture publique des avis des biens en ligne ; le bailleur et l'admin voient tout
create policy reviews_select on public.reviews
  for select using (
    exists (select 1 from public.residences r
            where r.id = residence_id and r.is_published = true and r.is_verified = true)
    or exists (select 1 from public.residences r
               where r.id = residence_id and r.owner_id = auth.uid())
    or public.is_admin()
  );
-- Écriture uniquement via RPC add_review (contrôle du bail) ; l'auteur
-- peut modifier/supprimer son propre avis.
create policy reviews_update_own on public.reviews
  for update using (tenant_id = auth.uid())
  with check (tenant_id = auth.uid());
create policy reviews_delete_own on public.reviews
  for delete using (tenant_id = auth.uid());

-- RPC : publier (ou mettre à jour) un avis — réservé aux locataires
-- ayant un bail (actif ou terminé) sur ce bien. Note 1..5.
create or replace function public.add_review(
  p_residence_id uuid,
  p_rating int,
  p_comment text default null
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'La note doit être comprise entre 1 et 5' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.residences r where r.id = p_residence_id
  ) then
    raise exception 'Bien introuvable' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.leases l
    where l.residence_id = p_residence_id
      and l.tenant_id = auth.uid()
      and l.status in ('active', 'terminated')
  ) then
    raise exception 'Seuls les locataires de ce bien peuvent laisser un avis' using errcode = '42501';
  end if;

  insert into public.reviews (residence_id, tenant_id, rating, comment)
  values (p_residence_id, auth.uid(), p_rating, nullif(trim(coalesce(p_comment, '')), ''))
  on conflict (residence_id, tenant_id)
  do update set rating = excluded.rating, comment = excluded.comment, updated_at = now();
end;
$$;

-- RPC : liste des avis (nom masqué + date) + agrégat
create or replace function public.list_reviews(p_residence_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  v_json jsonb;
begin
  select jsonb_build_object(
    'average', coalesce(round(avg(rating)::numeric, 1), 0),
    'count', count(*),
    'reviews', coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb)
  ) into v_json
  from (
    select
      rv.id, rv.residence_id, rv.rating, rv.comment, rv.created_at,
      rv.tenant_id,
      (select p.full_name from public.profiles p where p.id = rv.tenant_id) as tenant_name
    from public.reviews rv
    where rv.residence_id = p_residence_id
  ) t;
  return v_json;
end;
$$;

revoke execute on function public.add_review(uuid, int, text) from public, anon;
grant execute on function public.add_review(uuid, int, text) to authenticated;
