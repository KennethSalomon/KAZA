import { handleOptions, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { getAdminClient } from '../_shared/db.ts';
import { rateLimit, clientIp } from '../_shared/rate-limit.ts';

const USERS_BUCKET = 'chat-files';
const RESIDENCES_BUCKET = 'residence-photos';
const RECEIPTS_BUCKET = 'receipts';

/**
 * Extrait le chemin d'un objet à partir de son URL de stockage.
 * Gère toutes les formes (public, authenticated, signée, API) en
 * cherchant le nom du bucket dans l'URL — robuste aux changements
 * de format du frontend.
 */
function pathFromUrl(bucket: string, url: string): string | null {
  const decoded = decodeURIComponent(url);
  const withoutQuery = decoded.split('?')[0];

  // Formes : /storage/v1/object/{access}/{bucket}/chemin,
  // .../object/public/{bucket}/chemin, ou chemin nu contenant bucket/...
  const marker = `/object/`;
  const markerIdx = withoutQuery.lastIndexOf(marker);
  const base = markerIdx === -1 ? withoutQuery : withoutQuery.slice(markerIdx + marker.length);

  const bucketIdx = base.indexOf(`${bucket}/`);
  if (bucketIdx === -1) return null;

  const path = base.slice(bucketIdx + bucket.length + 1).replace(/^\/+/, '');
  return path ? path.replace(/^\/+/, '') : null;
}

/**
 * Purge RGPD (art. 17) : supprime tous les fichiers Storage d'un utilisateur
 * AVANT sa suppression définitive (delete_my_account).
 *  - photos des biens dont il est propriétaire
 *  - pièces jointes de ses conversations (upload sous son user id)
 *  - quittances PDF liées à ses baux
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

    const toRemove: { bucket: string; path: string }[] = [];

    const [residences, conversations, leases] = await Promise.all([
      supabase
        .from('residences')
        .select('photos')
        .eq('owner_id', user.id)
        .limit(1000),
      supabase
        .from('conversations')
        .select('id')
        .or(`tenant_id.eq.${user.id},landlord_id.eq.${user.id}`)
        .limit(1000),
      supabase
        .from('leases')
        .select('id')
        .or(`tenant_id.eq.${user.id},landlord_id.eq.${user.id}`)
        .limit(1000),
    ]);

    for (const r of residences.data ?? []) {
      for (const url of (r.photos as string[] | null) ?? []) {
        const p = pathFromUrl(RESIDENCES_BUCKET, url);
        if (p) toRemove.push({ bucket: RESIDENCES_BUCKET, path: p });
      }
    }

    const convIds = (conversations.data ?? []).map((c) => c.id);
    if (convIds.length > 0) {
      const { data: messages } = await supabase
        .from('messages')
        .select('attachments')
        .in('conversation_id', convIds)
        .limit(2000);
      for (const m of messages ?? []) {
        for (const url of (m.attachments as string[] | null) ?? []) {
          const p = pathFromUrl(USERS_BUCKET, url);
          if (p) toRemove.push({ bucket: USERS_BUCKET, path: p });
        }
      }
    }

    const leaseIds = (leases.data ?? []).map((l) => l.id);
    if (leaseIds.length > 0) {
      const { data: receipts } = await supabase
        .from('receipts')
        .select('file_url')
        .in('lease_id', leaseIds)
        .limit(2000);
      for (const r of receipts ?? []) {
        const p = r.file_url ? pathFromUrl(RECEIPTS_BUCKET, r.file_url) : null;
        if (p) toRemove.push({ bucket: RECEIPTS_BUCKET, path: p });
      }
    }

    const removed: string[] = [];
    for (const f of toRemove) {
      const { error } = await supabase.storage.from(f.bucket).remove([f.path]);
      if (!error) removed.push(`${f.bucket}/${f.path}`);
    }

    const { error: delErr } = await supabase.rpc('delete_my_account');
    if (delErr) return errorResponse('Suppression du compte impossible', 500, origin);

    return jsonResponse({
      removed_count: removed.length,
      removed: removed.slice(0, 20),
    }, 200, origin);
  } catch (err) {
    console.error('Erreur purge RGPD', err);
    return errorResponse('Erreur interne', 500, origin);
  }
});