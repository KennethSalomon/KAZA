-- ============================================================
-- KAZA.BJ — seed de démo (uniquement en local : supabase db reset)
-- Comptes E2E/Playwright : locataire.demo@kaza.bj / bailleur.demo@kaza.bj
-- Mot de passe commun : KazaDemo2026!
-- ============================================================

-- Utilisateurs auth (bcrypt via pgcrypto)
-- IMPORTANT : confirmation_token / recovery_token / email_change / invites
-- ne doivent JAMAIS être NULL — GoTrue renvoie « Database error querying
-- schema » (500) au login si ces colonnes sont NULL.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at,
                        confirmation_token, recovery_token, email_change,
                        email_change_token_new, email_change_token_current,
                        invited_at)
values
  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'locataire.demo@kaza.bj', crypt('KazaDemo2026!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Locataire Démo"}', now(), now(),
   '', '', '', '', '', now()),
  ('00000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bailleur.demo@kaza.bj', crypt('KazaDemo2026!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Bailleur Démo"}', now(), now(),
   '', '', '', '', '', now()),
  ('00000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin@kaza.bj', crypt('KazaDemo2026!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Admin KAZA"}', now(), now(),
   '', '', '', '', '', now())
on conflict (id) do nothing;

-- Identités email (requises par GoTrue pour le login password)
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id)
select
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
  'email',
  now(), now(), now(),
  gen_random_uuid()
from auth.users u
where u.email in ('locataire.demo@kaza.bj', 'bailleur.demo@kaza.bj', 'admin@kaza.bj')
  and not exists (
    select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'
  );

-- Profils (le trigger handle_new_user crée un profil visiteur sur chaque insert
-- auth.users, donc on force le rôle ici avec un UPDATE sur conflit d'id)
insert into public.profiles (id, email, phone, full_name, role, consent_apdp)
values
  ('00000000-0000-0000-0000-000000000001', 'locataire.demo@kaza.bj', '+229 90 00 00 01', 'Locataire Démo', 'locataire', true),
  ('00000000-0000-0000-0000-000000000002', 'bailleur.demo@kaza.bj', '+229 90 00 00 02', 'Bailleur Démo', 'bailleur', true),
  ('00000000-0000-0000-0000-000000000003', 'admin@kaza.bj', '+229 90 00 00 03', 'Admin KAZA', 'admin', true)
on conflict (id) do update set
  email = excluded.email,
  phone = excluded.phone,
  full_name = excluded.full_name,
  role = excluded.role,
  consent_apdp = excluded.consent_apdp;

-- Bien de démo du bailleur (publié + vérifié + géolocalisé) pour l'explorer/E2E
insert into public.residences (id, owner_id, title, description, type, price_monthly,
                               deposit, bedrooms, bathrooms, surface, address, city, zone,
                               lat, lng, geom, status, is_published, is_verified)
values (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000002',
  'Studio Lumineux Fidjrossè',
  'Studio meublé à 5 minutes de la plage, cuisine équipée, climatisation.',
  'studio', 85000, 255000, 1, 1, 28,
  'Rue des Pêcheurs', 'Cotonou', 'Fidjrossè',
  6.3486, 2.3855,
  st_setsrid(st_makepoint(2.3855, 6.3486), 4326)::geography,
  'libre', true, true
)
on conflict (id) do nothing;

-- Deuxième bien (non publié : permet de tester la limite freemium et l'édition)
insert into public.residences (id, owner_id, title, description, type, price_monthly,
                               deposit, bedrooms, bathrooms, surface, address, city, zone,
                               status, is_published, is_verified)
values (
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000002',
  'Chambre Meublée Akpakpa',
  'Chambre avec douche interne, dans une cour sécurisée.',
  'chambre', 40000, 120000, 1, 0, 15,
  'Akpakpa Dodomè', 'Cotonou', 'Akpakpa',
  'libre', false, false
)
on conflict (id) do nothing;