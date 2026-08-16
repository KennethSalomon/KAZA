-- ============================================================
-- 017 — Validation MIME côté serveur pour les uploads Storage.
-- Vérifie le content_type déclaré par le client contre une
-- liste blanche. Ne s'applique qu'aux buckets résidentiels
-- et au chat — les uploads internes (receipts, etc.) ne sont
-- pas impactés.
-- ============================================================

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

create or replace function public._guard_storage_upload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket text := NEW.bucket_id;
  v_mime   text;
  v_size   int;
begin
  -- Ne valider que les buckets contenant des fichiers utilisateur
  if v_bucket is null or v_bucket not in ('residence-photos', 'chat-files') then
    return NEW;
  end if;

  v_mime := coalesce(NEW.metadata->>'mimetype', '');
  v_size := coalesce((NEW.metadata->>'size')::int, 0);

  if v_mime = '' then
    return NEW;
  end if;

  if not public._allowed_upload_mime(v_mime) then
    raise exception 'Type MIME non autorisé : %', v_mime
      using errcode = 'check_violation';
  end if;

  if v_size > 20 * 1024 * 1024 then
    raise exception 'Fichier trop volumineux : % octets', v_size
      using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$;

create trigger guard_storage_upload
  before insert on storage.objects
  for each row
  execute function public._guard_storage_upload();
