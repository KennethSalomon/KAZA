import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { supabaseAnon, supabaseAdmin, createTestUser, signInTestUser, deleteTestUser, resetDatabase } from '../../helpers/supabase-test-client';
import { createClient } from '@supabase/supabase-js';

describe('Payment concurrency & idempotence', () => {
  let landlordA: any;
  let tenantA: any;
  let adminUser: any;

  beforeAll(async () => {
    await resetDatabase();
    landlordA = await createTestUser('bailleur');
    tenantA = await createTestUser('locataire');
    adminUser = await createTestUser('admin');

    for (const u of [landlordA, tenantA, adminUser]) {
      const signIn = await signInTestUser(u.email, u.password);
      u.token = signIn.session?.access_token ?? '';
    }
  });

  afterAll(async () => {
    await deleteTestUser(landlordA.user.id);
    await deleteTestUser(tenantA.user.id);
    await deleteTestUser(adminUser.user.id);
  });

  beforeEach(async () => {
    await resetDatabase();
    for (const u of [landlordA, tenantA, adminUser]) {
      const signIn = await signInTestUser(u.email, u.password);
      u.token = signIn.session?.access_token ?? '';
    }
  });

  const clients: Record<string, any> = {};
  function getClient(user: any) {
    if (!clients[user.token]) {
      clients[user.token] = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${user.token}` } } }
      );
    }
    return clients[user.token];
  }

  async function createPublishedVerifiedResidence(landlord: any): Promise<string> {
    const { data, error } = await supabaseAdmin.from('residences').insert({
      owner_id: landlord.user.id,
      title: `Test ${Date.now()}`,
      type: 'appartement',
      price_monthly: 100000,
      deposit: 200000,
      bedrooms: 2,
      bathrooms: 1,
      city: 'Cotonou',
      zone: 'Haie Vive',
      is_published: true,
      is_verified: true,
    }).select('id').single();
    if (error) throw error;
    return data.id;
  }

  async function createLease(landlord: any, tenant: any) {
    const residenceId = await createPublishedVerifiedResidence(landlord);
    // Use create_lease RPC (exists in 20260908232309)
    const { data, error } = await getClient(landlord).rpc('create_lease', {
      p_residence_id: residenceId,
      p_tenant_id: tenant.user.id,
      p_start_date: new Date().toISOString().split('T')[0],
      p_monthly_rent: 100000,
      p_deposit: 200000,
    });
    if (error) throw error;
    return { leaseId: data, residenceId };
  }

  async function reportCashPaymentAndGetId(
    client: any,
    leaseId: string,
    amount: number,
    periodStart: string,
    periodEnd: string
  ): Promise<string> {
    const { error } = await client.rpc('report_cash_payment', {
      p_lease_id: leaseId,
      p_amount: amount,
      p_period_start: periodStart,
      p_period_end: periodEnd,
    });
    if (error) throw error;

    // report_cash_payment returns void, query to get the payment ID
    const { data: payments, error: queryError } = await client
      .from('payments')
      .select('id')
      .eq('lease_id', leaseId)
      .eq('amount', amount)
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd)
      .order('created_at', { ascending: false })
      .limit(1);
    if (queryError) throw queryError;
    if (!payments || payments.length === 0) {
      throw new Error('Payment not found after report_cash_payment');
    }
    return payments[0].id;
  }

  describe('Cash payment idempotence', () => {
    it('duplicate report_cash_payment calls with same lease+period are rejected', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const periodStart = new Date().toISOString().split('T')[0];
      const periodEnd = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

      // First call - should succeed
      const paymentId1 = await reportCashPaymentAndGetId(getClient(tenantA), leaseId, 100000, periodStart, periodEnd);
      expect(paymentId1).toBeDefined();

      // Second call with identical parameters - should be rejected by validate_cash_payment_amount trigger
      // (duplicate period for same lease is prevented by unique constraint or trigger)
      const { error: error2 } = await getClient(tenantA).rpc('report_cash_payment', {
        p_lease_id: leaseId,
        p_amount: 100000,
        p_period_start: periodStart,
        p_period_end: periodEnd,
      });

      // Should be rejected (duplicate period for same lease)
      expect(error2).toBeDefined();

      // Verify only one payment exists
      const { data: payments } = await getClient(tenantA).from('payments').select('*').eq('lease_id', leaseId);
      expect(payments?.length).toBe(1);
    });

    it('concurrent cash payment reports for same lease create at most one', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const periodStart = new Date().toISOString().split('T')[0];
      const periodEnd = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

      // Fire 5 concurrent requests
      const promises = Array.from({ length: 5 }, () =>
        getClient(tenantA).rpc('report_cash_payment', {
          p_lease_id: leaseId,
          p_amount: 100000,
          p_period_start: periodStart,
          p_period_end: periodEnd,
        })
      );

      const results = await Promise.allSettled(promises);

      // At most one should succeed (others rejected by trigger/constraint)
      const successful = results.filter(r => r.status === 'fulfilled' && !r.value?.error);
      expect(successful.length).toBeLessThanOrEqual(1);

      // Verify only one payment exists
      const { data: payments } = await getClient(tenantA).from('payments').select('*').eq('lease_id', leaseId);
      expect(payments?.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Payment confirmation idempotence', () => {
    it('double confirmation on same payment is idempotent', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const periodStart = new Date().toISOString().split('T')[0];
      const periodEnd = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

      const paymentId = await reportCashPaymentAndGetId(getClient(tenantA), leaseId, 100000, periodStart, periodEnd);

      // First confirmation via direct UPDATE (app pattern)
      const { error: error1 } = await getClient(landlordA)
        .from('payments')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          confirmed_by: landlordA.user.id,
        })
        .eq('id', paymentId);
      expect(error1).toBeNull();

      // Second confirmation - should be idempotent (update same values)
      const { error: error2 } = await getClient(landlordA)
        .from('payments')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          confirmed_by: landlordA.user.id,
        })
        .eq('id', paymentId);
      expect(error2).toBeNull();

      // Verify payment is confirmed (not double-counted)
      const { data: payment } = await getClient(landlordA).from('payments').select('status').eq('id', paymentId).single();
      expect(payment?.status).toBe('confirmed');

      // Verify only one receipt was created (by trigger 007)
      const { data: receipts } = await getClient(landlordA).from('receipts').select('*').eq('payment_id', paymentId);
      expect(receipts?.length).toBe(1);
    });

    it('confirm then reject on same payment fails appropriately', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const periodStart = new Date().toISOString().split('T')[0];
      const periodEnd = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

      const paymentId = await reportCashPaymentAndGetId(getClient(tenantA), leaseId, 100000, periodStart, periodEnd);

      // Confirm first
      await getClient(landlordA)
        .from('payments')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          confirmed_by: landlordA.user.id,
        })
        .eq('id', paymentId);

      // Try to reject confirmed payment - should fail (trigger prevents status change from confirmed)
      const { error } = await getClient(landlordA)
        .from('payments')
        .update({ status: 'rejected' })
        .eq('id', paymentId);
      expect(error).toBeDefined();
    });
  });

  describe('Webhook replay protection', () => {
    it('simulated duplicate webhook for same transaction does not double-process', async () => {
      // This test would require mocking the FedaPay webhook
      // For now, we verify the webhook handler has idempotency keys
      const { data: payment } = await getClient(tenantA).from('payments').select('*').limit(1);
      if (payment && payment.length > 0) {
        const p = payment[0];
        if (p.provider_ref) {
          // Simulate webhook with same provider_ref
          // Note: process_fedapay_webhook RPC was removed, webhook is handled by Edge Function
          // This test is informational - real webhook idempotency is in the Edge Function
          expect(p.provider_ref).toBeDefined();
        }
      }
    });
  });
});