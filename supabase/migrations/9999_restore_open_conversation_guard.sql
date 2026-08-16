-- ------------------------------------------------------------
-- 9999_restore_open_conversation_guard.sql
-- RÉGRESSION CORRIGÉE : la migration 999_fix_rls_complete.sql a
-- écrasé open_conversation() en supprimant le garde-fou
-- « bien publié + vérifié uniquement » ajouté par la migration 004.
-- Conséquence : n'importe quel utilisateur connecté pouvait ouvrir
-- une conversation sur un bien en brouillon / non vérifié.
-- Ce correctif rétablit la version sécurisée (identique à 004).
-- ------------------------------------------------------------

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

grant execute on function public.open_conversation(uuid) to authenticated;
