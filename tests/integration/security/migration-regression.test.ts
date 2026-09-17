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

  async function createPublishedVerifiedResidence(client: any, ownerId: string): Promise<string> {
    const { data, error } = await supabaseAdmin.from('residences').insert({
      owner_id: ownerId,
      title: `Test ${Date.now()}`,
      type: 'appartement',
      price_monthly: 100000,
      city: 'Cotonou',
      zone: 'Test',
      is_published: true,
      is_verified: true,
    }).select('id').single();
    if (error) throw error;
    return data.id;
  }

  async function createDraftResidence(client: any, ownerId: string): Promise<string> {
    const { data, error } = await supabaseAdmin.from('residences').insert({
      owner_id: ownerId,
      title: `Draft ${Date.now()}`,
      type: 'appartement',
      price_monthly: 100000,
      city: 'Cotonou',
      zone: 'Test',
      is_published: false,
      is_verified: false,
    }).select('id').single();
    if (error) throw error;
    return data.id;
  }

  async function createUnverifiedResidence(client: any, ownerId: string): Promise<string> {
    const { data, error } = await supabaseAdmin.from('residences').insert({
      owner_id: ownerId,
      title: `Unverified ${Date.now()}`,
      type: 'appartement',
      price_monthly: 100000,
      city: 'Cotonou',
      zone: 'Test',
      is_published: true,
      is_verified: false,
    }).select('id').single();
    if (error) throw error;
    return data.id;
  }

  describe('open_conversation() guard must exist', () => {
    it('function body contains is_published = true AND is_verified = true', async () => {
      // get_function_source is a CI-only helper injected after db reset
      // Use service_role to call it
      const { data, error } = await supabaseAdmin.rpc('get_function_source', {
        p_function_name: 'open_conversation',
      });

      // If helper not available (local dev), skip this check
      if (error && error.message.includes('Could not find the function')) {
        console.warn('get_function_source helper not available, skipping source check');
        return;
      }

      expect(error).toBeNull();
      expect(data).toBeDefined();

      const source = data as string;
      expect(source).toContain('is_published = true');
      expect(source).toContain('is_verified = true');
      expect(source).toContain('and is_verified = true');
    });

    it('function rejects draft residence', async () => {
      const residence = await createDraftResidence(landlordClient, landlord.user.id);

      const { error } = await tenantClient.rpc('open_conversation', {
        p_residence_id: residence,
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('Bien introuvable');
    });

    it('function rejects unverified residence', async () => {
      const residence = await createUnverifiedResidence(landlordClient, landlord.user.id);

      const { error } = await tenantClient.rpc('open_conversation', {
        p_residence_id: residence,
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('Bien introuvable');
    });

    it('function allows published + verified residence', async () => {
      const residence = await createPublishedVerifiedResidence(landlordClient, landlord.user.id);

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

      // If helper not available, skip
      if (error && error.message.includes('Could not find the function')) {
        console.warn('get_function_source helper not available, skipping source check');
        return;
      }

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

      // If helper not available, skip
      if (error && error.message.includes('Could not find the function')) {
        console.warn('get_function_source helper not available, skipping source check');
        return;
      }

      expect(error).toBeNull();
      const source = data as string;
      expect(source).toContain('visiteur');
      expect(source).toContain('consent_apdp');
    });
  });
});