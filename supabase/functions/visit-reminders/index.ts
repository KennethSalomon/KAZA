import { getAdminClient } from '../_shared/db.ts';
import { initSentry, captureError } from '../_shared/sentry.ts';

initSentry();

async function getCronSecret(): Promise<string> {
  // 1. Environment variable (preferred for Supabase Cloud Edge Functions)
  const envSecret = Deno.env.get('CRON_SECRET');
  if (envSecret) return envSecret;

  // 2. Database fallback (for pg_cron jobs that can't set env vars)
  const supabase = getAdminClient();
  const { data } = await supabase
    .from('_cron_secrets')
    .select('secret')
    .eq('name', 'visit-reminders')
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

interface Visit {
  id: string;
  conversation_id: string;
  slot_start: string;
  proposed_by: string;
  confirmed_by: string | null;
}

const DAYS_7 = 1000 * 60 * 60 * 24 * 7;

function hasRecentReminder(
  visitId: string,
  recipientId: string,
  recent: { data: { visit_id?: string } | null; user_id: string; created_at: string }[],
): boolean {
  const cutoff = new Date(Date.now() - DAYS_7).toISOString();
  return recent.some(
    (n) =>
      (n.data as { visit_id?: string } | null)?.visit_id === visitId &&
      n.user_id === recipientId &&
      n.created_at >= cutoff,
  );
}

async function notify(
  userId: string,
  title: string,
  body: string,
  visitId: string,
  conversationId: string,
): Promise<void> {
  const supabase = getAdminClient();
  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'visit',
    title,
    body,
    data: { visit_id: visitId, conversation_id: conversationId },
  });
}

/**
 * CRON de rappels de visite :
 *  - J-1 (24h) : rappel aux deux parties
 *  - J-0 (2h) : rappel aux deux parties
 * Protégé par l'en-tête x-cron-secret (planification via pg_cron + net.http_post).
 */
Deno.serve(async (req: Request) => {
  const cronSecret = await getCronSecret();
  if (!secretMatches(req.headers.get('x-cron-secret'), cronSecret)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = getAdminClient();
  const report = { visits24h: 0, visits2h: 0, notifications: 0, errors: 0 };

  // Rappels récents (déduplication sur 7 jours)
  const { data: recent } = await supabase
    .from('notifications')
    .select('user_id, data, created_at')
    .eq('type', 'visit')
    .gte('created_at', new Date(Date.now() - DAYS_7).toISOString());
  const recentList = (recent ?? []).map((n) => ({
    data: n.data as { visit_id?: string } | null,
    user_id: String(n.user_id),
    created_at: String(n.created_at),
  }));

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  // Visites confirmées dans 24h (± 1h) ou 2h (± 15min)
  const { data: visits24h } = await supabase
    .from('visits')
    .select('id, conversation_id, slot_start, proposed_by, confirmed_by')
    .eq('status', 'confirmed')
    .gte('slot_start', new Date(in24h.getTime() - 3600000).toISOString())
    .lte('slot_start', new Date(in24h.getTime() + 3600000).toISOString());

  const { data: visits2h } = await supabase
    .from('visits')
    .select('id, conversation_id, slot_start, proposed_by, confirmed_by')
    .eq('status', 'confirmed')
    .gte('slot_start', new Date(in2h.getTime() - 900000).toISOString())
    .lte('slot_start', new Date(in2h.getTime() + 900000).toISOString());

  const allVisits = [...(visits24h ?? []), ...(visits2h ?? [])];

  for (const v of allVisits) {
    try {
      const hoursLeft = Math.round((new Date(v.slot_start).getTime() - now.getTime()) / 3600000);
      const label = hoursLeft <= 2 ? '2 heures' : '24 heures';

      // Notif locataire (dédupliquée)
      if (!hasRecentReminder(v.id, v.proposed_by, recentList)) {
        await notify(
          v.proposed_by,
          `Rappel visite dans ${label}`,
          `Votre visite est prévue ${label}.`,
          v.id,
          v.conversation_id,
        );
        report.notifications++;
      }

      // Notif bailleur (dédupliquée)
      if (v.confirmed_by && !hasRecentReminder(v.id, v.confirmed_by, recentList)) {
        await notify(
          v.confirmed_by,
          `Rappel visite dans ${label}`,
          `Vous recevez un locataire ${label}.`,
          v.id,
          v.conversation_id,
        );
        report.notifications++;
      }

      if (hoursLeft <= 2) report.visits2h++;
      else report.visits24h++;
    } catch (e) {
      report.errors++;
      captureError(e, { function: 'visit-reminders', visit_id: v.id });
      console.error('Échec rappel visite', v.id, e);
    }
  }

  return new Response(JSON.stringify(report), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});