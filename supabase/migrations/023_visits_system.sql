-- ============================================================
-- 023_visits_system.sql — Visits scheduling system
-- Creates visits table, visit_status enum, indexes, and RLS
-- ============================================================

create type public.visit_status as enum ('proposed', 'confirmed', 'completed', 'cancelled');

create table public.visits (
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

create index visits_conv_idx on public.visits (conversation_id);
create index visits_status_idx on public.visits (status) where status in ('proposed','confirmed');

alter table public.visits enable row level security;

create policy visits_select on public.visits
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.tenant_id = auth.uid() or c.landlord_id = auth.uid())
    )
  );

create policy visits_insert_tenant on public.visits
  for insert with check (
    proposed_by = auth.uid() and
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.tenant_id = auth.uid()
    )
  );

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