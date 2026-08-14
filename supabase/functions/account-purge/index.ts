import { handleOptions, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { requireUser, AuthError } from '../_shared/auth.ts';
import { getAdminClient } from '../_shared/db.ts';
import { rateLimit, clientIp } from '../_shared/rate-limit.ts';

const USERS_BUCKET = 'chat-files';
const RESIDENCES_BUCKET = 'residence-photos';
const RECEIPTS_BUCKET = 'receipts';
const BATCH = 1000;

/**
 * Extrait le chemin d'un objet depuis une URL de stockage OU un chemin nu
 * canonique KAZA ({userid}/fichier). Les pièces jointes de chat sont
 * stockées en chemins nus (bucket privé, pas d'URL publique) ; les URLs
 * publiques/signées existent encore pour les quittances et photos.
 */
function pathFromUrl(bucket: string, url: string): string | null {
  const decoded = decodeURIComponent(url).split('?')[0];
  const marker = `/object/`;
  const markerIdx = decoded.lastIndexOf(marker);
  if (markerIdx !== -1) {
    const base = decoded.slice(markerIdx + marker.length);
    const bucketIdx = base.indexOf(`${bucket}/`);
    if (bucketIdx === -1) return null;
    return base.slice(bucketIdx + bucket.length + 1).replace(/^\/+/, '');
  }
  // Chemin nu — bucket implicite (le bucket est déjà connu de l'appelant).
  return decoded.replace(/^\/+/, '');
}

/** Pagination complète : `.limit()` seul laisserait des fichiers orphelins. */
async function fetchAllRows<T>(
  build: (from: number, to: number) => Promise<{ data: T[] | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += BATCH) {
    const page = await build(offset, offset + BATCH - 1);
    const rows = page.data ?? [];
    out.push(...rows);
    if (rows.length < BATCH) break;
  }
  return out;
}

/**
 * Purge RGPD (art. 17) : supprime tous les fichiers Storage d'un utilisateur
 * PUIS anonymise et bloque son compte (delete_my_account).
 */
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return handleOptions(req);
  if (req.method !== 'POST') return errorResponse('Méthode non autorisée', 405, origin);

  try {
    const user = await requireUser(req);

    if (!(await rateLimit(`purge:${user.id}:${clientIp(req)}`, 5, 3600))) {
      return errorResponse('Trop de demandes de suppression, réessayez dans une heure', 429, origin);
    }

    const supabase = getAdminClient();

    const [residences, conversations, leases] = await Promise.all([
      fetchAllRows<{ photos: string[] | null }>((from, to) =>
        supabase
          .from('residences')
          .select('photos')
          .eq('owner_id', user.id)
          .range(from, to)),
      fetchAllRows<{ id: string }>((from, to) =>
        supabase
          .from('conversations')
          .select('id')
          .or(`tenant_id.eq.${user.id},landlord_id.eq.${user.id}`)
          .range(from, to)),
      fetchAllRows<{ id: string }>((from, to) =>
        supabase
          .from('leases')
          .select('id')
          .or(`tenant_id.eq.${user.id},landlord_id.eq.${user.id}`)
          .range(from, to)),
    ]);

    const toRemove: { bucket: string; path: string }[] = [];

    for (const r of residences) {
      for (const url of r.photos ?? []) {
        const p = pathFromUrl(RESIDENCES_BUCKET, url);
        if (p) toRemove.push({ bucket: RESIDENCES_BUCKET, path: p });
      }
    }

    const convIds = conversations.map((c) => c.id);
    if (convIds.length > 0) {
      for (let i = 0; i < convIds.length; i += 100) {
        const chunk = convIds.slice(i, i + 100);
        const { data: messages } = await supabase
          .from('messages')
          .select('attachments')
          .in('conversation_id', chunk);
        for (const m of messages ?? []) {
          for (const url of (m.attachments as string[] | null) ?? []) {
            const p = pathFromUrl(USERS_BUCKET, url);
            if (p) toRemove.push({ bucket: USERS_BUCKET, path: p });
          }
        }
      }
    }

    const leaseIds = leases.map((l) => l.id);
    if (leaseIds.length > 0) {
      for (let i = 0; i < leaseIds.length; i += 100) {
        const chunk = leaseIds.slice(i, i + 100);
        const { data: receipts } = await supabase
          .from('receipts')
          .select('file_url')
          .in('lease_id', chunk);
        for (const r of receipts ?? []) {
          const p = r.file_url ? pathFromUrl(RECEIPTS_BUCKET, r.file_url) : null;
          if (p) toRemove.push({ bucket: RECEIPTS_BUCKET, path: p });
        }
      }
    }

    // Suppression bloquante : si un fichier échoue, le compte reste — aucune
    // donnée ne doit devenir orpheline et irrécupérable.
    for (const f of toRemove) {
      const { error } = await supabase.storage.from(f.bucket).remove([f.path]);
      if (error) {
        console.error('Remove échoué, purge interrompue', f.bucket, f.path, error.message);
        return errorResponse(
          "Suppression des fichiers impossible — réessayez. Aucune donnée n'a été effacée.",
          500,
          origin,
        );
      }
    }

    // Anonymisation + blocage (l'identité vient du JWT vérifié par requireUser ;
    // la garde SQL exige auth.uid() = p_user_id OU service_role).
    const { error: delErr } = await supabase.rpc('delete_my_account', { p_user_id: user.id });
    if (delErr) {
      console.error('Échec delete_my_account', delErr.message);
      return errorResponse('Suppression du compte impossible', 500, origin);
    }

    return jsonResponse({ removed_count: toRemove.length }, 200, origin);
  } catch (err) {
    if (err instanceof AuthError) return errorResponse('Non authentifié', 401, origin);
    console.error('Erreur purge RGPD', err);
    return errorResponse('Erreur interne', 500, origin);
  }
});