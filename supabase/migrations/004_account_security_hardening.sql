-- ============================================================
-- 004_account_security_hardening.sql — Verrouillage des comptes (audit sécurité)
-- 1. Escalade de privilèges : impossible pour un utilisateur de changer
--    son role / is_premium / consent_apdp depuis le client.
-- 2. Rôle attribué UNIQUEMENT via handle_new_user (visiteur) ou via la RPC
--    set_my_role() (locataire/bailleur), jamais via UPDATE direct client.
-- 3. list_overdue_leases / list_upcoming_due : réservées au service role (CRON).
-- 4. list_tenants : restreinte aux locataires avec lesquels le bailleur a
--    un bail ou une conversation (pas tout l'annuaire).
-- 5. payments_insert_tenant : le locataire ne peut déclarer un paiement que
--    sur ses propres baux actifs.
-- 6. open_conversation : seulement pour les biens publiés et vérifiés.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Garde-fou : colonnes sensibles du profil immuables côté client.
-- ------------------------------------------------------------
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

-- À l'INSERT client, seuls visiteur / locataire / bailleur sont acceptés (jamais admin),
-- et le consentement est obligatoire pour ces deux derniers.
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

-- ------------------------------------------------------------
-- 2. RPC set_my_role : le seul chemin (avec le consentement) pour
--    passer de visiteur -> locataire / bailleur. Jamais admin.
-- ------------------------------------------------------------
create or replace function public.set_my_role(p_role public.user_role)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if p_role not in ('locataire', 'bailleur') then
    raise exception 'Rôle non autorisé' using errcode = '42501';
  end if;
  update public.profiles
     set role = p_role, consent_apdp = true
   where id = auth.uid();
  if not found then
    raise exception 'Profil introuvable' using errcode = 'P0002';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 3. Fonctions CRON : exécution réservée au service_role.
-- ------------------------------------------------------------
revoke execute on function public.list_overdue_leases() from anon, authenticated;
revoke execute on function public.list_upcoming_due(int) from anon, authenticated;
grant execute on function public.list_overdue_leases() to service_role;
grant execute on function public.list_upcoming_due(int) to service_role;

-- ------------------------------------------------------------
-- 4. list_tenants : uniquement les locataires liés au bailleur
--    (bail ou conversation en commun). Plus d'annuaire global.
-- ------------------------------------------------------------
create or replace function public.list_tenants()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  v_role public.user_role;
  v_json jsonb;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role not in ('bailleur', 'admin') then
    raise exception 'Réservé aux bailleurs' using errcode = '42501';
  end if;
  select jsonb_agg(jsonb_build_object(
           'id', p.id, 'full_name', p.full_name, 'email', p.email, 'phone', p.phone)
         order by p.full_name)
    into v_json
    from public.profiles p
   where p.role = 'locataire'
     and (
       exists (select 1 from public.leases l where l.tenant_id = p.id and l.landlord_id = auth.uid())
       or exists (select 1 from public.conversations c where c.tenant_id = p.id and c.landlord_id = auth.uid())
     );
  return coalesce(v_json, '[]'::jsonb);
end;
$$;

-- ------------------------------------------------------------
-- 5. payments_insert_tenant : le paiement doit porter sur un bail
--    dont l'appelant est bien le locataire (actif).
-- ------------------------------------------------------------
drop policy if exists payments_insert_tenant on public.payments;
create policy payments_insert_tenant on public.payments
  for insert with check (
    tenant_id = auth.uid()
    and status = 'pending'
    and provider_ref is null
    and exists (
      select 1 from public.leases l
       where l.id = lease_id and l.tenant_id = auth.uid() and l.status = 'active'
    )
  );

-- ------------------------------------------------------------
-- 6. open_conversation : bien publié + vérifié uniquement.
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
