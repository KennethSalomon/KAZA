import { supabase } from './supabase-client';
import { env } from './env';
import type {
  AppNotification,
  Conversation,
  ConversationWithRelations,
  Lease,
  LeaseWithRelations,
  Message,
  Payment,
  PaymentWithRelations,
  Profile,
  Receipt,
  ReceiptWithRelations,
  Residence,
  ResidenceCreateInput,
  ResidenceWithRelations,
  ResidenceType,
  ReviewsResult,
} from './types';

// ============================================================
// Couche d'accès « Supabase seule » — remplace l'ancien client API.
// Le SQL (RPC security definer) est la source de vérité ; RLS protège
// chaque table. Aucun backend : tout passe par supabase-js + edge functions.
// ============================================================

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string[]>;

  constructor(status: number, message: string, fields?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

/** Valide un numéro de téléphone bénin : +229 suivi de 10 chiffres. */
function assertBeninPhone(phone: string): void {
  const cleaned = phone.replace(/\s+/g, '');
  if (!/^\+229\d{10}$/.test(cleaned)) {
    throw new ApiError(400, 'Numéro invalide — format attendu : +229 01 00 00 00 00');
  }
}

const PGRST_CODE = (code: string | undefined): number => {
  switch (code) {
    case 'P0001':
      return 409; // conflit métier (ex : limite freemium, caution trop élevée)
    case 'P0002':
      return 404;
    case '42501':
      return 403;
    default:
      return 400;
  }
};

export function normalizeError(err: unknown, fallback: string): ApiError {
  const e = err as { code?: string; message?: string; details?: string } | null;
  if (e?.message) {
    return new ApiError(PGRST_CODE(e.code), e.message);
  }
  if (e?.details) return new ApiError(400, e.details);
  return new ApiError(400, fallback);
}

async function callFunction<T>(name: string, body: unknown): Promise<T> {
  // Le JWT est validé côté serveur par l'edge function (requireUser) ;
  // ici on ne récupère que le token de session pour l'Authorization header.
  const { data: session } = await supabase.auth.getSession();
  const base = env.supabaseUrl;
  const res = await fetch(`${base}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session.session?.access_token
        ? { Authorization: `Bearer ${session.session.access_token}` }
        : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => null)) as { error?: string } | T | null;
  if (!res.ok) {
    throw new ApiError(res.status, (payload as { error?: string } | null)?.error ?? `Erreur ${res.status}`);
  }
  return payload as T;
}

// ------------------------------------------------------------
// Auth
// ------------------------------------------------------------
export async function signIn(email: string, password: string, captchaToken: string): Promise<void> {
  // Passe par /api/login (route handler serveur) : rate limiting par IP/email
  // AVANT l'appel Supabase, puis pose de la session via setSession.
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, captchaToken }),
  });
  const payload = (await res.json().catch(() => null)) as {
    error?: string;
    access_token?: string;
    refresh_token?: string;
    retryAfter?: number;
  } | null;

  if (!res.ok || !payload?.access_token || !payload.refresh_token) {
    if (res.status === 429) {
      throw new ApiError(
        429,
        'Trop de tentatives de connexion. Patientez quelques secondes avant de réessayer.',
      );
    }
    throw new ApiError(res.status, payload?.error ?? `Erreur ${res.status}`);
  }

  const { error } = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  });
  if (error) throw new ApiError(400, error.message);
}

export async function signUp(
  input: {
    email: string;
    password: string;
    full_name: string;
    phone: string;
    role: 'locataire' | 'bailleur';
    consent_apdp: boolean;
  },
  captchaToken: string,
): Promise<{ needsEmailConfirmation: boolean }> {
  assertBeninPhone(input.phone);
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      captchaToken,
      // Métadonnées lues par le trigger handle_new_user (migration 014) qui
      // initialise le profil (nom, téléphone, rôle, consentement) AVANT toute
      // connexion. Aucun appel RLS ici : avec confirmation email active la
      // session est null juste après signUp et upsert/set_my_role échoueraient.
      data: {
        full_name: input.full_name,
        phone: input.phone,
        role: input.role,
        consent_apdp: input.consent_apdp,
      },
    },
  });
  if (error) throw new ApiError(400, error.message);
  if (!data.user) throw new ApiError(400, 'Inscription impossible');

  // data.session === null → la confirmation email est requise (production).
  return { needsEmailConfirmation: !data.session };
}

export async function requestOtp(phone: string, captchaToken: string): Promise<void> {
  assertBeninPhone(phone);
  const { error } = await supabase.auth.signInWithOtp({ phone, options: { captchaToken } });
  if (error) throw new ApiError(400, error.message);
}

export async function verifyOtp(phone: string, token: string, captchaToken: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
    options: { captchaToken },
  });
  if (error) throw new ApiError(400, error.message);
}

/** Envoie un email de réinitialisation de mot de passe (lien unique + court). */
export async function requestPasswordReset(
  email: string,
  captchaToken: string,
  redirectTo?: string,
): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    captchaToken,
    redirectTo: redirectTo ?? '/reset-password',
  });
  if (error) throw new ApiError(400, error.message);
}

/** Enregistre le nouveau mot de passe après avoir suivi le lien de réinitialisation. */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new ApiError(400, error.message);
}

// ------------------------------------------------------------
// Profil
// ------------------------------------------------------------
export async function getMyProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw normalizeError(error, 'Profil introuvable');
  return data;
}

export async function updateProfile(patch: { full_name?: string; phone?: string }): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id);
  if (error) throw normalizeError(error, 'Mise à jour impossible');
}

// ------------------------------------------------------------
// Recherche & biens
// ------------------------------------------------------------
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
  const { data: { user } } = await supabase.auth.getUser();
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
      { headers: { Accept: 'application/json', 'User-Agent': 'KazaBJ/1.0 (contact@kaza.bj)' } },
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError(401, 'Connectez-vous pour créer un bien');

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

// ------------------------------------------------------------
// Favoris
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Messagerie
// ------------------------------------------------------------
export async function openConversation(residenceId: string): Promise<string> {
  const { data, error } = await supabase.rpc('open_conversation', {
    p_residence_id: residenceId,
  });
  if (error) throw normalizeError(error, 'Ouverture de la conversation impossible');
  return data as string;
}

export async function listMyConversations(): Promise<ConversationWithRelations[]> {
  const { data, error } = await supabase.rpc('list_my_conversations');
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as unknown as ConversationWithRelations[];
}

export async function getConversation(id: string): Promise<ConversationWithRelations | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw normalizeError(error, 'Conversation introuvable');
  return data as ConversationWithRelations | null;
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as Message[];
}

export async function sendMessage(
  conversationId: string,
  input: { body: string | null; kind?: Message['kind']; attachments?: string[] },
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError(401, 'Connectez-vous pour envoyer un message');
  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body: input.body,
    kind: input.kind ?? 'text',
    attachments: input.attachments ?? [],
  });
  if (error) throw normalizeError(error, 'Envoi impossible');
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', user.id)
    .is('read_at', null);
}

export async function agreeVisit(
  conversationId: string,
  agreed: boolean,
  note = '',
): Promise<void> {
  const { error } = await supabase.rpc('agree_visit', {
    p_conversation_id: conversationId,
    p_agreed: agreed,
    p_note: note,
  });
  if (error) throw normalizeError(error, 'Action impossible');
}

// ------------------------------------------------------------
// Baux
// ------------------------------------------------------------
export async function listMyLeases(): Promise<LeaseWithRelations[]> {
  const { data, error } = await supabase.rpc('list_my_leases');
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as unknown as LeaseWithRelations[];
}

export async function createLease(input: {
  residence_id: string;
  tenant_id: string;
  start_date: string;
  end_date?: string;
  monthly_rent: number;
  deposit: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_lease', {
    p_residence_id: input.residence_id,
    p_tenant_id: input.tenant_id,
    p_start_date: input.start_date,
    p_end_date: input.end_date ?? null,
    p_monthly_rent: input.monthly_rent,
    p_deposit: input.deposit,
  });
  if (error) throw normalizeError(error, 'Bail impossible');
  return data as string;
}

export async function terminateLease(leaseId: string): Promise<void> {
  const { error } = await supabase.rpc('terminate_lease', { p_lease_id: leaseId });
  if (error) throw normalizeError(error, 'Clôture impossible');
}

export async function listTenants(): Promise<Profile[]> {
  const { data, error } = await supabase.rpc('list_tenants');
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as unknown as Profile[];
}

// ------------------------------------------------------------
// Paiements & quittances
// ------------------------------------------------------------
export async function listMyPayments(): Promise<PaymentWithRelations[]> {
  const { data, error } = await supabase.rpc('list_my_payments');
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as unknown as PaymentWithRelations[];
}

export async function listMyReceipts(): Promise<ReceiptWithRelations[]> {
  const { data, error } = await supabase.rpc('list_my_receipts');
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as unknown as ReceiptWithRelations[];
}

export async function reportCashPayment(input: {
  lease_id: string;
  amount: number;
  period_start: string;
  period_end: string;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError(401, 'Connectez-vous pour payer');
  const { data: lease, error: leaseErr } = await supabase
    .from('leases')
    .select('landlord_id')
    .eq('id', input.lease_id)
    .single();
  if (leaseErr || !lease) throw new ApiError(400, 'Bail introuvable');
  const { error } = await supabase.from('payments').insert({
    lease_id: input.lease_id,
    tenant_id: user.id,
    landlord_id: lease.landlord_id,
    amount: input.amount,
    period_start: input.period_start,
    period_end: input.period_end,
    method: 'cash',
    provider: 'cash',
    status: 'pending',
  });
  if (error) throw normalizeError(error, 'Signalement impossible');
}

export interface FedapayInitResult {
  payment_id: string;
  payment_token: string;
  payment_url: string;
  amount: number;
  period_start: string;
  period_end: string;
}

export async function initFedapayPayment(
  leaseId: string,
  channel: string,
  phone?: string,
  months: number = 1,
): Promise<FedapayInitResult> {
  return callFunction<FedapayInitResult>('fedapay-init', { lease_id: leaseId, channel, phone, months });
}

export async function confirmPayment(paymentId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('payments')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      confirmed_by: user.id,
    })
    .eq('id', paymentId);
  if (error) throw normalizeError(error, 'Validation impossible');
}

export async function rejectPayment(paymentId: string): Promise<void> {
  const { error } = await supabase
    .from('payments')
    .update({ status: 'rejected' })
    .eq('id', paymentId);
  if (error) throw normalizeError(error, 'Rejet impossible');
}

export interface SignReceiptResult {
  receipt_id: string;
  file_url: string;
  signature_hash: string;
  signed_at: string;
}

export async function signReceipt(receiptId: string): Promise<SignReceiptResult> {
  return callFunction<SignReceiptResult>('receipts-sign', { receipt_id: receiptId });
}

// ------------------------------------------------------------
// Avis & notations (locataires après bail)
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Stockage sécurisé (URLs signées pour les buckets privés)
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Notifications
// ------------------------------------------------------------
export async function listNotifications(limit = 30): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as AppNotification[];
}

export async function unreadNotificationsCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) return 0;
  return count ?? 0;
}

export async function markAllNotificationsRead(): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);
}

// ------------------------------------------------------------
// Compte (RGPD)
// ------------------------------------------------------------
export interface AccountPurgeResult {
  removed_count: number;
  removed: string[];
}

export async function deleteMyAccount(): Promise<AccountPurgeResult> {
  // account-purge supprime d'abord les fichiers Storage (photos, PJ, quittances),
  // puis appelle delete_my_account() côté service role (purge RGPD complète).
  return callFunction<AccountPurgeResult>('account-purge', {});
}

// ------------------------------------------------------------
// Administration
// ------------------------------------------------------------
export interface AdminStats {
  users: { total: number; by_role: Record<string, number> };
  residences: { total: number; by_status: Record<string, number> };
  leases: { total: number };
  payments: { confirmed_count: number; total_collected_xof: number };
}

export async function adminStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('admin_stats');
  if (error) throw normalizeError(error, 'Statistiques indisponibles');
  return data as unknown as AdminStats;
}

export async function adminListResidences(limit = 30): Promise<Residence[]> {
  const { data, error } = await supabase
    .from('residences')
    .select('*, owner:profiles(id, full_name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as Residence[];
}

export async function adminListUsers(limit = 30): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as Profile[];
}

export async function adminVerifyResidence(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_verify_residence', { p_residence_id: id });
  if (error) throw normalizeError(error, 'Action impossible');
}

export async function adminUnpublishResidence(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_unpublish_residence', { p_residence_id: id });
  if (error) throw normalizeError(error, 'Action impossible');
}

export async function adminSetPremium(userId: string, isPremium: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_premium', { p_user_id: userId, p_is_premium: isPremium });
  if (error) throw normalizeError(error, 'Action impossible');
}

export async function adminToggleRole(userId: string, role: Profile['role']): Promise<void> {
  const { error } = await supabase.rpc('admin_toggle_role', { p_user_id: userId, p_role: role });
  if (error) throw normalizeError(error, 'Action impossible');
}

/** Modération avec motif : 'approve' | 'reject'. Notifie le bailleur. */
export async function adminModerateResidence(id: string, action: 'approve' | 'reject', reason = ''): Promise<void> {
  const { error } = await supabase.rpc('admin_moderate_residence', {
    p_residence_id: id,
    p_action: action,
    p_reason: reason,
  });
  if (error) throw normalizeError(error, 'Action impossible');
}

/** Badge « bailleur vérifié » accordé/retiré par l'admin. */
export async function adminSetLandlordVerified(userId: string, verified: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_landlord_verified', {
    p_user_id: userId,
    p_verified: verified,
  });
  if (error) throw normalizeError(error, 'Action impossible');
}
