// ============================================================
// Rate limiting partagé pour les Edge Functions KAZA
// Utilise le KV intégré au Supabase Edge Runtime (Kiwi) quand il
// est disponible ; sinon repli sur un compteur en mémoire
// (limite douce par instance — acceptable en défense en profondeur).
// ============================================================

interface KvLike {
  incr: (key: string, opts?: { returnValue?: boolean }) => Promise<{ value?: number }>;
  expire: (key: string, seconds: number) => Promise<unknown>;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

const memory = new Map<string, WindowEntry>();

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const kv = (globalThis as unknown as { kv?: KvLike }).kv;

  if (kv?.incr) {
    try {
      const res = await kv.incr(key, { returnValue: true });
      const count = res.value ?? 1;
      if (count === 1) await kv.expire(key, windowSeconds);
      return count <= limit;
    } catch {
      // KV indisponible → repli mémoire ci-dessous
    }
  }

  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}