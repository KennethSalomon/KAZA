-- ============================================================
-- 016_storage_upload_ownership.sql — Upload photos verrouillé
-- par propriété (fix audit "Mirage Front-End").
--
-- Avant : residence-photos-upload acceptait TOUT utilisateur
-- authentifié, chemin libre => un acteur malveillant pouvait
-- remplir le bucket partagé (déni de ressources) sans lien
-- avec ses biens.
--
-- Après : le premier dossier du chemin DOIT être l'UUID de
-- l'utilisateur connecté (même règle que chat-files).
-- Le frontend uploade sous /{user.id}/{timestamp}-{nom}.
-- ============================================================

drop policy if exists "residence-photos-upload" on storage.objects;

create policy "residence-photos-upload-owner" on storage.objects
  for insert with check (
    bucket_id = 'residence-photos' and auth.role() = 'authenticated'
      and (storage.foldername(name))[1] = auth.uid()::text
  );
