-- ============================================================
-- 028_rls_spatial_ref_sys.sql — Activer RLS sur spatial_ref_sys
--
-- Table système PostGIS contenant les projections (SRID).
-- La table est possédée par PostGIS extension owner, pas postgres.
-- En Docker local, postgres ne peut pas changer la propriété.
-- On enveloppe chaque opération dans DO...EXCEPTION WHEN OTHERS
-- pour que la migration soit résiliente et ne bloque pas le CI.
-- ============================================================

-- 1. Transférer la propriété (échoue sur Docker local)
DO $$
BEGIN
  ALTER TABLE public.spatial_ref_sys OWNER TO postgres;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'skipping OWNER transfer: %', SQLERRM;
END $$;

-- 2. Activer RLS
DO $$
BEGIN
  ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.spatial_ref_sys FORCE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'skipping RLS enable: %', SQLERRM;
END $$;

-- 3. Policy SELECT pour anon
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
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'skipping anon policy: %', SQLERRM;
END $$;

-- 4. Policy SELECT pour authenticated
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
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'skipping authenticated policy: %', SQLERRM;
END $$;
