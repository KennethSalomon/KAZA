-- ============================================================
-- 019_test_helpers.sql — Helper functions for CI/CD testing
-- ONLY for test environments, NOT for production
-- ============================================================

-- Function to retrieve source code of a function for regression testing
create or replace function public.get_function_source(p_function_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text;
begin
  select prosrc into v_source
  from pg_proc
  where proname = p_function_name
    and pronamespace = 'public'::regnamespace
  limit 1;

  if v_source is null then
    raise exception 'Function % not found', p_function_name;
  end if;

  return v_source;
end;
$$;

grant execute on function public.get_function_source(text) to authenticated;

-- Function to reset test database to clean state
create or replace function public.reset_test_database()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Truncate all test-relevant tables in correct order (respecting FKs)
  truncate table
    public.messages,
    public.conversations,
    public.payments,
    public.receipts,
    public.leases,
    public.residences,
    public.notifications,
    public.profiles
  restart identity cascade;

  -- Recreate the initial admin user if needed
  -- This is handled by Supabase Auth separately
end;
$$;

grant execute on function public.reset_test_database() to authenticated;