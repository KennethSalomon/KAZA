-- ============================================================
-- 005_account_security_hardening_fix.sql — Correctif du 004
-- Le 004 bloquait les connexions SQL directes (migrations / seed /
-- console), où auth.role() = NULL. On autorise ce contexte pour
-- que le seed et les migrations continuent de fonctionner.
-- ============================================================

create or replace function public.profiles_guard_sensitive()
returns trigger language plpgsql set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  select (p.role = 'admin') into v_is_admin
    from public.profiles p where p.id = auth.uid();
  v_is_admin := coalesce(v_is_admin, false);

  -- service_role (edge functions / console) et connexion DB directe
  -- (migrations / seed / console SQL) ont tous les droits
  if auth.role() = 'service_role' or auth.role() is null then
    return new;
  end if;

  -- id : jamais modifiable
  if new.id is distinct from old.id then
    raise exception 'Le champ id est immuable' using errcode = '42501';
  end if;

  -- role : seul un admin peut changer le rôle d'un autre utilisateur
  if new.role is distinct from old.role and not v_is_admin then
    raise exception 'Impossible de changer le rôle' using errcode = '42501';
  end if;

  -- is_premium : seul un admin accorde le premium
  if new.is_premium is distinct from old.is_premium and not v_is_admin then
    raise exception 'Impossible de modifier le statut premium' using errcode = '42501';
  end if;

  -- consent_apdp : passer de false à true est la seule évolution autorisée
  -- (on ne peut pas "retirer" le consentement côté client — processus RGPD côté support)
  if old.consent_apdp = true and new.consent_apdp = false then
    raise exception 'Le consentement APDP ne peut pas être retiré côté client' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_before_update on public.profiles;
create trigger profiles_before_update before update on public.profiles
  for each row execute procedure public.profiles_guard_sensitive();

create or replace function public.profiles_guard_insert()
returns trigger language plpgsql set search_path = public
as $$
begin
  if auth.role() = 'service_role' or auth.role() is null then
    return new;
  end if;
  if new.role = 'admin' then
    raise exception 'Rôle admin non attribuable' using errcode = '42501';
  end if;
  if new.role in ('locataire', 'bailleur') and not new.consent_apdp then
    raise exception 'Consentement APDP requis' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_before_insert on public.profiles;
create trigger profiles_before_insert before insert on public.profiles
  for each row execute procedure public.profiles_guard_insert();
