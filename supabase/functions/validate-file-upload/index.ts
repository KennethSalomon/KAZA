import { getAdminClient } from '../_shared/db.ts';
import { jsonResponse, errorResponse, handleOptions } from '../_shared/cors.ts';

/**
 * Validation côté serveur des fichiers uploadés dans Supabase Storage.
 * Vérifie les magic bytes (signatures de fichiers) contre une liste blanche.
 * Déclenché par un webhook database sur INSERT storage.objects.
 *
 * Si le fichier est invalide → suppression + log.
 * Si le fichier est valide → 200 OK (pas de suppression).
 */

const ALLOWED_SIGNATURES: Array<{ name: string; check: (b: Uint8Array) => boolean }> = [
  {
    name: 'JPEG',
    check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    name: 'PNG',
    check: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    name: 'PDF',
    check: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  },
  {
    name: 'WEBP',
    check: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

const BUCKETS_WITH_VALIDATION = ['residence-photos', 'chat-files'];

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return handleOptions(req);
  if (req.method !== 'POST') return errorResponse('Méthode non autorisée', 405, origin);

  try {
    const payload = await req.json();

    const record = payload?.record;
    if (!record?.bucket_id || !record?.name) {
      return jsonResponse({ ok: true, skipped: true, reason: 'missing fields' }, 200, origin);
    }

    const bucket = record.bucket_id as string;
    const path = record.name as string;

    if (!BUCKETS_WITH_VALIDATION.includes(bucket)) {
      return jsonResponse({ ok: true, skipped: true, reason: `bucket '${bucket}' not validated` }, 200, origin);
    }

    const supabase = getAdminClient();

    const { data: fileData, error: dlErr } = await supabase.storage
      .from(bucket)
      .download(path);

    if (dlErr || !fileData) {
      console.error(`[validate-upload] download failed: ${bucket}/${path} — ${dlErr?.message}`);
      return jsonResponse({ ok: true, skipped: true, reason: 'download failed' }, 200, origin);
    }

    const buffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (bytes.length < 12) {
      await supabase.storage.from(bucket).remove([path]);
      console.warn(`[validate-upload] REJECTED: ${bucket}/${path} — file too small (${bytes.length} bytes)`);
      return jsonResponse({ ok: false, deleted: true, reason: 'file too small' }, 200, origin);
    }

    const match = ALLOWED_SIGNATURES.find((sig) => sig.check(bytes));

    if (!match) {
      await supabase.storage.from(bucket).remove([path]);
      console.warn(`[validate-upload] REJECTED: ${bucket}/${path} — invalid magic bytes`);
      return jsonResponse({ ok: false, deleted: true, reason: 'invalid file type' }, 200, origin);
    }

    return jsonResponse({ ok: true, validated: match.name }, 200, origin);
  } catch (err) {
    console.error('[validate-upload] unexpected error', err);
    return jsonResponse({ ok: true, skipped: true, reason: 'internal error' }, 200, origin);
  }
});
