-- ============================================================
-- FIX RLS COMPLET — Exécuter dans le SQL Editor
-- ============================================================

-- 1. Créer is_admin() si elle n'existe pas
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'::public.user_role
  )
$$;

-- 2. Créer set_my_role() si elle n'existe pas
CREATE OR REPLACE FUNCTION public.set_my_role(p_role public.user_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_role NOT IN ('locataire', 'bailleur') THEN
    RAISE EXCEPTION 'Rôle invalide' USING errcode = '22023';
  END IF;

  UPDATE public.profiles
  SET role = p_role, consent_apdp = true
  WHERE id = auth.uid();
END;
$$;

-- 3. Créer open_conversation() si elle n'existe pas
CREATE OR REPLACE FUNCTION public.open_conversation(p_residence_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_id uuid;
BEGIN
  SELECT owner_id INTO v_owner FROM public.residences WHERE id = p_residence_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Bien introuvable' USING errcode = 'P0002';
  END IF;
  IF v_owner = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas vous écrire à vous-même' USING errcode = 'P0001';
  END IF;

  SELECT id INTO v_id FROM public.conversations
  WHERE residence_id = p_residence_id AND tenant_id = auth.uid();

  IF v_id IS NULL THEN
    INSERT INTO public.conversations (residence_id, landlord_id, tenant_id)
    VALUES (p_residence_id, v_owner, auth.uid())
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- 4. Politiques manquantes sur conversations
DROP POLICY IF EXISTS conversations_insert ON public.conversations;
CREATE POLICY conversations_insert ON public.conversations
  FOR INSERT WITH CHECK (
    auth.uid() = tenant_id OR auth.uid() = landlord_id
  );

DROP POLICY IF EXISTS conversations_update ON public.conversations;
CREATE POLICY conversations_update ON public.conversations
  FOR UPDATE USING (
    auth.uid() = tenant_id OR auth.uid() = landlord_id
  );

-- 5. Politiques manquantes sur messages (vérifier WITH CHECK)
DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.tenant_id = auth.uid() OR c.landlord_id = auth.uid())
    )
  );

-- 6. Politiques sur notifications
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 7. Politiques sur leases
DROP POLICY IF EXISTS leases_insert ON public.leases;
CREATE POLICY leases_insert ON public.leases
  FOR INSERT WITH CHECK (
    auth.uid() = tenant_id OR auth.uid() = landlord_id
  );

-- 8. Politiques sur payments
DROP POLICY IF EXISTS payments_insert_tenant ON public.payments;
CREATE POLICY payments_insert_tenant ON public.payments
  FOR INSERT WITH CHECK (
    auth.uid() = tenant_id
  );

-- 9. Politiques sur receipts
DROP POLICY IF EXISTS receipts_insert ON public.receipts;
CREATE POLICY receipts_insert ON public.receipts
  FOR INSERT WITH CHECK (
    auth.uid() = landlord_id
  );

-- 10. Politiques sur residences
DROP POLICY IF EXISTS residences_insert_owner ON public.residences;
CREATE POLICY residences_insert_owner ON public.residences
  FOR INSERT WITH CHECK (
    auth.uid() = owner_id
  );

-- 11. Accorder les permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_role(public.user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_conversation(uuid) TO authenticated;

-- 12. Vérifier que handle_new_user trigger existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'auth' AND c.relname = 'users' AND t.tgname = 'on_auth_user_created'
  ) THEN
    RAISE NOTICE 'ATTENTION: Le trigger handle_new_user n''existe pas!';
  ELSE
    RAISE NOTICE 'OK: Le trigger handle_new_user existe.';
  END IF;
END $$;

-- 13. Vérifier que handle_new_user() est à jour (migration 014)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text;
  v_phone text;
  v_consent boolean;
  v_role public.user_role;
BEGIN
  v_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    split_part(coalesce(new.email, ''), '@', 1)
  );
  v_phone := nullif(new.raw_user_meta_data->>'phone', '');
  v_consent := (new.raw_user_meta_data->>'consent_apdp') = 'true';

  IF new.raw_user_meta_data->>'role' IN ('locataire', 'bailleur') AND v_consent THEN
    v_role := (new.raw_user_meta_data->>'role')::public.user_role;
  ELSE
    v_role := 'visiteur';
  END IF;

  INSERT INTO public.profiles (id, email, phone, full_name, role, consent_apdp)
  VALUES (new.id, new.email, v_phone, v_full_name, v_role,
          CASE WHEN v_role = 'visiteur' THEN false ELSE v_consent END)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
