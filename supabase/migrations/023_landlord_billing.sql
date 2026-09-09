-- ============================================================
-- Migration 023 — Onboarding bailleur (Phase 4.2)
-- Ajoute les colonnes de facturation nécessaires au Stepper :
--   • coordonnées légales (raison sociale, IFU)
--   • coordonnées mobile money (opérateur + numéro)
--   • coordonnées bancaires (IBAN, banque) — optionnelles
--   • statut d'onboarding (booléen `onboarding_completed`)
--
-- Sécurité :
--   • RLS existante `profiles_guard_sensitive` continue de restreindre les
--     modifications au propriétaire du profil ou aux admins.
--   • Les colonnes bancaires ne sont JAMAIS renvoyées aux autres utilisateurs
--     via list_tenants / list_my_conversations (elles filtrent déjà les
--     champs sensibles).
-- ============================================================

alter table public.profiles
  add column if not exists business_name        text,
  add column if not exists tax_id               text,             -- IFU au Bénin
  add column if not exists momo_provider        text check (momo_provider in ('mtn','moov','celtiis') or momo_provider is null),
  add column if not exists momo_number          text check (momo_number ~ '^\+229[0-9]{10}$' or momo_number is null),
  add column if not exists bank_name            text,
  add column if not exists bank_iban            text,
  add column if not exists onboarding_completed boolean not null default false;

comment on column public.profiles.business_name is 'Raison sociale du bailleur (personne physique ou morale).';
comment on column public.profiles.tax_id is 'Identifiant Fiscal Unique (IFU) — optionnel pour les particuliers.';
comment on column public.profiles.momo_provider is 'Opérateur mobile money pour l''encaissement : mtn | moov | celtiis.';
comment on column public.profiles.momo_number is 'Numéro mobile money du bailleur (format +229XXXXXXXXXX).';
comment on column public.profiles.bank_name is 'Banque du bailleur — optionnel.';
comment on column public.profiles.bank_iban is 'IBAN du bailleur — optionnel, utilisé si virement bancaire.';
comment on column public.profiles.onboarding_completed is 'True une fois le tunnel d''onboarding bailleur complété.';

-- ------------------------------------------------------------
-- RPC : complete_landlord_onboarding
-- Le bailleur soumet le formulaire en un seul appel atomique. Le trigger
-- `profiles_guard_sensitive` vérifie déjà que auth.uid() = id.
-- ------------------------------------------------------------
create or replace function public.complete_landlord_onboarding(
  p_business_name  text,
  p_tax_id         text,
  p_momo_provider  text,
  p_momo_number    text,
  p_bank_name      text default null,
  p_bank_iban      text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '42501';
  end if;

  -- note : on force le rôle bailleur ici. Un locataire qui appelle cette
  -- RPC bascule bailleur — cohérent avec l'UX du tunnel post-inscription.
  update public.profiles
     set business_name        = coalesce(nullif(trim(p_business_name), ''), business_name),
         tax_id               = nullif(trim(p_tax_id), ''),
         momo_provider        = p_momo_provider,
         momo_number          = p_momo_number,
         bank_name            = nullif(trim(coalesce(p_bank_name, '')), ''),
         bank_iban            = nullif(trim(coalesce(p_bank_iban, '')), ''),
         role                 = 'bailleur',
         onboarding_completed = true
   where id = v_uid;

  if not found then
    raise exception 'Profil introuvable' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.complete_landlord_onboarding(text,text,text,text,text,text) to authenticated;

-- ------------------------------------------------------------
-- RPC : get_my_billing (le bailleur relit ses infos pour ré-éditer plus tard)
-- ------------------------------------------------------------
create or replace function public.get_my_billing()
returns table (
  business_name        text,
  tax_id               text,
  momo_provider        text,
  momo_number          text,
  bank_name            text,
  bank_iban            text,
  onboarding_completed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '42501';
  end if;

  return query
    select p.business_name, p.tax_id, p.momo_provider, p.momo_number,
           p.bank_name, p.bank_iban, p.onboarding_completed
      from public.profiles p
     where p.id = v_uid;
end;
$$;

grant execute on function public.get_my_billing() to authenticated;
