-- ============================================================
-- 99999_reapply_open_conversation_guard.sql — Réapplication du
-- garde-fou « bien publié + vérifié uniquement » sur
-- open_conversation() pour corriger la régression introduite
-- par 999_fix_rls_complete.sql (exécuté avant cette migration).
-- Cette migration s'exécute EN DERNIER (99999 > 999 lexicographiquement)
-- pour garantir l'état final sécurisé quel que soit l'historique.
-- ============================================================

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