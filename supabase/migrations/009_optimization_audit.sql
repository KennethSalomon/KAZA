-- ============================================================
-- 009_optimization_audit.sql — Corrections audit complet (P0/P1)
-- 1. Garde is_verified : le propriétaire ne peut plus s'auto-vérifier
-- 2. Gel financier : montant/période/provider des paiements immuables
--    pour les rôles clients (seul le webhook/service_role écrit)
-- 3. Index payments(provider_ref) — webhook sans seq scan
-- 4. search_residences : st_dwithin + tri KNN (GiST utilisable)
-- 5. increment_residence_views réservé aux users authentifiés
-- 6. RLS sur app_settings (service_role uniquement)
-- 7. Revoke des RPC sensibles pour anon
-- ============================================================

-- ------------------------------------------------------------
-- 1. Garde is_verified : un bailleur ne peut PAS passer son bien
--    en "vérifié" lui-même (contournement de la modération admin).
--    Il conserve le droit de publier/dépublier et d'éditer le reste.
-- ------------------------------------------------------------
create or replace function public.residences_guard_owner()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.role() = 'service_role' or auth.role() is null then
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

-- ------------------------------------------------------------
-- 2. Gel financier des paiements : montant, période et provider
--    ne peuvent être modifiés que par le service_role (webhook,
--    init FedaPay) — jamais par un bailleur lors de la confirmation.
-- ------------------------------------------------------------
create or replace function public.payments_guard_financial()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.role() = 'service_role' or auth.role() is null then
    return new;
  end if;
  if new.amount is distinct from old.amount
     or new.period_start is distinct from old.period_start
     or new.period_end is distinct from old.period_end
     or new.provider_ref is distinct from old.provider_ref
     or new.provider is distinct from old.provider then
    raise exception 'Montant et période d''un paiement sont immuables' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists payments_before_update_financial on public.payments;
create trigger payments_before_update_financial before update on public.payments
  for each row execute procedure public.payments_guard_financial();

-- ------------------------------------------------------------
-- 3. Index provider_ref (partiel) : le webhook FedaPay retrouve
--    la transaction par cet identifiant à chaque événement.
-- ------------------------------------------------------------
create index if not exists payments_provider_ref_idx
  on public.payments (provider_ref) where provider_ref is not null;

-- ------------------------------------------------------------
-- 4. search_residences : prédicat st_dwithin (assisté par GiST)
--    + ordre par distance KNN (opérateur <->) quand un point est
--    fourni. Évite le scan + tri complet de la table publiée.
-- ------------------------------------------------------------
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
    and (v_point is null or r.geom is null
         or st_dwithin(r.geom::geography, v_point::geography, p_radius_km * 1000))
  order by
    case when v_point is not null and r.geom is not null
         then r.geom <-> v_point else null end asc nulls last,
    r.created_at desc
  limit p_limit offset p_offset;
end;
$$;

-- Index partiel pour les filtres courants (géométrie + prix) :
-- les biens publiés, vérifiés et libres uniquement.
drop index if exists residences_search_idx;
create index residences_search_idx
  on public.residences using gist (geom)
  where is_published = true and is_verified = true and status = 'libre';

-- ------------------------------------------------------------
-- 5. increment_residence_views : réservé aux users connectés
--    (évite le gonflage des compteurs par anon).
-- ------------------------------------------------------------
revoke execute on function public.increment_residence_views(uuid) from anon;
revoke execute on function public.increment_residence_views(uuid) from public;
grant execute on function public.increment_residence_views(uuid) to authenticated;

-- ------------------------------------------------------------
-- 6. app_settings : RLS activée, service_role uniquement.
-- ------------------------------------------------------------
alter table public.app_settings enable row level security;
drop policy if exists app_settings_no_access on public.app_settings;
create policy app_settings_no_access on public.app_settings
  as restrictive for all using (false) with check (false);

-- ------------------------------------------------------------
-- 7. delete_my_account réservé aux users connectés.
-- ------------------------------------------------------------
revoke execute on function public.delete_my_account() from anon;
revoke execute on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;