import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit;
  const url = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;
  if (!url || !token) return null;
  try {
    const redis = new Redis({ url, token });
    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '60 s'),
      analytics: true,
      prefix: 'kaza:ratelimit',
    });
    return ratelimit;
  } catch {
    return null;
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
  reset: number;
}

const MEMORY_BUCKETS = new Map<string, { count: number; resetAt: number }>();
const MAX_MEMORY_BUCKETS = 20_000;

function memoryPrune(now: number): void {
  for (const [key, b] of MEMORY_BUCKETS) {
    if (b.resetAt <= now) MEMORY_BUCKETS.delete(key);
  }
  if (MEMORY_BUCKETS.size > MAX_MEMORY_BUCKETS) MEMORY_BUCKETS.clear();
}

function memoryCheckLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  now: number = Date.now(),
): RateLimitResult {
  memoryPrune(now);
  const bucket = MEMORY_BUCKETS.get(key);
  if (!bucket || bucket.resetAt <= now) {
    MEMORY_BUCKETS.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, retryAfterSeconds: 0, remaining: limit - 1, reset: now + windowSeconds * 1000 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      remaining: 0,
      reset: bucket.resetAt,
    };
  }
  return { allowed: true, retryAfterSeconds: 0, remaining: limit - bucket.count, reset: bucket.resetAt };
}

const EMAIL_LIMIT = 5;
const EMAIL_WINDOW = 60;
const IP_LIMIT = 20;
const IP_WINDOW = 60;

export async function checkLoginAttempts(opts: { email: string; ip: string }): Promise<RateLimitResult> {
  const rl = getRatelimit();
  if (rl) {
    const byEmail = await rl.limit(`login:email:${opts.email.toLowerCase()}`);
    if (!byEmail.success) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((byEmail.reset - Date.now()) / 1000)),
        remaining: byEmail.remaining,
        reset: byEmail.reset,
      };
    }
    const byIp = await rl.limit(`login:ip:${opts.ip}`);
    if (!byIp.success) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((byIp.reset - Date.now()) / 1000)),
        remaining: byIp.remaining,
        reset: byIp.reset,
      };
    }
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: Math.min(byEmail.remaining, byIp.remaining),
      reset: Math.max(byEmail.reset, byIp.reset),
    };
  }
  const be = memoryCheckLimit(`login:email:${opts.email.toLowerCase()}`, EMAIL_LIMIT, EMAIL_WINDOW);
  if (!be.allowed) return be;
  return memoryCheckLimit(`login:ip:${opts.ip}`, IP_LIMIT, IP_WINDOW);
}

export function isRatelimitEnabled(): boolean {
  return getRatelimit() !== null;
}
