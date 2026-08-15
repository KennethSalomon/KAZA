import { NextResponse, type NextRequest } from 'next/server';
import { checkLoginAttempts } from '@/lib/login-rate-limit';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getClientIp(req: NextRequest): string {
  const fwd =
    req.headers.get('x-vercel-forwarded-for') ??
    req.headers.get('x-forwarded-for') ??
    req.headers.get('x-real-ip') ??
    '';
  const first = fwd.split(',')[0].trim();
  return first || 'unknown';
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null;
  const email = (body?.email ?? '').trim().toLowerCase();
  const password = body?.password ?? '';

  if (!email || !EMAIL_RE.test(email) || !password) {
    return NextResponse.json({ error: 'Email ou mot de passe invalide' }, { status: 400 });
  }

  // Verrouillage avant tout appel réseau : un spammeur ne consomme pas le
  // quota de connexion de Supabase et reçoit un message clair.
  const limit = checkLoginAttempts({ email, ip: getClientIp(req) });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: 'Trop de tentatives de connexion. Patientez quelques secondes avant de réessayer.',
        retryAfter: limit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfterSeconds) },
      },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Configuration serveur incomplète' }, { status: 503 });
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ email, password }),
    });
    const payload = (await res.json().catch(() => null)) as {
      access_token?: string;
      refresh_token?: string;
      user?: unknown;
      error?: string;
      error_description?: string;
      msg?: string;
    } | null;

    if (!res.ok || !payload?.access_token) {
      const message =
        payload?.error_description ?? payload?.msg ?? payload?.error ?? `Erreur ${res.status}`;
      return NextResponse.json({ error: message }, { status: res.status === 400 ? 400 : res.status });
    }

    return NextResponse.json({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      user: payload.user,
    });
  } catch {
    return NextResponse.json({ error: 'Service de connexion indisponible' }, { status: 502 });
  }
}
