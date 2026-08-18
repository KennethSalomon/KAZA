-- ============================================================
-- 023_rls_spatial_ref_sys.sql — Activer RLS sur spatial_ref_sys
--
-- Table système PostGIS contenant les projections (SRID).
-- La table est possédée par PostGIS extension owner, pas postgres.
-- En Docker local, postgres ne peut pas changer la propriété.
-- On enveloppe chaque opération dans un DO...EXCEPTION pour
-- que la migration soit résiliente et ne bloque pas le CI.
-- ============================================================

DO $$
BEGIN
  ALTER TABLE public.spatial_ref_sys OWNER TO postgres;
EXCEPTION WHEN insufficient_privilege THEN
  -- Docker local : postgres n'est pas owner — on continue
  RAISE NOTICE 'skipping OWNER transfer: insufficient privilege';
END $$;

DO $$
BEGIN
  ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.spatial_ref_sys FORCE ROW LEVEL SECURITY;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'skipping RLS enable: insufficient privilege';
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'spatial_ref_sys_select_anon'
  ) THEN
    CREATE POLICY spatial_ref_sys_select_anon
      ON public.spatial_ref_sys FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'spatial_ref_sys_select_authenticated'
  ) THEN
    CREATE POLICY spatial_ref_sys_select_authenticated
      ON public.spatial_ref_sys FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
