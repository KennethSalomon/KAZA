import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { supabaseAnon, supabaseAdmin, createTestUser, signInTestUser, deleteTestUser, resetDatabase } from '../../helpers/supabase-test-client';

describe('RLS: profiles table', () => {
  let userA: { user: any; email: string; password: string; token: string };
  let userB: { user: any; email: string; password: string; token: string };
  let adminUser: { user: any; email: string; password: string; token: string };

  beforeAll(async () => {
    await resetDatabase();
    userA = await createTestUser('locataire');
    userB = await createTestUser('locataire');
    adminUser = await createTestUser('admin');

    const signInA = await signInTestUser(userA.email, userA.password);
    const signInB = await signInTestUser(userB.email, userB.password);
    const signInAdmin = await signInTestUser(adminUser.email, adminUser.password);

    userA.token = signInA.session?.access_token ?? '';
    userB.token = signInB.session?.access_token ?? '';
    adminUser.token = signInAdmin.session?.access_token ?? '';
  });

  afterAll(async () => {
    await deleteTestUser(userA.user.id);
    await deleteTestUser(userB.user.id);
    await deleteTestUser(adminUser.user.id);
  });

  beforeEach(async () => {
    await resetDatabase();
    // Re-sign in to get fresh tokens
    const signInA = await signInTestUser(userA.email, userA.password);
    const signInB = await signInTestUser(userB.email, userB.password);
    const signInAdmin = await signInTestUser(adminUser.email, adminUser.password);
    userA.token = signInA.session?.access_token ?? '';
    userB.token = signInB.session?.access_token ?? '';
    adminUser.token = signInAdmin.session?.access_token ?? '';
  });

  const anonClient = supabaseAnon;
  const adminClient = supabaseAdmin;

  const clientA = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${userA.token}` } },
  });

  const clientB = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${userB.token}` } },
  });

  const clientAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${adminUser.token}` } },
  });

  // Helper to get current user's profile ID
  const getProfileId = async (client: any) => {
    const { data: { user } } = await client.auth.getUser();
    return user?.id;
  };

  describe('SELECT policies', () => {
    it('user A can read own profile', async () => {
      const profileId = await getProfileId(clientA);
      const { data, error } = await clientA.from('profiles').select('*').eq('id', profileId).single();
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.id).toBe(profileId);
    });

    it('user A CANNOT read user B profile', async () => {
      const profileIdB = await getProfileId(clientB);
      const { data, error } = await clientA.from('profiles').select('*').eq('id', profileIdB).single();
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('anon CANNOT read any profile', async () => {
      const profileIdA = await getProfileId(clientA);
      const { data, error } = await anonClient.from('profiles').select('*').eq('id', profileIdA).single();
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('admin CAN read any profile', async () => {
      const profileIdB = await getProfileId(clientB);
      const { data, error } = await clientAdmin.from('profiles').select('*').eq('id', profileIdB).single();
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.id).toBe(profileIdB);
    });

    it('user A CANNOT list all profiles', async () => {
      const { data, error } = await clientA.from('profiles').select('*');
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('admin CAN list all profiles', async () => {
      const { data, error } = await clientAdmin.from('profiles').select('*');
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data!.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('UPDATE policies', () => {
    it('user A can update own profile (allowed fields)', async () => {
      const profileId = await getProfileId(clientA);
      const { data, error } = await clientA
        .from('profiles')
        .update({ full_name: 'Updated Name A' })
        .eq('id', profileId)
        .select('full_name')
        .single();
      expect(error).toBeNull();
      expect(data?.full_name).toBe('Updated Name A');
    });

    it('user A CANNOT update user B profile', async () => {
      const profileIdB = await getProfileId(clientB);
      const { data, error } = await clientA
        .from('profiles')
        .update({ full_name: 'Hacked Name' })
        .eq('id', profileIdB)
        .select('full_name')
        .single();
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('user A CANNOT escalate role to admin', async () => {
      const profileId = await getProfileId(clientA);
      const { data, error } = await clientA
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', profileId)
        .select('role')
        .single();
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('user A CANNOT escalate role to bailleur without consent', async () => {
      const profileId = await getProfileId(clientA);
      const { data, error } = await clientA
        .from('profiles')
        .update({ role: 'bailleur', consent_apdp: true })
        .eq('id', profileId)
        .select('role')
        .single();
      // Should be blocked by trigger profiles_guard_sensitive
      expect(error).toBeDefined();
    });

    it('user A CANNOT remove consent_apdp', async () => {
      const profileId = await getProfileId(clientA);
      const { data, error } = await clientA
        .from('profiles')
        .update({ consent_apdp: false })
        .eq('id', profileId)
        .select('consent_apdp')
        .single();
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('admin CAN update any profile', async () => {
      const profileIdB = await getProfileId(clientB);
      const { data, error } = await clientAdmin
        .from('profiles')
        .update({ full_name: 'Admin Updated' })
        .eq('id', profileIdB)
        .select('full_name')
        .single();
      expect(error).toBeNull();
      expect(data?.full_name).toBe('Admin Updated');
    });

    it('admin CAN promote user to bailleur', async () => {
      const profileIdB = await getProfileId(clientB);
      const { data, error } = await clientAdmin
        .from('profiles')
        .update({ role: 'bailleur', consent_apdp: true })
        .eq('id', profileIdB)
        .select('role, consent_apdp')
        .single();
      expect(error).toBeNull();
      expect(data?.role).toBe('bailleur');
      expect(data?.consent_apdp).toBe(true);
    });
  });

  describe('INSERT policies', () => {
    it('anon CANNOT insert profile directly', async () => {
      const { data, error } = await anonClient.from('profiles').insert({
        id: '00000000-0000-0000-0000-000000000000',
        email: 'hack@test.com',
        full_name: 'Hacker',
        role: 'admin',
        consent_apdp: true,
      });
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });
  });

  describe('DELETE policies', () => {
    it('user CANNOT delete own profile', async () => {
      const profileId = await getProfileId(clientA);
      const { data, error } = await clientA.from('profiles').delete().eq('id', profileId);
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('admin CANNOT delete profiles via RLS (use RPC instead)', async () => {
      const profileId = await getProfileId(clientA);
      const { data, error } = await clientAdmin.from('profiles').delete().eq('id', profileId);
      expect(error).toBeDefined();
    });
  });
});

import { createClient } from '@supabase/supabase-js';