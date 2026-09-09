import { supabase } from '../supabase-client';
import type {
  Residence,
  ResidenceCreateInput,
  ResidenceWithRelations,
  ResidenceType,
  ReviewsResult,
} from '../types';
import { normalizeError } from '../supabase-api';
import { requireUser } from '../require-user';

export interface SearchParams {
  q?: string;
  city?: string;
  zone?: string;
  type?: string;
  max_price?: number;
  lat?: number;
  lng?: number;
  radius_km?: number;
  limit?: number;
  offset?: number;
}

export async function searchResidences(params: SearchParams = {}): Promise<Residence[]> {
  const { data, error } = await supabase.rpc('search_residences', {
    p_q: params.q || null,
    p_city: params.city || null,
    p_zone: params.zone || null,
    p_type: (params.type || null) as ResidenceType | null,
    p_max_price: params.max_price ?? null,
    p_lat: params.lat ?? null,
    p_lng: params.lng ?? null,
    p_radius_km: params.radius_km ?? 10,
    p_limit: params.limit ?? 40,
    p_offset: params.offset ?? 0,
  });
  if (error) throw normalizeError(error, 'Recherche impossible');
  return (data ?? []) as unknown as Residence[];
}

export async function getResidence(id: string): Promise<ResidenceWithRelations> {
  const { data, error } = await supabase.rpc('get_residence', { p_residence_id: id });
  if (error) throw normalizeError(error, 'Bien introuvable');
  return data as unknown as ResidenceWithRelations;
}

export async function listMyResidences(): Promise<ResidenceWithRelations[]> {
  const user = await requireUser().catch(() => null);
  if (!user) return [];
  const { data, error } = await supabase
    .from('residences')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as ResidenceWithRelations[];
}

export type ResidenceInput = Omit<
  Residence,
  | 'id'
  | 'owner_id'
  | 'status'
  | 'is_published'
  | 'is_verified'
  | 'views_count'
  | 'created_at'
  | 'distance_km'
  | 'owner'
  | 'lat'
  | 'lng'
> & { lat?: number | null; lng?: number | null };

/** Géocodage best-effort via Nominatim (OpenStreetMap), sans clé API. */
export async function geocode(city: string, zone: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(`${zone} ${city}, Bénin`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`,
      { headers: { Accept: 'application/json', 'User-Agent': 'KazaBJ/1.0 (kazagroupe0@gmail.com)' } },
    );
    if (!res.ok) return null;
    const hits = (await res.json()) as { lat: string; lon: string }[];
    if (hits.length === 0) return null;
    return { lat: Number(hits[0].lat), lng: Number(hits[0].lon) };
  } catch {
    return null;
  }
}

export async function createResidence(input: ResidenceCreateInput): Promise<Residence> {
  const user = await requireUser();

  const geo = input.lat != null && input.lng != null
    ? { lat: input.lat, lng: input.lng }
    : await geocode(input.city ?? '', input.zone ?? '');

  const payload = {
    ...input,
    owner_id: user.id,
    price_monthly: Number(input.price_monthly),
    deposit: Number(input.deposit ?? 0),
    bedrooms: Number(input.bedrooms ?? 1),
    bathrooms: Number(input.bathrooms ?? 1),
    surface: input.surface != null ? Number(input.surface) : null,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    geom: geo ? `SRID=4326;POINT(${geo.lng} ${geo.lat})` : null,
  };

  const { data, error } = await supabase
    .from('residences')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw normalizeError(error, 'Création impossible');
  return data as Residence;
}

export async function updateResidence(
  id: string,
  patch: Partial<ResidenceInput> & { status?: Residence['status']; is_published?: boolean },
): Promise<void> {
  const geo =
    patch.lat != null && patch.lng != null
      ? { lat: patch.lat, lng: patch.lng }
      : patch.city || patch.zone
        ? await geocode(patch.city ?? '', patch.zone ?? '')
        : null;
  const { error } = await supabase
    .from('residences')
    .update({
      ...patch,
      lat: geo?.lat ?? patch.lat ?? null,
      lng: geo?.lng ?? patch.lng ?? null,
      geom: geo ? `SRID=4326;POINT(${geo.lng} ${geo.lat})` : null,
    })
    .eq('id', id);
  if (error) throw normalizeError(error, 'Mise à jour impossible');
}

export async function incrementResidenceViews(id: string): Promise<void> {
  await supabase.rpc('increment_residence_views', { p_id: id });
}

export async function toggleFavorite(residenceId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('toggle_favorite', { p_residence_id: residenceId });
  if (error) throw normalizeError(error, 'Action impossible');
  return data as boolean;
}

export async function listMyFavorites(): Promise<Residence[]> {
  const { data, error } = await supabase.rpc('list_my_favorites');
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as unknown as Residence[];
}

export async function listMyFavoriteIds(): Promise<string[]> {
  const { data, error } = await supabase.rpc('list_my_favorite_ids');
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as string[];
}

export async function addReview(residenceId: string, rating: number, comment?: string): Promise<void> {
  const { error } = await supabase.rpc('add_review', {
    p_residence_id: residenceId,
    p_rating: rating,
    p_comment: comment ?? null,
  });
  if (error) throw normalizeError(error, 'Avis impossible à publier');
}

export async function listReviews(residenceId: string): Promise<ReviewsResult> {
  const { data, error } = await supabase.rpc('list_reviews', { p_residence_id: residenceId });
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? { average: 0, count: 0, reviews: [] }) as unknown as ReviewsResult;
}