import { NextResponse, type NextRequest } from 'next/server';
import { checkLoginAttempts } from '@/lib/login-rate-limit';
import { env } from '@/lib/env';
import { logger, getRequestId } from '@/lib/logger';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getClientIp(req: NextRequest): string {
  const fwd =
    req.headers.get('x-vercel-forwarded-for') ??
    req.headers.get('x-forwarded-for') ??
    req.headers.get('x-real-ip') ??
    '';
  const first = (fwd.split(',')[0] ?? '').trim();
  return first || 'unknown';
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req.headers);
  const start = Date.now();

  const body = (await req.json().catch(() => null)) as
    | { email?: string; password?: string; captchaToken?: string }
    | null;
  const email = (body?.email ?? '').trim().toLowerCase();
  const password = body?.password ?? '';
  const captchaToken = body?.captchaToken ?? '';

  if (!email || !EMAIL_RE.test(email) || !password) {
    logger.warn('login_validation_failed', { requestId, message: 'Invalid email/password format', metadata: { email } });
    return NextResponse.json({ error: 'Email ou mot de passe invalide' }, { status: 400 });
  }

  const captchaRequired = Boolean(env.hcaptchaSitekey);
  if (captchaRequired && !captchaToken) {
    logger.warn('login_captcha_missing', { requestId, message: 'hCaptcha token required', metadata: { email } });
    return NextResponse.json(
      { error: 'Vérification anti-robot requise (hCaptcha)' },
      { status: 400 },
    );
  }

  const limit = checkLoginAttempts({ email, ip: getClientIp(req) });
  if (!limit.allowed) {
    logger.warn('login_rate_limited', { requestId, message: 'Rate limit exceeded', metadata: { email, retry_after: limit.retryAfterSeconds } });
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

  const supabaseUrl = env.supabaseUrl;
  const anonKey = env.supabaseAnonKey;
  if (!supabaseUrl || !anonKey) {
    logger.error('login_config_missing', { requestId, message: 'Supabase URL or anon key not configured' });
    return NextResponse.json({ error: 'Configuration serveur incomplète' }, { status: 503 });
  }

  try {
    const target = `${supabaseUrl}/auth/v1/token?grant_type=password`;
    const res = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        email,
        password,
        ...(captchaToken ? { gotrue_meta_security: { captcha_token: captchaToken } } : {}),
      }),
    });
    const text = await res.text();
    const payload = (() => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    })() as {
      access_token?: string;
      refresh_token?: string;
      user?: unknown;
      error?: string;
      error_description?: string;
      msg?: string;
    } | null;

    if (!res.ok || !payload?.access_token) {
      const raw = payload?.error_description ?? payload?.msg ?? payload?.error ?? `Erreur ${res.status}`;
      const message = /invalid login credentials|invalid_credentials/i.test(raw)
        ? 'Identifiants invalides. Vérifiez votre e-mail et votre mot de passe.'
        : raw;
      logger.warn('login_failed', { requestId, message: message, metadata: { email, status: res.status } });
      return NextResponse.json({ error: message }, { status: res.status === 400 ? 400 : res.status });
    }

    logger.info('login_success', { requestId, metadata: { email, duration_ms: Date.now() - start } });
    return NextResponse.json({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      user: payload.user,
    });
  } catch (err) {
    logger.error('login_error', { requestId, error: err as Error, metadata: { email, duration_ms: Date.now() - start }, message: 'Service unavailable' });
    return NextResponse.json({ error: 'Service de connexion indisponible' }, { status: 502 });
  }
}