import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatXof, formatDate, formatDateShort, timeAgo } from '../apps/web/src/lib/format';

describe('formatXof', () => {
  it('formats number with FCFA suffix', () => {
    expect(formatXof(100000)).toMatch(/100.000 FCFA/);
  });

  it('formats string amount', () => {
    expect(formatXof('50000')).toMatch(/50.000 FCFA/);
  });

  it('returns 0 FCFA for null', () => {
    expect(formatXof(null)).toBe('0 FCFA');
  });

  it('returns 0 FCFA for undefined', () => {
    expect(formatXof(undefined)).toBe('0 FCFA');
  });
});

describe('formatDate', () => {
  it('formats ISO date to fr-BJ', () => {
    const result = formatDate('2026-03-15');
    expect(result).toContain('15');
    expect(result).toContain('2026');
  });

  it('returns — for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('returns — for undefined', () => {
    expect(formatDate(undefined)).toBe('—');
  });
});

describe('formatDateShort', () => {
  it('formats ISO date to short format', () => {
    const result = formatDateShort('2026-03-15');
    expect(result).toMatch(/\d{2}\/03\/\d{2}/);
  });

  it('returns — for null', () => {
    expect(formatDateShort(null)).toBe('—');
  });
});

describe('timeAgo', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty string for null', () => {
    expect(timeAgo(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(timeAgo(undefined)).toBe('');
  });

  it('returns "à l\'instant" for recent timestamps', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00Z'));
    expect(timeAgo('2026-08-15T11:59:30Z')).toContain("instant");
  });

  it('returns minutes for timestamps < 1h', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00Z'));
    expect(timeAgo('2026-08-15T11:45:00Z')).toBe('il y a 15 min');
  });

  it('returns hours for timestamps < 24h', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00Z'));
    expect(timeAgo('2026-08-15T09:00:00Z')).toBe('il y a 3 h');
  });

  it('returns "hier" for 1 day ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00Z'));
    expect(timeAgo('2026-08-14T12:00:00Z')).toBe('hier');
  });

  it('returns days for timestamps < 7 days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00Z'));
    expect(timeAgo('2026-08-12T12:00:00Z')).toBe('il y a 3 jours');
  });

  it('returns formatted date for timestamps >= 7 days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00Z'));
    const result = timeAgo('2026-08-01T12:00:00Z');
    expect(result).toMatch(/\d{2}\/08\/\d{2}/);
  });
});
