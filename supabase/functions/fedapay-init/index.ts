import { handleOptions, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { getAdminClient } from '../_shared/db.ts';
import { unwrapFedapay } from '../_shared/fedapay.ts';
import { rateLimit } from '../_shared/rate-limit.ts';

// Sandbox : https://sandbox-api.fedapay.com/v1 (à utiliser en développement)
const FEDAPAY_API_BASE = Deno.env.get('FEDAPAY_API_BASE') ?? 'https://sandbox-api.fedapay.com/v1';
const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:3000';

if (!Deno.env.get('APP_URL')) {
  console.warn('APP_URL non défini — URL de retour FedaPay = localhost (DEV SEULEMENT)');
}

// Opérateurs mobile money Bénin supportés par FedaPay.
const MODES: Record<string, string> = {
  mtn: 'mtn_open',
  moov: 'moov',
  celtiis: 'sbin',
};

/**
 * Initialise un paiement FedaPay pour le loyer mensuel du locataire.
 *  - valide le bail et le montant (loyer mensuel exact)
 *  - enregistre le paiement (status pending, provider_ref = transaction FedaPay)
 *  - crée la transaction + le lien de paiement et les retourne
 */
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return handleOptions(req);
  if (req.method !== 'POST') return errorResponse('Méthode non autorisée', 405, origin);

  const secretKey = Deno.env.get('FEDAPAY_SECRET_KEY');
  if (!secretKey) return errorResponse('FedaPay non configuré', 503, origin);

  try {
    const user = await requireUser(req);

    if (!(await rateLimit(`fedapay-init:${user.id}`, 10, 60))) {
      return errorResponse('Trop de tentatives, réessayez dans une minute', 429, origin);
    }

    let parsed: { lease_id?: string; channel?: string; phone?: string };
    try {
      parsed = await req.json() as { lease_id?: string; channel?: string; phone?: string };
    } catch {
      return errorResponse('Corps JSON invalide', 400, origin);
    }
    const { lease_id, channel, phone } = parsed;
    if (!lease_id) return errorResponse('lease_id requis', 400, origin);

    const supabase = getAdminClient();

    const { data: lease, error: leaseErr } = await supabase
      .from('leases')
      .select('id, tenant_id, landlord_id, monthly_rent, date_fn_couverture, status, residences(id, title)')
      .eq('id', lease_id)
      .maybeSingle();
    if (leaseErr || !lease) return errorResponse('Bail introuvable', 404, origin);
    if (lease.tenant_id !== user.id) return errorResponse('Ce bail ne vous appartient pas', 403, origin);
    if (lease.status !== 'active') return errorResponse('Bail inactif', 400, origin);

    const mode = channel ? MODES[channel.toLowerCase()] : undefined;

    // Période suivante due : depuis date_fn_couverture sur un mois
    const start = new Date(`${lease.date_fn_couverture}T00:00:00Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(end.getUTCDate() - 1);
    const periodStart = start.toISOString().slice(0, 10);
    const periodEnd = end.toISOString().slice(0, 10);

    // Insertion du paiement AVANT l'appel provider (le paiement reste pending
    // jusqu'à confirmation du webhook FedaPay).
    const { data: payment, error: payErr } = await supabase
      .from('payments')
      .insert({
        lease_id: lease.id,
        tenant_id: lease.tenant_id,
        landlord_id: lease.landlord_id,
        amount: lease.monthly_rent,
        period_start: periodStart,
        period_end: periodEnd,
        method: 'mobile_money',
        provider: (channel?.toLowerCase() ?? 'mtn') as 'mtn' | 'moov' | 'celtiis',
        status: 'pending',
      })
      .select('id')
      .single();
    if (payErr || !payment) return errorResponse('Impossible d\'enregistrer le paiement', 500, origin);

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone, email')
      .eq('id', user.id)
      .maybeSingle();

    const amount = Number(lease.monthly_rent);
    const fullName = profile?.full_name?.trim() ?? '';
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fedapay-webhook`;

    // 1) Création de la transaction FedaPay
    const createBody: Record<string, unknown> = {
      description: `Loyer mensuel — ${lease.residences?.[0]?.title ?? 'KAZA.BJ'}`,
      amount,
      currency: { iso: 'XOF' },
      callback_url: callbackUrl,
      custom_metadata: { payment_id: payment.id },
    };
    if (mode) createBody.mode = mode;
    if (nameParts.length > 0) {
      const customer: Record<string, unknown> = {
        firstname: nameParts[0],
        lastname: nameParts.slice(1).join(' ') || 'KAZA',
        email: profile?.email ?? '',
      };
      const phoneNumber = (phone ?? profile?.phone ?? '').replace(/\s+/g, '');
      if (phoneNumber) customer.phone_number = { number: phoneNumber, country: 'bj' };
      createBody.customer = customer;
    }

    const createRes = await fetch(`${FEDAPAY_API_BASE}/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createBody),
    });
    const createPayload = await createRes.json().catch(() => null) as Record<string, unknown> | null;
    const tx = unwrapFedapay<{ id?: number | string; status?: string } | null>(createPayload);

    if (!createRes.ok || !tx?.id) {
      // Annulation silencieuse du paiement local
      await supabase.from('payments').update({ status: 'rejected' }).eq('id', payment.id);
      return jsonResponse(
        { error: 'Échec de la création de la transaction FedaPay' },
        502,
        origin,
      );
    }

    // 2) Génération du lien de paiement
    const tokenRes = await fetch(`${FEDAPAY_API_BASE}/transactions/${tx.id}/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });
    const tokenPayload = await tokenRes.json().catch(() => null) as Record<string, unknown> | null;
    const tokenData = unwrapFedapay<{ token?: string; url?: string } | null>(tokenPayload);

    if (!tokenRes.ok || !tokenData?.url) {
      await supabase.from('payments').update({ status: 'rejected' }).eq('id', payment.id);
      return jsonResponse({ error: 'Échec de la génération du lien de paiement FedaPay' }, 502, origin);
    }

    await supabase
      .from('payments')
      .update({ provider_ref: String(tx.id), checkout_url: tokenData.url })
      .eq('id', payment.id);

    return jsonResponse({
      payment_id: payment.id,
      payment_token: tokenData.token ?? '',
      payment_url: tokenData.url,
      amount,
      period_start: periodStart,
      period_end: periodEnd,
    }, 200, origin);
  } catch (err) {
    console.error('Erreur init paiement FedaPay', err);
    return errorResponse('Erreur interne', 500, origin);
  }
});
