-- ============================================================
-- 023_rls_spatial_ref_sys.sql — Activer RLS sur spatial_ref_sys
--
-- Table système PostGIS contenant les projections (SRID).
-- Le SQL Editor Supabase s'exécute en tant que `postgres` mais
-- la table est possédée par PostGIS. On transfère la propriété
-- avant d'activer RLS.
-- ============================================================

-- 1. Transfer ownership to postgres (SQL Editor role)
ALTER TABLE public.spatial_ref_sys OWNER TO postgres;

-- 2. Enable RLS
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spatial_ref_sys FORCE ROW LEVEL SECURITY;

-- 3. SELECT policies for anon + authenticated
CREATE POLICY spatial_ref_sys_select_anon
  ON public.spatial_ref_sys FOR SELECT
  TO anon
  USING (true);

CREATE POLICY spatial_ref_sys_select_authenticated
  ON public.spatial_ref_sys FOR SELECT
  TO authenticated
  USING (true);
