import { getAdminClient } from '../_shared/db.ts';
import { initSentry, captureError } from '../_shared/sentry.ts';
import {
  buildExpoMessages,
  classifyExpoTickets,
  type ExpoPushTicket,
  type PendingPushNotification,
} from '../_shared/expo-push.ts';

initSentry();

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Limite de l'API Expo par requête.
const MAX_BATCH = 100;
// Au-delà, une notification non livrée est considérée comme obsolète
// et marquée traitée (évite une file infinie en cas d'échec persistant).
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// Timeout sur l'appel Expo : au-delà, on libère les claims et on retente.
const EXPO_TIMEOUT_MS = 25_000;

async function getCronSecret(): Promise<string> {
  // 1. Environnement (mode préféré pour Supabase Cloud Edge Functions)
  const envSecret = Deno.env.get('CRON_SECRET');
  if (envSecret) return envSecret;

  // 2. Table _cron_secrets (mode pg_cron : le job ne peut pas définir de vars d'env)
  const supabase = getAdminClient();
  const { data } = await supabase
    .from('_cron_secrets')
    .select('secret')
    .eq('name', 'push-emitter')
    .maybeSingle();
  if (data?.secret) return data.secret;

  throw new Error('CRON_SECRET non défini (ni dans les variables d\'environnement, ni dans la table _cron_secrets)');
}

function secretMatches(header: string | null, cronSecret: string): boolean {
  if (!header || header.length !== cronSecret.length) return false;
  const a = new TextEncoder().encode(header);
  const b = new TextEncoder().encode(cronSecret);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function completeBatch(ids: string[]): Promise<void> {
  // Livraison traitée : push_sent_at = now() et libération du claim.
  if (ids.length === 0) return;
  const supabase = getAdminClient();
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    await supabase
      .from('notifications')
      .update({ push_sent_at: new Date().toISOString(), push_claimed_at: null })
      .in('id', chunk);
  }
}

async function releaseClaims(ids: string[]): Promise<void> {
  // Échec transitoire : on libère le claim, push_sent_at reste NULL → retry au
  // prochain passage du cron. Pas de retry au sein de la même invocation.
  if (ids.length === 0) return;
  const supabase = getAdminClient();
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    await supabase
      .from('notifications')
      .update({ push_claimed_at: null })
      .in('id', chunk);
  }
}

/**
 * Émetteur push (Pass 4 — D2) : envoi cloud-to-device des notifications
 * applicatives via l'API Expo Push.
 *  - claim ATOMIQUE via l'RPC claim_push_batch (aucune course entre deux
 *    exécutions du cron : chaque notification n'est gagnée que par une invocation)
 *  - déduplique via notifications.push_sent_at
 *  - lease de 5 minutes pour récupérer les claims abandonnés
 *  - purge les jetons expirés (DeviceNotRegistered / jeton invalide)
 *  - erreurs permanentes traitées, erreurs transitoires retentées
 *  - s'exécute par pg_cron (comme overdue-cron / visit-reminders)
 * Protégé par l'en-tête x-cron-secret.
 */
