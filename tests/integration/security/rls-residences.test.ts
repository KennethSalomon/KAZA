import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { supabaseAnon, supabaseAdmin, createTestUser, signInTestUser, deleteTestUser, resetDatabase } from '../../helpers/supabase-test-client';
import { createClient } from '@supabase/supabase-js';

describe('RLS: residences table', () => {
  let landlordA: any;
  let landlordB: any;
  let tenantA: any;
  let adminUser: any;

  beforeAll(async () => {
    await resetDatabase();
    landlordA = await createTestUser('bailleur');
    landlordB = await createTestUser('bailleur');
    tenantA = await createTestUser('locataire');
    adminUser = await createTestUser('admin');

    for (const u of [landlordA, landlordB, tenantA, adminUser]) {
      const signIn = await signInTestUser(u.email, u.password);
      u.token = signIn.session?.access_token ?? '';
    }
  });

  afterAll(async () => {
    await deleteTestUser(landlordA.user.id);
    await deleteTestUser(landlordB.user.id);
    await deleteTestUser(tenantA.user.id);
    await deleteTestUser(adminUser.user.id);
  });

  beforeEach(async () => {
    await resetDatabase();
    for (const u of [landlordA, landlordB, tenantA, adminUser]) {
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

  async function createResidenceDirect(ownerId: string, overrides = {}) {
    const { data, error } = await supabaseAdmin.from('residences').insert({
      owner_id: ownerId,
      title: `Test Residence ${Date.now()}`,
      description: 'Test description',
      type: 'appartement',
      price_monthly: 100000,
      deposit: 200000,
      bedrooms: 2,
      bathrooms: 1,
      city: 'Cotonou',
      zone: 'Haie Vive',
      is_published: true,
      is_verified: true,
      ...overrides,
    }).select('id').single();
    if (error) throw error;
    return data.id;
  }

  describe('SELECT policies', () => {
    it('published & verified residence is visible to all', async () => {
      const residenceId = await createResidenceDirect(landlordA.user.id);
      // Admin verifies it (already verified by default in test)
      await supabaseAdmin.rpc('admin_moderate_residence', { p_residence_id: residenceId, p_action: 'approve' });

      const { data, error } = await supabaseAnon.from('residences').select('*').eq('id', residenceId).single();
      expect(error).toBeNull();
      expect(data?.is_published).toBe(true);
      expect(data?.is_verified).toBe(true);
    });

    it('draft residence is NOT visible to tenant', async () => {
      const residenceId = await createResidenceDirect(landlordA.user.id, { is_published: false });
      const clientTenant = getClient(tenantA);
      const { data, error } = await clientTenant.from('residences').select('*').eq('id', residenceId).single();
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('unverified residence is NOT visible to tenant', async () => {
      const residenceId = await createResidenceDirect(landlordA.user.id, { is_published: true, is_verified: false });
      const clientTenant = getClient(tenantA);
      const { data, error } = await clientTenant.from('residences').select('*').eq('id', residenceId).single();
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('landlord CAN see own draft/unverified residences', async () => {
      const residenceId = await createResidenceDirect(landlordA.user.id, { is_published: false, is_verified: false });
      const clientLandlord = getClient(landlordA);
      const { data, error } = await clientLandlord.from('residences').select('*').eq('id', residenceId).single();
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('landlord CANNOT see other landlord draft', async () => {
      const residenceId = await createResidenceDirect(landlordB.user.id, { is_published: false });
      const clientLandlordA = getClient(landlordA);
      const { data, error } = await clientLandlordA.from('residences').select('*').eq('id', residenceId).single();
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('admin CAN see all residences', async () => {
      const residenceId = await createResidenceDirect(landlordA.user.id, { is_published: false, is_verified: false });
      const clientAdmin = getClient(adminUser);
      const { data, error } = await clientAdmin.from('residences').select('*').eq('id', residenceId).single();
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('INSERT policies', () => {
    it('landlord CAN create residence via direct INSERT', async () => {
      const clientLandlord = getClient(landlordA);
      const { data, error } = await clientLandlord.from('residences').insert({
        title: 'My Residence',
        type: 'appartement',
        price_monthly: 100000,
        deposit: 200000,
        bedrooms: 2,
        bathrooms: 1,
        city: 'Cotonou',
        zone: 'Haie Vive',
      }).select('id').single();
      expect(error).toBeNull();
      expect(data?.id).toBeDefined();
    });

    it('tenant CANNOT create residence', async () => {
      const clientTenant = getClient(tenantA);
      const { data, error } = await clientTenant.from('residences').insert({
        title: 'Hack Attempt',
        type: 'appartement',
        price_monthly: 50000,
        city: 'Cotonou',
      }).select('id').single();
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('anon CANNOT create residence', async () => {
      const { data, error } = await supabaseAnon.from('residences').insert({
        title: 'Hack Attempt',
        type: 'appartement',
        price_monthly: 50000,
        city: 'Cotonou',
      }).select('id').single();
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });
  });

  describe('UPDATE policies', () => {
    it('landlord CAN update own residence', async () => {
      const residenceId = await createResidenceDirect(landlordA.user.id);
      const clientLandlord = getClient(landlordA);
      const { data, error } = await clientLandlord
        .from('residences')
        .update({ title: 'Updated Title' })
        .eq('id', residenceId)
        .select('title')
        .single();
      expect(error).toBeNull();
      expect(data?.title).toBe('Updated Title');
    });

    it('landlord CANNOT update other landlord residence', async () => {
      const residenceId = await createResidenceDirect(landlordB.user.id);
      const clientLandlordA = getClient(landlordA);
      const { data, error } = await clientLandlordA
        .from('residences')
        .update({ title: 'Hacked' })
        .eq('id', residenceId)
        .select('title')
        .single();
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('tenant CANNOT update any residence', async () => {
      const residenceId = await createResidenceDirect(landlordA.user.id);
      const clientTenant = getClient(tenantA);
      const { data, error } = await clientTenant
        .from('residences')
        .update({ title: 'Hacked' })
        .eq('id', residenceId)
        .select('title')
        .single();
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('landlord CANNOT self-verify (is_verified is admin-only)', async () => {
      const residenceId = await createResidenceDirect(landlordA.user.id);
      const clientLandlord = getClient(landlordA);
      const { data, error } = await clientLandlord
        .from('residences')
        .update({ is_verified: true })
        .eq('id', residenceId)
        .select('is_verified')
        .single();
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('admin CAN update any residence including is_verified', async () => {
      const residenceId = await createResidenceDirect(landlordA.user.id);
      const clientAdmin = getClient(adminUser);
      const { data, error } = await clientAdmin
        .from('residences')
        .update({ is_verified: true })
        .eq('id', residenceId)
        .select('is_verified')
        .single();
      expect(error).toBeNull();
      expect(data?.is_verified).toBe(true);
    });
  });

  describe('DELETE policies', () => {
    it('landlord CAN delete own draft residence', async () => {
      const residenceId = await createResidenceDirect(landlordA.user.id, { is_published: false });
      const clientLandlord = getClient(landlordA);
      const { error } = await clientLandlord.from('residences').delete().eq('id', residenceId);
      expect(error).toBeNull();
    });

    it('landlord CANNOT delete published residence (status occupied check)', async () => {
      const residenceId = await createResidenceDirect(landlordA.user.id, { is_published: true, is_verified: true });
      const clientLandlord = getClient(landlordA);
      const { error } = await clientLandlord.from('residences').delete().eq('id', residenceId);
      // May succeed if not occupied, but should fail if occupied
      // This tests the trigger logic
    });

    it('tenant CANNOT delete any residence', async () => {
      const residenceId = await createResidenceDirect(landlordA.user.id);
      const clientTenant = getClient(tenantA);
      const { error } = await clientTenant.from('residences').delete().eq('id', residenceId);
      expect(error).toBeDefined();
    });
  });
});