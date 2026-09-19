-- ============================================================
-- 022_test_infrastructure.sql — Missing RPCs required by tests
-- Also re-applies guards overridden by 999_fix_rls_complete.sql
-- (lexicographic sort: 999_ > 9999 > 99999, so 999 runs LAST)
-- ============================================================

-- 1. create_residence RPC — called by all RLS/integration tests
create or replace function public.create_residence(
  title text,
  type public.residence_type default 'appartement'::public.residence_type,
  price_monthly numeric(12,2) default 0,
  city text default null,
  zone text default null,
  description text default null,
  deposit numeric(12,2) default 0,
  bedrooms int default 1,
  bathrooms int default 1
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.residences (
    owner_id, title, description, type, price_monthly, deposit,
    bedrooms, bathrooms, city, zone
  ) values (
    auth.uid(), title, description, type, price_monthly, deposit,
    bedrooms, bathrooms, city, zone
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.create_residence(text, public.residence_type, numeric, text, text, text, numeric, int, int) from public, anon;
grant execute on function public.create_residence(text, public.residence_type, numeric, text, text, text, numeric, int, int) to authenticated;

-- 2. admin_list_residences RPC — referenced in database.types.ts and tests
create or replace function public.admin_list_residences(p_limit int default 50)
returns setof public.residences
language sql
security definer
set search_path = public
as $$
  select r.*
  from public.residences r
  order by r.created_at desc
  limit p_limit;
$$;

revoke execute on function public.admin_list_residences(int) from public, anon;
grant execute on function public.admin_list_residences(int) to authenticated;

-- 3. admin_list_users RPC — referenced in database.types.ts and tests
create or replace function public.admin_list_users(p_limit int default 50)
returns setof public.profiles
language sql
security definer
set search_path = public
as $$
  select p.*
  from public.profiles p
  order by p.created_at desc
  limit p_limit;
$$;

revoke execute on function public.admin_list_users(int) from public, anon;
grant execute on function public.admin_list_users(int) to authenticated;

-- 4. Re-apply open_conversation guard (999_fix_rls_complete removed it)
create or replace function public.open_conversation(p_residence_id uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_owner uuid;
  v_id uuid;
begin
  select owner_id into v_owner
    from public.residences
   where id = p_residence_id and is_published = true and is_verified = true;

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

revoke execute on function public.open_conversation(uuid) from public, anon;
grant execute on function public.open_conversation(uuid) to authenticated;

-- 5. Re-apply is_admin() — 999 version is correct but ensure latest state
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
