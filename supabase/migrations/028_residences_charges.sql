-- ============================================================
-- Migration 028 — Phase 6.2 (Formulaire dynamique d'ajout / édition)
-- Ajoute la colonne `charges_monthly` sur `residences` pour distinguer
-- le loyer hors charges du montant des charges (eau, électricité, ordures…).
-- Le montant TTC affiché au locataire = price_monthly + charges_monthly.
--
-- Rétro-compat :
--   • Colonne nullable avec DEFAULT 0 — les résidences existantes ne payent pas
--     de charges tant qu'elles ne sont pas mises à jour.
--   • La contrainte check garantit un montant positif ou nul.
--
-- Aucun impact sur les baux ou paiements existants : le champ est purement
-- descriptif et sert au formulaire d'édition + à l'affichage locataire.
-- ============================================================

alter table public.residences
  add column if not exists charges_monthly numeric(12, 2) not null default 0
    check (charges_monthly >= 0);

comment on column public.residences.charges_monthly is
  'Charges mensuelles (eau, électricité, ordures) — hors loyer principal. Défaut 0.';
