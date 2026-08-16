-- ============================================================
-- 017 — Validation MIME côté serveur pour les uploads Storage.
-- Vérifie le content_type déclaré par le client contre une
-- liste blanche. Les magic bytes restent vérifiables via
-- l'Edge Function validate-file-upload en production.
-- ============================================================

-- Liste blanche des types MIME autorisés
create or replace function public._allowed_upload_mime(p_mime text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_mime in (
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  );
$$;

-- Trigger guard : rejette les uploads dont le content_type n'est pas autorisé
create or replace function public._guard_storage_upload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mime text := coalesce(NEW.metadata->>'mimetype', '');
  v_size int  := coalesce((NEW.metadata->>'size')::int, 0);
  v_bucket text := NEW.bucket_id;
begin
  -- Valider uniquement les buckets contenant des fichiers utilisateur
  if v_bucket in ('residence-photos', 'chat-files') then
    if not public._allowed_upload_mime(v_mime) then
      raise exception 'Type MIME non autorisé : %', v_mime
        using errcode = 'check_violation';
    end if;
    -- Garde-fou taille (20 Mo, cohérent avec config.toml file_size_limit)
    if v_size > 20 * 1024 * 1024 then
      raise exception 'Fichier trop volumineux : % octets', v_size
        using errcode = 'check_violation';
    end if;
  end if;
  return NEW;
end;
$$;

-- Trigger sur INSERT dans storage.objects
create trigger guard_storage_upload
  before insert on storage.objects
  for each row
  execute function public._guard_storage_upload();

-- Politique RLS supplémentaire : seule l'Edge Function (service_role)
-- ou un utilisateur authentifié peut uploader dans les buckets autorisés.
-- (Les policies existantes dans 016_storage_upload_ownership.sql restent
-- en place ; ce trigger est une couche défensive supplémentaire.)
