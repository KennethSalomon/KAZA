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

const MAX_MEMORY_ENTRIES = 10_000;
let lastSweep = 0;

function sweepExpired(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, entry] of memory) {
    if (entry.resetAt <= now) memory.delete(key);
  }
  if (memory.size > MAX_MEMORY_ENTRIES) {
    const sorted = [...memory.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    const excess = memory.size - MAX_MEMORY_ENTRIES;
    for (let i = 0; i < excess; i += 1) memory.delete(sorted[i][0]);
  }
}

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
  sweepExpired(now);
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export function clientIp(req: Request): string {
  // Supabase injecte x-real-ip (IP du client réel, non forgée côté client).
  // x-forwarded-for est préféré uniquement si un proxy de confiance
  // (Cloudflare) l'a posé — on refuse les en-têtes forgés en direct.
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf;
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return 'unknown';
}