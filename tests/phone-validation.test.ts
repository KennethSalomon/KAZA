import { describe, it, expect } from 'vitest';

const PHONE_RE = /^\+229[0-9]{10}$/;

describe('Benin phone validation (+229 10 digits)', () => {
  it('accepts valid +229 format', () => {
    expect(PHONE_RE.test('+2290100000000')).toBe(true);
    expect(PHONE_RE.test('+2299712345678')).toBe(true);
    expect(PHONE_RE.test('+2290199887766')).toBe(true);
  });

  it('rejects missing +229 prefix', () => {
    expect(PHONE_RE.test('0100000000')).toBe(false);
    expect(PHONE_RE.test('97123456')).toBe(false);
  });

  it('rejects wrong prefix', () => {
    expect(PHONE_RE.test('+3301000000000')).toBe(false);
    expect(PHONE_RE.test('+2250100000000')).toBe(false);
  });

  it('rejects too few digits', () => {
    expect(PHONE_RE.test('+229010000000')).toBe(false);
    expect(PHONE_RE.test('+22901000000')).toBe(false);
  });

  it('rejects too many digits', () => {
    expect(PHONE_RE.test('+22901000000001')).toBe(false);
    expect(PHONE_RE.test('+229010000000000')).toBe(false);
  });

  it('rejects spaces in number', () => {
    expect(PHONE_RE.test('+229 01 00 00 00 00')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(PHONE_RE.test('')).toBe(false);
  });
});
