// Rate limiter de connexion — fenêtre glissante en mémoire.
// Les limites sont souples (mémoire du runtime serverless) ; le vrai
// bouclier anti-brute-force reste le rate limiting natif de Supabase Auth.
// Ici on offre surtout un verrouillage UX clair (429 + Retry-After).

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 20_000;

function prune(now: number): void {
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size > MAX_BUCKETS) buckets.clear();
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  now: number = Date.now(),
): RateLimitResult {
  prune(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

const EMAIL_LIMIT = 5;
const EMAIL_WINDOW = 60;
const IP_LIMIT = 20;
const IP_WINDOW = 60;

export function checkLoginAttempts(opts: { email: string; ip: string }): RateLimitResult {
  const byEmail = checkRateLimit(`login:email:${opts.email.toLowerCase()}`, EMAIL_LIMIT, EMAIL_WINDOW);
  if (!byEmail.allowed) return byEmail;
  return checkRateLimit(`login:ip:${opts.ip}`, IP_LIMIT, IP_WINDOW);
}
