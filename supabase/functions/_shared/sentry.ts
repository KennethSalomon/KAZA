import * as Sentry from 'npm:@sentry/deno@8';

const SENTRY_DSN = Deno.env.get('SENTRY_DSN');

export function initSentry(): void {
  if (!SENTRY_DSN) return;
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: Deno.env.get('SUPABASE_ENV') ?? 'production',
    tracesSampleRate: 0.1,
  });
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!SENTRY_DSN) return;
  Sentry.captureException(err, { extra: context });
}

export { Sentry };
