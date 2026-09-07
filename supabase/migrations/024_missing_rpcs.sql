-- Migration 024: RPCs manquantes appelées par le mobile
-- mark_conversation_read + mark_all_notifications_read

-- 1. Marquer tous les messages non lus d'une conversation comme lus
--    (seul un participant à la conversation peut appeler cette fonction)
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.conversations
    where id = p_conversation_id
      and (landlord_id = v_uid or tenant_id = v_uid)
  ) then
    raise exception 'Conversation introuvable' using errcode = '42501';
  end if;

  update public.messages
  set read_at = now()
  where conversation_id = p_conversation_id
    and sender_id <> v_uid
    and read_at is null;
end;
$$;

revoke execute on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- 2. Marquer toutes les notifications de l'utilisateur comme lues
create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;

  update public.notifications
  set read_at = now()
  where user_id = v_uid
    and read_at is null;
end;
$$;

revoke execute on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_all_notifications_read() to authenticated;
