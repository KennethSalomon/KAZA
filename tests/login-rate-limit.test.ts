import { describe, it, expect } from 'vitest';
import { checkRateLimit, checkLoginAttempts } from '../apps/web/src/lib/login-rate-limit';

const now = new Date('2026-08-15T12:00:00Z').getTime();

describe('checkRateLimit', () => {
  it('allows requests under the limit', () => {
    for (let i = 1; i <= 5; i++) {
      const r = checkRateLimit('k1', 5, 60, now);
      expect(r.allowed).toBe(true);
      expect(r.retryAfterSeconds).toBe(0);
    }
  });

  it('blocks once the limit is reached', () => {
    for (let i = 1; i <= 5; i++) checkRateLimit('k2', 5, 60, now);
    const blocked = checkRateLimit('k2', 5, 60, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('reports remaining wait time', () => {
    for (let i = 1; i <= 5; i++) checkRateLimit('k3', 5, 120, now);
    const blocked = checkRateLimit('k3', 5, 120, now + 30_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(90);
  });

  it('resets after the window elapses', () => {
    for (let i = 1; i <= 5; i++) checkRateLimit('k4', 5, 60, now);
    const afterWindow = checkRateLimit('k4', 5, 60, now + 61_000);
    expect(afterWindow.allowed).toBe(true);
  });

  it('isolates different keys', () => {
    checkRateLimit('a', 1, 60, now);
    expect(checkRateLimit('b', 1, 60, now).allowed).toBe(true);
  });
});

describe('checkLoginAttempts', () => {
  it('allows first attempt', () => {
    expect(checkLoginAttempts({ email: 'a@b.c', ip: '1.2.3.4' }).allowed).toBe(true);
  });

  it('locks after 5 attempts on the same email', () => {
    for (let i = 1; i <= 5; i++) checkLoginAttempts({ email: 'victime@b.c', ip: '9.9.9.9' });
    const blocked = checkLoginAttempts({ email: 'victime@b.c', ip: '9.9.9.9' });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('does not lock other emails from the same IP early', () => {
    for (let i = 1; i <= 5; i++) checkLoginAttempts({ email: 'x@b.c', ip: '7.7.7.7' });
    expect(checkLoginAttempts({ email: 'y@b.c', ip: '7.7.7.7' }).allowed).toBe(true);
  });

  it('is case-insensitive on email', () => {
    checkLoginAttempts({ email: 'A@B.C', ip: '1.1.1.1' });
    checkLoginAttempts({ email: 'a@b.c', ip: '1.1.1.1' });
    checkLoginAttempts({ email: 'A@b.c', ip: '1.1.1.1' });
    checkLoginAttempts({ email: 'a@B.C', ip: '1.1.1.1' });
    checkLoginAttempts({ email: 'A@B.c', ip: '1.1.1.1' });
    const blocked = checkLoginAttempts({ email: 'a@b.c', ip: '1.1.1.1' });
    expect(blocked.allowed).toBe(false);
  });
});
