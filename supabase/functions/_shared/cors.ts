// ============================================================
// CORS pour les Edge Functions KAZA — liste blanche d'origines.
// Le webhook FedaPay (serveur-à-serveur) n'envoie pas d'Origin ;
// seules les origines autorisées reçoivent Access-Control-Allow-Origin.
// ============================================================

const ALLOWED_ORIGINS = [
  'https://kaza.bj',
  'https://www.kaza.bj',
  'http://localhost:3000',
];

const BASE_HEADERS = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function allowedOrigin(origin: string | null): string | null {
  return origin && ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

export function corsHeadersFor(origin: string | null): Record<string, string> {
  const allow = allowedOrigin(origin);
  const headers: Record<string, string> = { ...BASE_HEADERS };
  if (allow) headers['Access-Control-Allow-Origin'] = allow;
  return headers;
}

/** Rétrocompatibilité : headers CORS par défaut (origine KAZA). */
export const corsHeaders = corsHeadersFor('https://kaza.bj');

export function handleOptions(req: Request): Response {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeadersFor(req.headers.get('origin')) });
  }
  return new Response('not allowed', { status: 405, headers: corsHeadersFor(req.headers.get('origin')) });
}

export function jsonResponse(body: unknown, status = 200, origin?: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(origin ?? null), 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status = 400, origin?: string | null): Response {
  return jsonResponse({ error: message }, status, origin);
}