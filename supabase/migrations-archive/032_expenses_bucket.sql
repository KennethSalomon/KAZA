-- ============================================================
-- Migration 032: Storage bucket `expenses` (P0-4)
-- Justificatifs de dépenses — rend le bucket reproductible par
-- le codebase (supabase db reset), cohérent avec supabase/config.toml :
--   - bucket privé : seul le bailleur propriétaire peut accéder
--   - taille max   : 5 Mo (config.toml [storage] file_size_limit)
--   - MIME         : images + PDF
--   - chemin canonique (décidé au lot Storage, PAS ici) :
--     expenses/{expense_id}.{extension}
--
-- IMPORTANT — policies volontairement NON créées dans cette migration :
-- le path objet exact et le flux d'upload frontend ne sont pas encore
-- implémentés. Les policies (SELECT/INSERT limités au propriétaire,
-- validation du préfixe de chemin) seront ajoutées au lot Storage avec
-- l'upload UI. Le bucket reste donc inaccessible aux rôles client
-- (aucune policy = déni par défaut) jusqu'à cette étape.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expenses',
  'expenses',
  false,
  5 * 1024 * 1024, -- 5 MiB
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Le garde MIME/taille existant (_guard_storage_upload, migration 017)
-- ne s'applique qu'aux buckets utilisateur résidentiels et chat. Le bucket
-- `expenses` est couvert nativement par allowed_mime_types/file_size_limit
-- ci-dessus (validés par le service Storage lui-même), pas besoin d'un
-- trigger supplémentaire à ce stade.
