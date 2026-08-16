import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabaseAdmin, resetDatabase } from '../helpers/supabase-test-client';

describe('Migration regression tests', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
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
      const { data: residence, error: resError } = await supabaseAdmin.rpc('create_residence', {
        title: 'Draft Test',
        type: 'appartement',
        price_monthly: 100000,
        city: 'Cotonou',
        zone: 'Test',
      });
      expect(resError).toBeNull();

      const { error } = await supabaseAdmin.rpc('open_conversation', {
        p_residence_id: residence,
      });

      expect(error).toBeDefined();
      expect((error as any).message).toContain('Bien introuvable');
    });

    it('function rejects unverified residence', async () => {
      const { data: residence } = await supabaseAdmin.rpc('create_residence', {
        title: 'Unverified Test',
        type: 'appartement',
        price_monthly: 100000,
        city: 'Cotonou',
        zone: 'Test',
      });

      await supabaseAdmin.from('residences').update({ is_published: true }).eq('id', residence);

      const { error } = await supabaseAdmin.rpc('open_conversation', {
        p_residence_id: residence,
      });

      expect(error).toBeDefined();
      expect((error as any).message).toContain('Bien introuvable');
    });

    it('function allows published + verified residence', async () => {
      const { data: residence } = await supabaseAdmin.rpc('create_residence', {
        title: 'Verified Test',
        type: 'appartement',
        price_monthly: 100000,
        city: 'Cotonou',
        zone: 'Test',
      });

      await supabaseAdmin.from('residences').update({ is_published: true, is_verified: true }).eq('id', residence);

      const { data: { user: tenant } } = await supabaseAdmin.auth.admin.createUser({
        email: `tenant_test_${Date.now()}@kaza.test`,
        password: 'TestPass123!',
        email_confirm: true,
        user_metadata: { full_name: 'Test Tenant', role: 'locataire', consent_apdp: true },
      });

      const { data: convId, error } = await supabaseAdmin.rpc('open_conversation', {
        p_residence_id: residence,
      });

      expect(error).toBeNull();
      expect(convId).toBeDefined();

      await supabaseAdmin.auth.admin.deleteUser(tenant.id);
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
      const { error } = await supabaseAdmin.rpc('set_my_role', { p_role: 'admin' });
      expect(error).toBeDefined();
    });

    it('function accepts locataire', async () => {
      const { error } = await supabaseAdmin.rpc('set_my_role', { p_role: 'locataire' });
      expect(error).toBeNull();
    });

    it('function accepts bailleur', async () => {
      const { error } = await supabaseAdmin.rpc('set_my_role', { p_role: 'bailleur' });
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