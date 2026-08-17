import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabaseAdmin, createTestUser, signInTestUser, deleteTestUser, resetDatabase } from '../../helpers/supabase-test-client';
import { createClient } from '@supabase/supabase-js';

describe('Migration regression tests', () => {
  let landlord: { user: any; email: string; password: string };
  let tenant: { user: any; email: string; password: string };
  let landlordClient: ReturnType<typeof createClient>;
  let tenantClient: ReturnType<typeof createClient>;

  beforeAll(async () => {
    await resetDatabase();
    landlord = await createTestUser('bailleur');
    tenant = await createTestUser('locataire');

    const signInLandlord = await signInTestUser(landlord.email, landlord.password);
    const signInTenant = await signInTestUser(tenant.email, tenant.password);

    landlordClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${signInLandlord.session?.access_token}` } },
    });
    tenantClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${signInTenant.session?.access_token}` } },
    });
  });

  afterAll(async () => {
    await resetDatabase();
    if (landlord) await deleteTestUser(landlord.user.id);
    if (tenant) await deleteTestUser(tenant.user.id);
  });

  describe('open_conversation() guard must exist', () => {
    it('function body contains is_published = true AND is_verified = true', async () => {
      const { data, error } = await supabaseAdmin.rpc('get_function_source', {
        p_function_name: 'open_conversation',
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      const source = data as string;
      expect(source).toContain('is_published = true');
      expect(source).toContain('is_verified = true');
      expect(source).toContain('and is_verified = true');
    });

    it('function rejects draft residence', async () => {
      const { data: residence, error: resError } = await landlordClient.rpc('create_residence', {
        title: 'Draft Test',
        type: 'appartement',
        price_monthly: 100000,
        city: 'Cotonou',
        zone: 'Test',
      });
      expect(resError).toBeNull();

      const { error } = await tenantClient.rpc('open_conversation', {
        p_residence_id: residence,
      });

      expect(error).toBeDefined();
      expect((error as any).message).toContain('Bien introuvable');
    });

    it('function rejects unverified residence', async () => {
      const { data: residence } = await landlordClient.rpc('create_residence', {
        title: 'Unverified Test',
        type: 'appartement',
        price_monthly: 100000,
        city: 'Cotonou',
        zone: 'Test',
      });

      await supabaseAdmin.from('residences').update({ is_published: true }).eq('id', residence);

      const { error } = await tenantClient.rpc('open_conversation', {
        p_residence_id: residence,
      });

      expect(error).toBeDefined();
      expect((error as any).message).toContain('Bien introuvable');
    });

    it('function allows published + verified residence', async () => {
      const { data: residence } = await landlordClient.rpc('create_residence', {
        title: 'Verified Test',
        type: 'appartement',
        price_monthly: 100000,
        city: 'Cotonou',
        zone: 'Test',
      });

      await supabaseAdmin.from('residences').update({ is_published: true, is_verified: true }).eq('id', residence);

      const { data: convId, error } = await tenantClient.rpc('open_conversation', {
        p_residence_id: residence,
      });

      expect(error).toBeNull();
      expect(convId).toBeDefined();
    });
  });

  describe('is_admin() function integrity', () => {
    it('function exists and is SECURITY DEFINER', async () => {
      const { data, error } = await supabaseAdmin.rpc('get_function_source', {
        p_function_name: 'is_admin',
      });
      expect(error).toBeNull();
      const source = data as string;
      expect(source).toContain('SECURITY DEFINER');
      expect(source).toContain("role = 'admin'");
    });
  });

  describe('set_my_role() function integrity', () => {
    it('function rejects admin role', async () => {
      const { error } = await tenantClient.rpc('set_my_role', { p_role: 'admin' });
      expect(error).toBeDefined();
    });

    it('function accepts locataire', async () => {
      const { error } = await tenantClient.rpc('set_my_role', { p_role: 'locataire' });
      expect(error).toBeNull();
    });

    it('function accepts bailleur', async () => {
      const { error } = await landlordClient.rpc('set_my_role', { p_role: 'bailleur' });
      expect(error).toBeNull();
    });
  });

  describe('handle_new_user() trigger integrity', () => {
    it('function exists and sets default role to visiteur', async () => {
      const { data, error } = await supabaseAdmin.rpc('get_function_source', {
        p_function_name: 'handle_new_user',
      });
      expect(error).toBeNull();
      const source = data as string;
      expect(source).toContain('visiteur');
      expect(source).toContain('consent_apdp');
    });
  });
});
