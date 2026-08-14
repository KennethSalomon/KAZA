import { getAdminClient } from '../_shared/db.ts';
import {
  sendEmail,
  reminderDueIn3Days,
  reminderOverdueJ1,
  reminderOverdueJ7,
} from '../_shared/brevo.ts';
import { isJ7, notificationBody, notificationTitle, landlordAlertBody } from '../_shared/overdue-tiers.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET');
if (!CRON_SECRET) throw new Error('CRON_SECRET non défini');
const APP_URL = Deno.env.get('APP_URL');
if (!APP_URL) throw new Error('APP_URL non défini');

// Comparaison à temps constant (pas de fuite de longueur/timing)
function secretMatches(header: string | null): boolean {
  if (!header || header.length !== CRON_SECRET.length) return false;
  const a = new TextEncoder().encode(header);
  const b = new TextEncoder().encode(CRON_SECRET);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

interface OverdueLease {
  lease_id: string;
  tenant_id: string;
  landlord_id: string;
  residence_id: string;
  tenant_email: string | null;
  landlord_email: string | null;
  tenant_name: string;
  landlord_name: string;
  monthly_rent: number;
  days_overdue: number;
}

interface UpcomingDue {
  lease_id: string;
  tenant_id: string;
  landlord_id: string;
  monthly_rent: number;
  due_on: string;
}

const DAYS_7 = 1000 * 60 * 60 * 24 * 7;
const EMAIL_DEDUP_DAYS_MS = 7 * 24 * 3600 * 1000;

function hasRecentReminder(
  leaseId: string,
  recipientId: string,
  recent: { lease_id: string; user_id: string; created_at: string }[],
): boolean {
  const cutoff = new Date(Date.now() - DAYS_7).toISOString();
  return recent.some(
    (n) =>
      n.lease_id === leaseId &&
      n.user_id === recipientId &&
      n.created_at >= cutoff,
  );
}

async function notify(
  userId: string,
  title: string,
  body: string,
  leaseId: string,
): Promise<void> {
  const supabase = getAdminClient();
  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'overdue',
    title,
    body,
    data: { lease_id: leaseId },
  });
}

/**
 * CRON quotidien de gestion des impayés :
 *  - J-3 : rappel amiable aux locataires dont l'échéance approche
 *  - J+1 : notification + email de retard
 *  - J+7 : notification + email de relance (bailleur informé)
 * Protégé par l'en-tête x-cron-secret (planification via pg_cron + net.http_post).
 */
Deno.serve(async (req: Request) => {
  if (!secretMatches(req.headers.get('x-cron-secret'))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = getAdminClient();
  const report = { upcoming: 0, overdue_j1: 0, overdue_j7: 0, emails: 0, errors: 0 };

  // Rappels récents (déduplication sur 7 jours)
  const { data: recent } = await supabase
    .from('notifications')
    .select('user_id, data, created_at')
    .eq('type', 'overdue')
    .gte('created_at', new Date(Date.now() - DAYS_7).toISOString());
  const recentList = (recent ?? []).map((n) => ({
    lease_id: String((n.data as { lease_id?: string } | null)?.lease_id ?? ''),
    user_id: String(n.user_id),
    created_at: String(n.created_at),
  }));

  // J-3 : échéances dans 3 jours
  const { data: upcoming } = await supabase.rpc('list_upcoming_due', { days: 3 });
  for (const u of (upcoming ?? []) as unknown as UpcomingDue[]) {
    try {
      if (hasRecentReminder(u.lease_id, u.tenant_id, recentList)) continue;
      const facts = { tier: 'due_j3' as const, daysOverdue: 0, monthlyRent: Number(u.monthly_rent), dueOn: u.due_on };
      await notify(u.tenant_id, notificationTitle(facts), notificationBody(facts), u.lease_id);
      report.upcoming++;
      // Email dédupliqué sur 7 jours (sinon : un échec Brevo = 21 mails
      // pour un impayé qui dure 3 semaines — spam + réputation expéditeur).
      if (!hasRecentReminder(u.lease_id, u.tenant_id, recentList)) {
        const { data: p } = await supabase.from('profiles').select('full_name, email').eq('id', u.tenant_id).maybeSingle();
        if (p?.email) {
          const mail = reminderDueIn3Days(p.full_name ?? 'Locataire', facts.monthlyRent, u.due_on, APP_URL);
          if (await sendEmail({ ...mail, to: p.email, html: mail.html.replace('Bonjour Locataire', `Bonjour ${p.full_name}`) })) {
            report.emails++;
          }
        }
      }
    } catch (e) {
      report.errors++;
      console.error('Échec rappel J-3', u.lease_id, e);
    }
  }

  // J+1 et J+7 : impayés
  const { data: overdue } = await supabase.rpc('list_overdue_leases');
  for (const o of (overdue ?? []) as unknown as OverdueLease[]) {
    try {
      const j7 = isJ7(o.days_overdue);
      const facts = {
        tier: (j7 ? 'overdue_j7' : 'overdue_j1') as 'overdue_j1' | 'overdue_j7',
        daysOverdue: o.days_overdue,
        monthlyRent: Number(o.monthly_rent),
      };
      if (!hasRecentReminder(o.lease_id, o.tenant_id, recentList)) {
        await notify(o.tenant_id, notificationTitle(facts), notificationBody(facts), o.lease_id);
        if (j7) report.overdue_j7++;
        else report.overdue_j1++;
      }
      if (j7 && !hasRecentReminder(o.lease_id, o.landlord_id, recentList)) {
        await notify(o.landlord_id, 'Impayé — relance locataire', landlordAlertBody(o.tenant_name, facts), o.lease_id);
      }

      const mail =
        j7 && o.tenant_email
          ? reminderOverdueJ7('Locataire', facts.monthlyRent, o.days_overdue, APP_URL)
          : reminderOverdueJ1('Locataire', facts.monthlyRent, o.days_overdue, APP_URL);
      if (o.tenant_email) {
        const html = mail.html.replace('Bonjour Locataire', `Bonjour ${o.tenant_name}`);
        if (await sendEmail({ ...mail, to: o.tenant_email, html })) report.emails++;
      }
    } catch (e) {
      report.errors++;
      console.error('Échec rappel impayé', o.lease_id, e);
    }
  }

  return new Response(JSON.stringify(report), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});