Deno.serve(async (req: Request) => {
  const report = {
    scanned: 0,
    sent: 0,
    noToken: 0,
    permanent: 0,
    invalidTokensCleared: 0,
    retry: 0,
    errors: 0,
  };

  try {
    const cronSecret = await getCronSecret();
    if (!secretMatches(req.headers.get('x-cron-secret'), cronSecret)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const supabase = getAdminClient();
    const cutoff = new Date(Date.now() - MAX_AGE_MS).toISOString();
    const nowIso = new Date().toISOString();

    // 1. Nettoyage indépendant du niveau de charge : les notifications non
    // livrées de plus de 7 jours sont traitées (jamais envoyées), sans scan inutile.
    await supabase
      .from('notifications')
      .update({ push_sent_at: nowIso, push_claimed_at: null })
      .is('push_sent_at', null)
      .lt('created_at', cutoff);

    // 2. Claim atomique : l'RPC UPDATE ... RETURNING avec FOR UPDATE SKIP LOCKED
    // ne laisse chaque notification qu'à une seule invocation (même en cas de
    // chevauchement de cron). Lease = 5 min pour les invocations abandonnées.
    const { data: claimed } = await supabase.rpc('claim_push_batch', {
      p_batch_size: MAX_BATCH,
      p_lease_seconds: 300,
    });

    const notifications = (claimed ?? []) as unknown as PendingPushNotification[];
    report.scanned = notifications.length;

    if (notifications.length === 0) {
      return new Response(JSON.stringify(report), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Jetons de push par destinataire (uniquement pour les lignes gagnées).
    const userIds = [...new Set(notifications.map((n) => n.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, push_token')
      .in('id', userIds);

    const tokenByUserId = new Map<string, string>();
    for (const profile of profiles ?? []) {
      const token = profile.push_token;
      if (token) tokenByUserId.set(String(profile.id), String(token));
    }

    const { messages, noTokenIds } = buildExpoMessages(notifications, tokenByUserId);

    if (messages.length === 0) {
      await completeBatch(noTokenIds);
      report.noToken = noTokenIds.length;
      return new Response(JSON.stringify(report), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Envoi Expo avec timeout explicite (AbortController portable Deno).
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EXPO_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
        signal: controller.signal,
      });
    } catch (error) {
      // Réseau ou timeout (AbortError) : transitoire → libérer les claims,
      // ne PAS marquer comme envoyé, le prochain cron retente.
      await releaseClaims(notifications.map((n) => n.id));
      report.retry = notifications.length;
      report.errors++;
      captureError(error, { function: 'push-emitter', phase: 'fetch' });
      console.error('Échec réseau/timeout Expo Push', error);
      return new Response(JSON.stringify(report), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      // 5xx / 429 (transitoire) : on ne marque rien, on libère et on retente.
      await releaseClaims(notifications.map((n) => n.id));
      report.retry = notifications.length;
      report.errors++;
      return new Response(JSON.stringify(report), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let tickets: ExpoPushTicket[];
    try {
      const body = (await response.json()) as { data?: ExpoPushTicket[] };
      tickets = body.data ?? [];
    } catch (error) {
      // Réponse Expo inexploitable : transitoire → libérer, retenter plus tard.
      await releaseClaims(notifications.map((n) => n.id));
      report.retry = notifications.length;
      report.errors++;
      captureError(error, { function: 'push-emitter', phase: 'json' });
      return new Response(JSON.stringify(report), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { okIds, deviceNotRegisteredIds, permanentIds, retryIds, invalidTokens } = classifyExpoTickets(
      messages,
      tickets,
    );

    report.sent = okIds.length;
    report.noToken = noTokenIds.length;
    report.permanent = permanentIds.length;
    report.retry = retryIds.length;

    // 5. Marquage des notifications livrées / traitées (push_sent_at + release).
    await completeBatch([...okIds, ...deviceNotRegisteredIds, ...permanentIds, ...noTokenIds]);

    // 6. Libération des claims pour les erreurs transitoires (retry au prochain cron).
    await releaseClaims(retryIds);

    // 7. Purge des jetons d'appareils désenregistrés ou invalides.
    if (invalidTokens.length > 0) {
      const { data: cleared } = await supabase
        .from('profiles')
        .update({ push_token: null })
        .in('push_token', invalidTokens)
        // .select() requis : supabase-js v2 envoie Prefer: return=minimal par
        // défaut (données de retour typées null), et le compteur ci-dessous
        // dépend des lignes réellement mises à jour.
        .select('id');
      report.invalidTokensCleared = cleared?.length ?? 0;
    }

    if (permanentIds.length > 0) {
      captureError(new Error('Erreurs permanentes Expo Push'), {
        function: 'push-emitter',
        permanentIds,
        invalidTokens: invalidTokens.length,
      });
    }

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    report.errors++;
    captureError(error, { function: 'push-emitter', phase: 'global' });
    console.error('Échec émetteur push', error);
    return new Response(JSON.stringify(report), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});