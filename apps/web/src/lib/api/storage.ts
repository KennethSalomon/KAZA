import { supabase } from '../supabase-client';
import { normalizeError } from '../supabase-api';

/** Extrait le chemin d'un objet depuis une URL de stockage Supabase ou un
 * chemin canonique KAZA ({userid}/fichier — bucket implicite). */
export function storagePathFromUrl(url: string): string | null {
  try {
    const decoded = decodeURIComponent(url);
    const withoutQuery = decoded.split('?')[0];
    const marker = `/object/`;
    const idx = withoutQuery.lastIndexOf(marker);
    if (idx === -1) return withoutQuery.replace(/^\/+/, '');
    // …/object/{access}/{bucket}/{path}
    const base = withoutQuery.slice(idx + marker.length);
    const accessSlash = base.indexOf('/');
    if (accessSlash === -1) return null;
    const bucketPath = base.slice(accessSlash + 1);
    const bucketSlash = bucketPath.indexOf('/');
    if (bucketSlash === -1) return null;
    return bucketPath.slice(bucketSlash + 1).replace(/^\/+/, '') || null;
  } catch {
    return null;
  }
}

/** URL signée (1 h) pour lire un fichier d'un bucket privé (JWT header non requis). */
export async function getSignedStorageUrl(bucket: string, url: string): Promise<string | null> {
  let path = storagePathFromUrl(url);
  if (!path) return null;
  // Un chemin nu peut être préfixé du nom du bucket — on normalise.
  if (path.startsWith(`${bucket}/`)) path = path.slice(bucket.length + 1);
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function uploadResidencePhoto(userId: string, file: File): Promise<string> {
  const path = `residences/${userId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
  const { error } = await supabase.storage.from('residence-photos').upload(path, file, {
    contentType: file.type,
  });
  if (error) throw normalizeError(error, 'Upload impossible');
  return path;
}

export async function uploadReceiptFile(userId: string, file: File): Promise<string> {
  const path = `receipts/${userId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
  const { error } = await supabase.storage.from('receipts').upload(path, file, {
    contentType: file.type,
  });
  if (error) throw normalizeError(error, 'Upload impossible');
  return path;
}