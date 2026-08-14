-- ============================================================
-- 003_fix_freemium_draft.sql — Correctif trigger freemium
-- La limite « 1 bien » ne s'applique qu'aux biens PUBLIÉS.
-- Un brouillon (is_published = false) doit rester créable même
-- lorsqu'un bien est déjà publié (détecté via le seed en cloud).
-- ============================================================

create or replace function public.enforce_freemium_limit()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  p_is_premium boolean;
  p_role public.user_role;
  n int;
begin
  select is_premium, role into p_is_premium, p_role from public.profiles where id = new.owner_id;
  if coalesce(p_role, 'visiteur') = 'visiteur' then
    raise exception 'Créez un compte bailleur pour publier un bien' using errcode = '42501';
  end if;
  if coalesce(p_is_premium, false) or p_role = 'admin' then
    return new;
  end if;
  -- Limite appliquée uniquement aux biens publiés
  if not new.is_published then
    return new;
  end if;
  select count(*) into n from public.residences
   where owner_id = new.owner_id and is_published = true;
  if n >= 1 then
    raise exception 'Limite du plan gratuit atteinte (1 bien). Passez au Premium.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
