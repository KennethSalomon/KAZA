-- 012_fix_recursive_admin_policies.sql
-- Cause racine "frontend cassé" : les policies d'admin référençaient la table
-- profiles depuis une policy sur profiles elle-même (exists select ... from profiles)
-- => infinite recursion detected in policy for relation "profiles" (42P17)
-- => 500 sur /rest/v1/profiles => le front ne charge jamais le profil connecté.
--
-- Correctif : fonction is_admin() SECURITY DEFINER (pattern officiel Supabase)
-- et réécriture des policies pour utiliser cette fonction au lieu de la
-- sous-requête auto-référente.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'::public.user_role
  )
$$;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (public.is_admin());

-- residences
drop policy if exists residences_select_admin on public.residences;
create policy residences_select_admin on public.residences
  for select using (public.is_admin());

drop policy if exists residences_update_admin on public.residences;
create policy residences_update_admin on public.residences
  for update using (public.is_admin());

-- leases
drop policy if exists leases_select on public.leases;
create policy leases_select on public.leases
  for select using (
    tenant_id = auth.uid()
    or landlord_id = auth.uid()
    or public.is_admin()
  );

-- payments
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select using (
    tenant_id = auth.uid()
    or landlord_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists payments_update_landlord on public.payments;
create policy payments_update_landlord on public.payments
  for update using (landlord_id = auth.uid() or public.is_admin())
  with check (
    (landlord_id = auth.uid() or public.is_admin())
    and (
      status in ('pending'::payment_status, 'rejected'::payment_status)
      or (status = 'confirmed'::payment_status and confirmed_at is not null)
    )
  );

-- receipts
drop policy if exists receipts_select on public.receipts;
create policy receipts_select on public.receipts
  for select using (
    tenant_id = auth.uid()
    or landlord_id = auth.uid()
    or public.is_admin()
  );

-- fix admin_stats : 'leases' renvoyait un scalaire au lieu d'un objet
-- {"total": n} => stats.leases.total = undefined dans le dashboard admin.
create or replace function public.admin_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
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
    'leases', jsonb_build_object(
      'total', (select count(*) from public.leases where status = 'active')),
    'payments', jsonb_build_object(
      'confirmed_count', (select count(*) from public.payments where status = 'confirmed'),
      'total_collected_xof', (select coalesce(sum(amount), 0) from public.payments where status = 'confirmed'))
  ) into v_json;

  return v_json;
end;
$$;