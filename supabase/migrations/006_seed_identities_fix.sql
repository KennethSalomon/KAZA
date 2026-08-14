-- ============================================================
-- 006_seed_identities_fix.sql — Les comptes de démo créés par seed
-- n'avaient pas d'entrée dans auth.identities (requis par GoTrue
-- pour le login password). On rattache leurs identités "email".
-- NOTE : la colonne "email" de auth.identities est générée
-- automatiquement depuis identity_data — on ne l'insère pas.
-- ============================================================

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id)
select
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
  'email',
  now(),
  now(),
  now(),
  gen_random_uuid()
from auth.users u
where u.email in ('locataire.demo@kaza.bj', 'bailleur.demo@kaza.bj', 'admin@kaza.bj')
  and not exists (
    select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'
  );