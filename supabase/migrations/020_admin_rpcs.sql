-- ============================================================
-- 020_admin_rpcs.sql — RPC functions for admin actions
-- Replaces direct .update() calls with SECURITY DEFINER functions
-- for defense-in-depth authorization
-- ============================================================

-- 1. Verify a residence (admin only)
create or replace function public.admin_verify_residence(p_residence_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Authorization check
  if not public.is_admin() then
    raise exception 'Seul un administrateur peut vérifier une résidence' using errcode = '42501';
  end if;

  -- Verify residence exists
  if not exists (select 1 from public.residences where id = p_residence_id) then
    raise exception 'Résidence introuvable' using errcode = 'P0002';
  end if;

  update public.residences
  set is_verified = true,
      updated_at = now()
  where id = p_residence_id;

  -- Notify landlord
  insert into public.notifications (user_id, type, title, body, data)
  select owner_id, 'system', 'Résidence vérifiée',
         'Votre annonce « ' || title || ' » a été vérifiée et est maintenant visible.',
         jsonb_build_object('residence_id', id)
  from public.residences
  where id = p_residence_id;
end;
$$;

grant execute on function public.admin_verify_residence(uuid) to authenticated;

-- 2. Unpublish a residence (admin only)
create or replace function public.admin_unpublish_residence(p_residence_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.residence_status;
  v_owner_id uuid;
begin
  -- Authorization check
  if not public.is_admin() then
    raise exception 'Seul un administrateur peut dépublier une résidence' using errcode = '42501';
  end if;

  -- Get current state
  select status, owner_id into v_status, v_owner_id
  from public.residences
  where id = p_residence_id;

  if v_owner_id is null then
    raise exception 'Résidence introuvable' using errcode = 'P0002';
  end if;

  if v_status = 'occupee' then
    raise exception 'Impossible de dépublier une résidence occupée' using errcode = 'P0001';
  end if;

  update public.residences
  set is_published = false,
      updated_at = now()
  where id = p_residence_id;

  -- Notify landlord
  insert into public.notifications (user_id, type, title, body, data)
  select v_owner_id, 'system', 'Résidence dépubliée',
         'Votre annonce a été retirée de la publication par l''administration.',
         jsonb_build_object('residence_id', p_residence_id);
end;
$$;

grant execute on function public.admin_unpublish_residence(uuid) to authenticated;

-- 3. Set user premium status (admin only)
create or replace function public.admin_set_premium(p_user_id uuid, p_is_premium boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Authorization check
  if not public.is_admin() then
    raise exception 'Seul un administrateur peut modifier le statut Premium' using errcode = '42501';
  end if;

  -- Prevent self-modification edge case (defense in depth)
  if p_user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas modifier votre propre statut Premium' using errcode = 'P0001';
  end if;

  -- Verify user exists
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Utilisateur introuvable' using errcode = 'P0002';
  end if;

  update public.profiles
  set is_premium = p_is_premium,
      updated_at = now()
  where id = p_user_id;

  -- Notify user
  insert into public.notifications (user_id, type, title, body, data)
  select p_user_id, 'system',
         case when p_is_premium then 'Statut Premium activé' else 'Statut Premium retiré' end,
         case when p_is_premium
              then 'Vous avez maintenant accès au plan Premium : publications illimitées, visibilité prioritaire.'
              else 'Votre statut Premium a été retiré. Vous retrouvez les limites du plan gratuit.'
         end,
         jsonb_build_object('is_premium', p_is_premium);
end;
$$;

grant execute on function public.admin_set_premium(uuid, boolean) to authenticated;

-- 4. Toggle user role (admin only, cannot assign admin role)
create or replace function public.admin_toggle_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Authorization check
  if not public.is_admin() then
    raise exception 'Seul un administrateur peut modifier les rôles' using errcode = '42501';
  end if;

  -- Validate role: only locataire or bailleur allowed (never admin via this path)
  if p_role not in ('locataire', 'bailleur') then
    raise exception 'Rôle invalide : seuls locataire et bailleur sont autorisés' using errcode = '22023';
  end if;

  -- Prevent self-modification
  if p_user_id = auth.uid() then
    raise exception 'Vous ne pouvez pas modifier votre propre rôle' using errcode = 'P0001';
  end if;

  -- Verify user exists
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Utilisateur introuvable' using errcode = 'P0002';
  end if;

  update public.profiles
  set role = p_role,
      consent_apdp = true,  -- Role change implies consent
      updated_at = now()
  where id = p_user_id;

  -- Notify user
  insert into public.notifications (user_id, type, title, body, data)
  select p_user_id, 'system',
         'Votre rôle a été modifié',
         'Votre rôle sur Kaza est maintenant : ' || p_role || '.',
         jsonb_build_object('role', p_role);
end;
$$;

grant execute on function public.admin_toggle_role(uuid, public.user_role) to authenticated;