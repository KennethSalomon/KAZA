import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  verifyFedapaySignature,
  FEDAPAY_SIGNATURE_TOLERANCE_SECONDS,
} from '../supabase/functions/_shared/fedapay';

const SECRET = 'whsec_test_fedapay_kaza';
const BODY = JSON.stringify({
  id: 'evt_1234',
  object: 'event',
  name: 'transaction.approved',
  data: { id: 987654, status: 'approved', amount: 85000 },
});

/** Reconstruit l'en-tête X-FEDAPAY-SIGNATURE comme la lib officielle. */
function buildHeader(ts: number, body: string, secret: string): string {
  const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
  return `t=${ts},s=${sig}`;
}

describe('verifyFedapaySignature', () => {
  const now = Math.floor(Date.now() / 1000);

  it('accepte une signature valide (HMAC-SHA256)', async () => {
    await expect(
      verifyFedapaySignature(BODY, buildHeader(now, BODY, SECRET), SECRET),
    ).resolves.toBe(true);
  });

  it('rejette une signature avec le mauvais secret', async () => {
    await expect(
      verifyFedapaySignature(BODY, buildHeader(now, BODY, 'mauvais_secret'), SECRET),
    ).resolves.toBe(false);
  });

  it('rejette un corps modifié (tampering)', async () => {
    const tampered = BODY.replace('85000', '85001');
    await expect(
      verifyFedapaySignature(tampered, buildHeader(now, BODY, SECRET), SECRET),
    ).resolves.toBe(false);
  });

  it('rejette un timestamp expiré (> 5 min, anti-rejeu)', async () => {
    const old = now - FEDAPAY_SIGNATURE_TOLERANCE_SECONDS - 1;
    await expect(
      verifyFedapaySignature(BODY, buildHeader(old, BODY, SECRET), SECRET),
    ).resolves.toBe(false);
  });

  it('accepte un timestamp dans la tolérance', async () => {
    const recent = now - 60;
    await expect(
      verifyFedapaySignature(BODY, buildHeader(recent, BODY, SECRET), SECRET),
    ).resolves.toBe(true);
  });

  it('rejette un en-tête malformé ou absent', async () => {
    await expect(verifyFedapaySignature(BODY, null, SECRET)).resolves.toBe(false);
    await expect(verifyFedapaySignature(BODY, 't=1234', SECRET)).resolves.toBe(false);
    await expect(verifyFedapaySignature(BODY, 's=abc', SECRET)).resolves.toBe(false);
    await expect(verifyFedapaySignature(BODY, 't=abc,s=abc', SECRET)).resolves.toBe(false);
  });
});
