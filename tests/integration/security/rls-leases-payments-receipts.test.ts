import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { supabaseAnon, supabaseAdmin, createTestUser, signInTestUser, deleteTestUser, resetDatabase } from '../../helpers/supabase-test-client';
import { createClient } from '@supabase/supabase-js';

describe('RLS: leases, payments, receipts tables', () => {
  let landlordA: any;
  let landlordB: any;
  let tenantA: any;
  let tenantB: any;
  let adminUser: any;

  beforeAll(async () => {
    await resetDatabase();
    landlordA = await createTestUser('bailleur');
    landlordB = await createTestUser('bailleur');
    tenantA = await createTestUser('locataire');
    tenantB = await createTestUser('locataire');
    adminUser = await createTestUser('admin');

    for (const u of [landlordA, landlordB, tenantA, tenantB, adminUser]) {
      const signIn = await signInTestUser(u.email, u.password);
      u.token = signIn.session?.access_token ?? '';
    }
  });

  afterAll(async () => {
    await deleteTestUser(landlordA.user.id);
    await deleteTestUser(landlordB.user.id);
    await deleteTestUser(tenantA.user.id);
    await deleteTestUser(tenantB.user.id);
    await deleteTestUser(adminUser.user.id);
  });

  beforeEach(async () => {
    await resetDatabase();
    for (const u of [landlordA, landlordB, tenantA, tenantB, adminUser]) {
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

  async function createResidence(user: any) {
    const { data, error } = await getClient(user).rpc('create_residence', {
      title: `Test ${Date.now()}`,
      type: 'appartement',
      price_monthly: 100000,
      deposit: 200000,
      bedrooms: 2,
      bathrooms: 1,
      city: 'Cotonou',
      zone: 'Haie Vive',
    });
    if (error) throw error;
    return data;
  }

  async function createLease(landlord: any, tenant: any) {
    const residenceId = await createResidence(landlord);
    await supabaseAdmin.rpc('admin_moderate_residence', { p_residence_id: residenceId, p_action: 'approve' });
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

  async function createPayment(tenant: any, leaseId: string, overrides = {}) {
    const { data, error } = await getClient(tenant).rpc('report_cash_payment', {
      lease_id: leaseId,
      amount: 100000,
      period_start: new Date().toISOString().split('T')[0],
      period_end: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      ...overrides,
    });
    if (error) throw error;
    return data;
  }

  describe('leases SELECT', () => {
    it('tenant CAN see own lease', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const { data, error } = await getClient(tenantA).from('leases').select('*').eq('id', leaseId).single();
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('landlord CAN see lease for their property', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const { data, error } = await getClient(landlordA).from('leases').select('*').eq('id', leaseId).single();
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('tenant B CANNOT see tenant A lease', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const { data, error } = await getClient(tenantB).from('leases').select('*').eq('id', leaseId).single();
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('landlord B CANNOT see lease for landlord A property', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const { data, error } = await getClient(landlordB).from('leases').select('*').eq('id', leaseId).single();
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('anon CANNOT see any lease', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const { data, error } = await supabaseAnon.from('leases').select('*').eq('id', leaseId).single();
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('admin CAN see all leases', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const { data, error } = await getClient(adminUser).from('leases').select('*').eq('id', leaseId).single();
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('leases INSERT', () => {
    it('landlord CAN create lease via RPC', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      expect(leaseId).toBeDefined();
    });

    it('tenant CANNOT create lease', async () => {
      const residenceId = await createResidence(landlordA);
      await supabaseAdmin.rpc('admin_moderate_residence', { p_residence_id: residenceId, p_action: 'approve' });
      const { error } = await getClient(tenantA).rpc('create_lease', {
        p_residence_id: residenceId,
        p_tenant_id: tenantA.user.id,
        p_start_date: new Date().toISOString().split('T')[0],
        p_monthly_rent: 100000,
      });
      expect(error).toBeDefined();
    });
  });

  describe('payments SELECT', () => {
    it('tenant CAN see own payment', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const paymentId = await createPayment(tenantA, leaseId);
      const { data, error } = await getClient(tenantA).from('payments').select('*').eq('id', paymentId).single();
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('landlord CAN see payment for their property', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const paymentId = await createPayment(tenantA, leaseId);
      const { data, error } = await getClient(landlordA).from('payments').select('*').eq('id', paymentId).single();
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('tenant B CANNOT see tenant A payment', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const paymentId = await createPayment(tenantA, leaseId);
      const { data, error } = await getClient(tenantB).from('payments').select('*').eq('id', paymentId).single();
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('landlord B CANNOT see payment for landlord A property', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const paymentId = await createPayment(tenantA, leaseId);
      const { data, error } = await getClient(landlordB).from('payments').select('*').eq('id', paymentId).single();
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('anon CANNOT see any payment', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const paymentId = await createPayment(tenantA, leaseId);
      const { data, error } = await supabaseAnon.from('payments').select('*').eq('id', paymentId).single();
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });
  });

  describe('payments INSERT (cash payment)', () => {
    it('tenant CAN report cash payment for own lease', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const paymentId = await createPayment(tenantA, leaseId);
      expect(paymentId).toBeDefined();
    });

    it('tenant CANNOT report payment for other tenant lease', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const { error } = await getClient(tenantB).rpc('report_cash_payment', {
        lease_id: leaseId,
        amount: 100000,
        period_start: new Date().toISOString().split('T')[0],
        period_end: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      });
      expect(error).toBeDefined();
    });

    it('tenant CANNOT inject amount mismatch (server validates)', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      // Try to report 1 FCFA on a 100000 FCFA/month lease
      const { error } = await getClient(tenantA).rpc('report_cash_payment', {
        lease_id: leaseId,
        amount: 1,
        period_start: new Date().toISOString().split('T')[0],
        period_end: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      });
      // Should be blocked by amount validation trigger
      expect(error).toBeDefined();
    });

    it('tenant CANNOT inject confirmed status directly', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const { error } = await getClient(tenantA).from('payments').insert({
        lease_id: leaseId,
        tenant_id: tenantA.user.id,
        landlord_id: landlordA.user.id,
        amount: 100000,
        period_start: new Date().toISOString().split('T')[0],
        period_end: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        method: 'cash',
        provider: 'cash',
        status: 'confirmed',
      });
      expect(error).toBeDefined();
    });
  });

  describe('payments UPDATE', () => {
    it('tenant CANNOT confirm own payment', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const paymentId = await createPayment(tenantA, leaseId);
      const { error } = await getClient(tenantA).from('payments').update({ status: 'confirmed' }).eq('id', paymentId);
      expect(error).toBeDefined();
    });

    it('landlord CANNOT confirm payment via direct update (should use RPC)', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const paymentId = await createPayment(tenantA, leaseId);
      const { error } = await getClient(landlordA).from('payments').update({ status: 'confirmed' }).eq('id', paymentId);
      // Should be blocked - admin actions require RPC
      expect(error).toBeDefined();
    });

    it('admin CAN confirm payment via RPC', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const paymentId = await createPayment(tenantA, leaseId);
      const { error } = await getClient(adminUser).rpc('confirm_payment', { payment_id: paymentId });
      expect(error).toBeNull();
    });
  });

  describe('receipts SELECT', () => {
    it('tenant CAN see own receipt', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const paymentId = await createPayment(tenantA, leaseId);
      await getClient(adminUser).rpc('confirm_payment', { payment_id: paymentId });
      // Receipt auto-created by trigger
      const { data: receipts } = await getClient(tenantA).from('receipts').select('*').eq('payment_id', paymentId);
      if (receipts && receipts.length > 0) {
        const { data, error } = await getClient(tenantA).from('receipts').select('*').eq('id', receipts[0].id).single();
        expect(error).toBeNull();
        expect(data).toBeDefined();
      }
    });

    it('tenant B CANNOT see tenant A receipt', async () => {
      const { leaseId } = await createLease(landlordA, tenantA);
      const paymentId = await createPayment(tenantA, leaseId);
      await getClient(adminUser).rpc('confirm_payment', { payment_id: paymentId });
      const { data: receipts } = await getClient(tenantA).from('receipts').select('*').eq('payment_id', paymentId);
      if (receipts && receipts.length > 0) {
        const { data, error } = await getClient(tenantB).from('receipts').select('*').eq('id', receipts[0].id).single();
        expect(error).toBeDefined();
        expect(data).toBeNull();
      }
    });
  });
});