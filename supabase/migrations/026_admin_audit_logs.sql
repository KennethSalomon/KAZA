-- Admin audit log : traçabilité des actions admin
-- ------------------------------------------------------------
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  target_type text not null, -- 'user', 'residence', 'lease', 'payment', etc.
  target_id uuid,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_logs_admin_idx on public.admin_audit_logs (admin_id, created_at desc);
create index admin_audit_logs_target_idx on public.admin_audit_logs (target_type, target_id);

alter table public.admin_audit_logs enable row level security;

-- Seuls les admins peuvent lire leurs propres logs
create policy admin_audit_logs_select_admin on public.admin_audit_logs
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Les admins peuvent insérer des logs (pour leurs propres actions)
create policy admin_audit_logs_insert_admin on public.admin_audit_logs
  for insert with check (
    auth.uid() = admin_id and
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Fonction helper pour logger une action admin
create or replace function public.log_admin_action(
  p_action text,
  p_target_type text,
  p_target_id uuid default null,
  p_old_value jsonb default null,
  p_new_value jsonb default null,
  p_metadata jsonb default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Vérifier que l'appelant est admin
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

-- Fonction pour lire les logs d'audit (admin seulement)
create or replace function public.list_admin_audit_logs(
  p_limit int default 100,
  p_offset int default 0,
  p_admin_id uuid default null,
  p_target_type text default null,
  p_action text default null
) returns setof public.admin_audit_logs
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