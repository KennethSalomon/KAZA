-- ============================================================
-- 014_email_confirmation.sql — Création de compte avec vérification email
--
-- Contexte : avec `enable_confirmations = true`, la session est NULL juste
-- après `auth.signUp()`. L'ancien flux client (upsert profil + RPC
-- set_my_role) échouait donc sur la RLS (`auth.uid()` null) en production.
--
-- Solution : le client transmet désormais phone / role / consent_apdp dans
-- `user_metadata` du signUp. Le trigger handle_new_user (déjà security
-- definer, exécuté par le service d'auth) initialise le profil complet en
-- une seule fois, AVANT toute connexion — donc indépendamment de l'état de
-- la confirmation email.
--
-- Garde de sécurité : le rôle ne vient JAMAIS de l'utilisateur sans contrôle.
--  - jamais 'admin' ;
--  - locataire/bailleur exigent un consentement APDP explicite (true).
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_full_name text;
  v_phone text;
  v_consent boolean;
  v_role public.user_role;
begin
  v_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    split_part(coalesce(new.email, ''), '@', 1)
  );
  v_phone := nullif(new.raw_user_meta_data->>'phone', '');
  v_consent := (new.raw_user_meta_data->>'consent_apdp') = 'true';

  if new.raw_user_meta_data->>'role' in ('locataire', 'bailleur') and v_consent then
    v_role := (new.raw_user_meta_data->>'role')::public.user_role;
  else
    v_role := 'visiteur';
  end if;

  insert into public.profiles (id, email, phone, full_name, role, consent_apdp)
  values (new.id, new.email, v_phone, v_full_name, v_role,
          case when v_role = 'visiteur' then false else v_consent end)
  on conflict (id) do nothing;
  return new;
end;
$$;
