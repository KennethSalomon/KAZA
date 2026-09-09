-- report_cash_payment : insert sécurisé côté serveur.
-- Le landlord_id est lu depuis le bail (pas injecté par le client).
CREATE OR REPLACE FUNCTION public.report_cash_payment(
  p_lease_id uuid,
  p_amount numeric,
  p_period_start date,
  p_period_end date
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_landlord_id uuid;
BEGIN
  -- Vérifier que l'appelant est bien le locataire du bail
  SELECT tenant_id, landlord_id INTO v_tenant_id, v_landlord_id
  FROM public.leases
  WHERE id = p_lease_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Bail introuvable' USING ERRCODE = 'P0002';
  END IF;

  IF v_tenant_id != auth.uid() THEN
    RAISE EXCEPTION 'Vous n''êtes pas le locataire de ce bail' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.payments (
    lease_id, tenant_id, landlord_id, amount,
    period_start, period_end, method, provider, status
  ) VALUES (
    p_lease_id, v_tenant_id, v_landlord_id, p_amount,
    p_period_start, p_period_end, 'cash', 'cash', 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_cash_payment(uuid, numeric, date, date) TO authenticated;
