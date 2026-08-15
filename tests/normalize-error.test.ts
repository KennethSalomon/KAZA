import { describe, it, expect } from 'vitest';
import { normalizeError } from '../apps/web/src/lib/supabase-api';

describe('normalizeError', () => {
  it('returns 409 for P0001 (business conflict)', () => {
    const err = { code: 'P0001', message: 'Limite freemium atteinte' };
    const result = normalizeError(err, 'fallback');
    expect(result.status).toBe(409);
    expect(result.message).toBe('Limite freemium atteinte');
  });

  it('returns 404 for P0002 (not found)', () => {
    const err = { code: 'P0002', message: 'Bail introuvable' };
    const result = normalizeError(err, 'fallback');
    expect(result.status).toBe(404);
  });

  it('returns 403 for 42501 (insufficient privilege)', () => {
    const err = { code: '42501', message: 'Access denied' };
    const result = normalizeError(err, 'fallback');
    expect(result.status).toBe(403);
  });

  it('returns 400 for unknown PGRST codes', () => {
    const err = { code: 'XX000', message: 'Unknown error' };
    const result = normalizeError(err, 'fallback');
    expect(result.status).toBe(400);
  });

  it('returns fallback message when err has no message or details', () => {
    const err = { code: undefined, message: undefined, details: undefined };
    const result = normalizeError(err, 'Something went wrong');
    expect(result.status).toBe(400);
    expect(result.message).toBe('Something went wrong');
  });

  it('prefers message over details', () => {
    const err = { code: 'P0001', message: 'Primary error', details: 'Secondary detail' };
    const result = normalizeError(err, 'fallback');
    expect(result.message).toBe('Primary error');
  });

  it('uses details when message is absent', () => {
    const err = { code: undefined, message: undefined, details: 'Detailed info' };
    const result = normalizeError(err, 'fallback');
    expect(result.message).toBe('Detailed info');
  });

  it('handles null input', () => {
    const result = normalizeError(null, 'Fallback msg');
    expect(result.status).toBe(400);
    expect(result.message).toBe('Fallback msg');
  });
});
