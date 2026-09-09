import { verifyFedapaySignature } from '../_shared/fedapay.ts';
import { getAdminClient } from '../_shared/db.ts';
import { rateLimit, clientIp } from '../_shared/rate-limit.ts';
import { initSentry, captureError } from '../_shared/sentry.ts';

initSentry();

// Mapping EXACT des événements FedaPay (la sous-chaîne `includes()` était
// fragile : un futur `refund.approved` aurait été traité comme une
// confirmation de loyer).
const FINAL_EVENTS: Record<string, 'confirmed' | 'rejected'> = {
  'transaction.approved': 'confirmed',
  'transaction.declined': 'rejected',
  'transaction.canceled': 'rejected',
};

/**
 * Webhook FedaPay (appelé par FedaPay — pas de JWT).
 *  - POST  : événement signé (X-FEDAPAY-SIGNATURE, HMAC-SHA256) ;
 *    confirme/rejette le paiement selon l'événement reçu.
 *  - GET   : retour navigateur depuis la page de paiement FedaPay
 *    (callback_url) → redirige vers le dashboard.
 * Les triggers DB génèrent la quittance, étendent la couverture et notifient.
 * Répond toujours rapidement pour stopper les relances.
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'GET') {
    const appUrl = Deno.env.get('APP_URL');
    if (!appUrl) return new Response('Webhook not configured', { status: 503 });
    // Retour navigateur depuis la page de paiement FedaPay.
    // FedaPay redirige vers callback_url avec ?id=<tx>&status=<approved|canceled|…>
    const url = new URL(req.url);
    const status = url.searchParams.get('status') ?? '';
    const query = status ? `?payment=${encodeURIComponent(status)}` : '';
    return new Response(null, {
      status: 302,
      headers: { Location: `${appUrl}/dashboard${query}` },
    });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secret = Deno.env.get('FEDAPAY_WEBHOOK_SECRET');
  if (!secret) {
    return new Response('FedaPay webhook not configured', { status: 503 });
  }

  try {
    // 1) Signature HMAC TOUJOURS en premier : le rate limiting ci-dessous est
    //    par IP (header x-forwarded-for contrôlable) — le limiter avant la
    //    vérification permettrait à un attaquant d'épuiser le quota de la
    //    vraie IP de FedaPay et de faire perdre les confirmations réelles.
    const raw = await req.text();
    const sig = req.headers.get('X-FedaPay-Signature');
    const valid = await verifyFedapaySignature(raw, sig, secret);
    if (!valid) {
      // Rate limit ciblé sur les SEULS échecs de signature (anti-brute-force,
      // sans jamais bloquer le trafic légitime de FedaPay).
      if (!(await rateLimit(`webhook-fail:${clientIp(req)}`, 30, 60))) {
        return new Response('Too many requests', { status: 429 });
      }
      console.error('Signature FedaPay invalide');
      return new Response('Invalid signature', { status: 401 });
    }

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const eventName: string = typeof event.name === 'string' ? event.name : (event.type as string) ?? '';
    // La transaction est dans event.data.object (format officiel FedaPay).
    const inner = (event.data ?? event.object) as Record<string, unknown> | null;
    const tx = (inner?.object ?? inner) as Record<string, unknown> | null;
    const txId = tx?.id ?? tx?.transaction_id ?? null;
    if (txId === null || txId === undefined) {
      return new Response('Missing transaction id', { status: 400 });
    }

    const status: 'confirmed' | 'rejected' | null = FINAL_EVENTS[eventName] ?? null;
    if (!status) {
      // Événement non final (created, transferred…) : on acquitte sans agir.
      return new Response('OK (event ignored)', { status: 200 });
    }

    const supabase = getAdminClient();
    const { data: payment, error: findErr } = await supabase
      .from('payments')
      .select('id, status, amount')
      .eq('provider_ref', String(txId))
      .maybeSingle();
    if (findErr || !payment) {
      console.error('Paiement introuvable pour la transaction', txId);
      return new Response('Payment not found', { status: 404 });
    }
    if (payment.status !== 'pending') {
      return new Response('OK (already processed)', { status: 200 });
    }

    // Le montant annoncé par FedaPay doit correspondre exactement à l'échéance.
    const amountOk = Number(tx?.amount) === Number(payment.amount);
    const finalStatus = status === 'confirmed' && !amountOk ? 'rejected' : status;

    const update: Record<string, unknown> =
      finalStatus === 'confirmed'
        ? { status: 'confirmed', confirmed_at: new Date().toISOString(), checkout_url: null }
        : { status: 'rejected', checkout_url: null };

    // Update atomique : ne passe que si le paiement est encore 'pending'
    // (idempotence stricte contre les événements concurrents).
    const { data: updated, error: updErr } = await supabase
      .from('payments')
      .update(update)
      .eq('id', payment.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (updErr) {
      console.error('Échec mise à jour paiement', updErr.message);
      return new Response('Update failed', { status: 500 });
    }
    if (!updated) {
      return new Response('OK (already processed)', { status: 200 });
    }

    if (status === 'confirmed' && !amountOk) {
      console.warn(
        `Incohérence montant — transaction ${txId} : attendu ${payment.amount} XOF, reçu ${tx?.amount}`,
      );
    }
    console.log(
      `Paiement ${finalStatus} — transaction ${txId} (${tx?.amount ?? '?'} XOF, événement ${eventName})`,
    );
    return new Response('OK', { status: 200 });
  } catch (err) {
    captureError(err, { function: 'fedapay-webhook' });
    console.error('Erreur webhook FedaPay', err);
    return new Response('Internal error', { status: 500 });
  }
});
