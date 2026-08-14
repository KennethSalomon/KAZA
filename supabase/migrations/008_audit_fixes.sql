-- ============================================================
-- 008_audit_fixes.sql — Corrections issues de l'audit
-- 1. Policy residences_select : parenthèses explicites (M4)
-- 2. Policy receipts-read-owner : matche les URLs de MÊME bucket
--    (sécurisation du LIKE contre les collisions de chemins)
-- ============================================================

-- 1. Parenthèses explicites : (publié ET vérifié) OU propriétaire.
drop policy if exists residences_select on public.residences;
create policy residences_select on public.residences
  for select using ((is_published = true and is_verified = true) or owner_id = auth.uid());

-- 2. La policy de lecture des quittances matchait `% || name` contre n'importe
--    quel bucket. On restreint au bucket 'receipts' ET à la présence du
--    lease courant : un utilisateur ne lit que les fichiers de SES baux.
drop policy if exists "receipts-read-owner" on storage.objects;
create policy "receipts-read-owner" on storage.objects
  for select using (
    bucket_id = 'receipts' and exists (
      select 1 from public.receipts r
      join public.leases l on l.id = r.lease_id
      where (l.tenant_id = auth.uid() or l.landlord_id = auth.uid()
             or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
        and r.file_url like '%' || name
    )
  );