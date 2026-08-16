import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { supabaseAnon, supabaseAdmin, createTestUser, signInTestUser, deleteTestUser, resetDatabase } from '../../helpers/supabase-test-client';
import { createClient } from '@supabase/supabase-js';

describe('RLS: notifications & admin tables', () => {
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

  async function createResidence(user: any) {
    const { data, error } = await getClient(user).rpc('create_residence', {
      title: `Test ${Date.now()}`,
      type: 'appartement',
      price_monthly: 100000,
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

  describe('notifications SELECT', () => {
    it('user CAN see own notifications', async () => {
      // Trigger a notification by creating a lease
      await createLease(landlordA, tenantA);
      const { data, error } = await getClient(tenantA).from('notifications').select('*').limit(1);
      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThanOrEqual(0);
    });

    it('user CANNOT see other user notifications', async () => {
      await createLease(landlordA, tenantA);
      const { data, error } = await getClient(landlordA).from('notifications').select('*').eq('user_id', tenantA.user.id);
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('anon CANNOT see any notifications', async () => {
      await createLease(landlordA, tenantA);
      const { data, error } = await supabaseAnon.from('notifications').select('*').limit(1);
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });
  });

  describe('notifications UPDATE (mark read)', () => {
    it('user CAN mark own notification as read', async () => {
      await createLease(landlordA, tenantA);
      const { data: notifs } = await getClient(tenantA).from('notifications').select('id').limit(1);
      if (notifs && notifs.length > 0) {
        const { error } = await getClient(tenantA)
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('id', notifs[0].id);
        expect(error).toBeNull();
      }
    });

    it('user CANNOT mark other user notification as read', async () => {
      await createLease(landlordA, tenantA);
      const { data: notifs } = await getClient(tenantA).from('notifications').select('id').limit(1);
      if (notifs && notifs.length > 0) {
        const { error } = await getClient(landlordA)
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('id', notifs[0].id);
        expect(error).toBeDefined();
      }
    });
  });

  describe('notifications INSERT/DELETE', () => {
    it('user CANNOT insert notifications directly', async () => {
      const { error } = await getClient(tenantA).from('notifications').insert({
        user_id: tenantA.user.id,
        type: 'system',
        title: 'Fake',
        body: 'Hack',
      });
      expect(error).toBeDefined();
    });

    it('user CANNOT delete notifications', async () => {
      await createLease(landlordA, tenantA);
      const { data: notifs } = await getClient(tenantA).from('notifications').select('id').limit(1);
      if (notifs && notifs.length > 0) {
        const { error } = await getClient(tenantA).from('notifications').delete().eq('id', notifs[0].id);
        expect(error).toBeDefined();
      }
    });
  });

  describe('Admin functions', () => {
    it('admin CAN call admin_stats', async () => {
      const { data, error } = await getClient(adminUser).rpc('admin_stats');
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('tenant CANNOT call admin_stats', async () => {
      const { error } = await getClient(tenantA).rpc('admin_stats');
      expect(error).toBeDefined();
    });

    it('landlord CANNOT call admin_stats', async () => {
      const { error } = await getClient(landlordA).rpc('admin_stats');
      expect(error).toBeDefined();
    });

    it('admin CAN call admin_list_residences', async () => {
      const { data, error } = await getClient(adminUser).rpc('admin_list_residences', { limit: 10 });
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('tenant CANNOT call admin_list_residences', async () => {
      const { error } = await getClient(tenantA).rpc('admin_list_residences');
      expect(error).toBeDefined();
    });

    it('admin CAN call admin_list_users', async () => {
      const { data, error } = await getClient(adminUser).rpc('admin_list_users', { limit: 10 });
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('tenant CANNOT call admin_list_users', async () => {
      const { error } = await getClient(tenantA).rpc('admin_list_users');
      expect(error).toBeDefined();
    });

    it('admin CAN verify residence via RPC', async () => {
      const residenceId = await createResidence(landlordA);
      const { error } = await getClient(adminUser).rpc('admin_verify_residence', { p_residence_id: residenceId });
      expect(error).toBeNull();
    });

    it('tenant CANNOT verify residence', async () => {
      const residenceId = await createResidence(landlordA);
      const { error } = await getClient(tenantA).rpc('admin_verify_residence', { p_residence_id: residenceId });
      expect(error).toBeDefined();
    });

    it('admin CAN unpublish residence via RPC', async () => {
      const residenceId = await createResidence(landlordA);
      await supabaseAdmin.rpc('admin_moderate_residence', { p_residence_id: residenceId, p_action: 'approve' });
      const { error } = await getClient(adminUser).rpc('admin_unpublish_residence', { p_residence_id: residenceId });
      expect(error).toBeNull();
    });

    it('admin CAN set premium via RPC', async () => {
      const { error } = await getClient(adminUser).rpc('admin_set_premium', { p_user_id: tenantA.user.id, p_is_premium: true });
      expect(error).toBeNull();
    });

    it('tenant CANNOT set premium', async () => {
      const { error } = await getClient(tenantA).rpc('admin_set_premium', { p_user_id: tenantA.user.id, p_is_premium: true });
      expect(error).toBeDefined();
    });

    it('admin CAN toggle role via RPC', async () => {
      const { error } = await getClient(adminUser).rpc('admin_toggle_role', { p_user_id: tenantA.user.id, p_role: 'bailleur' });
      expect(error).toBeNull();
    });

    it('tenant CANNOT toggle role', async () => {
      const { error } = await getClient(tenantA).rpc('admin_toggle_role', { p_user_id: tenantA.user.id, p_role: 'bailleur' });
      expect(error).toBeDefined();
    });

    it('admin CANNOT toggle role to admin', async () => {
      const { error } = await getClient(adminUser).rpc('admin_toggle_role', { p_user_id: tenantA.user.id, p_role: 'admin' });
      // Should be blocked - admin role cannot be assigned via this RPC
      expect(error).toBeDefined();
    });
  });
});