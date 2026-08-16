-- ============================================================
-- 018_phone_constraint.sql — Contrainte CHECK sur profiles.phone
-- Valide le format béninois (+229 suivi de 10 chiffres) côté
-- serveur, pas seulement côté frontend (assertBeninPhone).
-- ============================================================

-- Contrainte : phone NULL (optionnel) OU format +229XXXXXXXXXX
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_format
  CHECK (phone IS NULL OR phone ~ '^\+229\d{10}$');
