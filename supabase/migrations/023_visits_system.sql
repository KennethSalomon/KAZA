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

-- RPC: confirm_visit (bailleur confirme un créneau)
create or replace function public.confirm_visit(
  p_visit_id uuid,
  p_slot_index int
)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_visit public.visits%rowtype;
  v_conv public.conversations%rowtype;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
begin
  -- Load visit
  select * into v_visit from public.visits where id = p_visit_id;
  if v_visit is null then
    raise exception 'Visite introuvable' using errcode = 'P0002';
  end if;
  if v_visit.status <> 'proposed' then
    raise exception 'Visite déjà traitée' using errcode = 'P0001';
  end if;

  -- Load conversation
  select * into v_conv from public.conversations where id = v_visit.conversation_id;
  if v_conv.landlord_id <> auth.uid() then
    raise exception 'Seul le bailleur confirme la visite' using errcode = '42501';
  end if;

  -- Pour l'instant un seul slot par visit (p_slot_index ignoré, slot_start/end déjà fixés)
  -- Si plus tard multi-slots par visit, stocker slots dans jsonb
  v_slot_start := v_visit.slot_start;
  v_slot_end := v_visit.slot_end;

  -- Confirm
  update public.visits
     set status = 'confirmed',
         confirmed_by = auth.uid(),
         confirmed_at = now(),
         slot_start = v_slot_start,
         slot_end = v_slot_end
   where id = p_visit_id;

  -- Message système dans chat
  insert into public.messages (conversation_id, sender_id, body, kind)
  values (v_visit.conversation_id, auth.uid(),
          '✅ Visite confirmée pour le ' || to_char(v_slot_start, 'DD/MM/YYYY à HH24:MI'), 'visit_agreed');

  -- Notification locataire
  insert into public.notifications (user_id, type, title, body, data)
  values (v_conv.tenant_id, 'visit', 'Visite confirmée',
          'Le bailleur vous reçoit le ' || to_char(v_slot_start, 'DD/MM/YYYY à HH24:MI'),
          jsonb_build_object('visit_id', p_visit_id, 'conversation_id', v_visit.conversation_id));

  -- Statut résidence
  update public.residences
     set status = 'en_visite'
   where id = v_conv.residence_id and status = 'libre';
end;
$$;