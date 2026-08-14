// ============================================================
// FedaPay — utilitaires partagés (Edge Functions Deno)
// ============================================================
// Vérification de la signature des webhooks (algorithme officiel
// de la lib fedapay-node) :
//   En-tête : X-FEDAPAY-SIGNATURE = t=<timestamp>,s=<signature>
//   signature = hex( HMAC-SHA256( secret, `${timestamp}.${payload}` ) )
// Tolérance anti-rejeu : 5 minutes (recommandation officielle).
// ============================================================

export const FEDAPAY_SIGNATURE_TOLERANCE_SECONDS = 300;

function secureCompare(a: string, b: string): boolean {
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

export async function verifyFedapaySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader) return false;

  let timestamp = -1;
  const signatures: string[] = [];
  for (const part of signatureHeader.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq);
    const v = part.slice(eq + 1);
    if (k === 't') timestamp = parseInt(v, 10);
    else if (k === 's') signatures.push(v);
  }
  if (timestamp === -1 || signatures.length === 0) return false;

  // Anti-rejeu : le timestamp doit être proche de l'heure courante, dans les
  // DEUX sens (un timestamp futur = skew d'horloge ou rejeu dans le futur).
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > FEDAPAY_SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return signatures.some((sig) => secureCompare(sig, expected));
}

/** Désenglobe la réponse FedaPay (certains endpoints renvoient l'objet
 *  sous une clé nommée d'après la route, ex. "v1/transactions"). */
export function unwrapFedapay<T>(payload: unknown): T {
  const p = payload as Record<string, unknown> | null;
  if (!p || typeof p !== 'object') return payload as T;
  if (p.data && typeof p.data === 'object') return p.data as T;
  const routeKey = Object.keys(p).find((k) => k.startsWith('v1/'));
  if (routeKey) return (p[routeKey] as T) ?? (payload as T);
  return payload as T;
}
