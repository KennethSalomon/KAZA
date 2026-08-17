import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { supabaseAnon, supabaseAdmin, createTestUser, signInTestUser, deleteTestUser, resetDatabase } from '../../helpers/supabase-test-client';
import { createClient } from '@supabase/supabase-js';

describe('Visits: table & RLS', () => {
  let landlord: any;
  let tenant: any;

  beforeAll(async () => {
    await resetDatabase();
    landlord = await createTestUser('bailleur');
    tenant = await createTestUser('locataire');

    for (const u of [landlord, tenant]) {
      const signIn = await signInTestUser(u.email, u.password);
      u.token = signIn.session?.access_token ?? '';
    }
  });

  afterAll(async () => {
    await deleteTestUser(landlord.user.id);
    await deleteTestUser(tenant.user.id);
  });

  beforeEach(async () => {
    await resetDatabase();
    for (const u of [landlord, tenant]) {
      const signIn = await signInTestUser(u.email, u.password);
      u.token = signIn.session?.access_token ?? '';
    }
  });

  function getClient(user: any) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${user.token}` } } }
    );
  }

  describe('INSERT policies', () => {
    it('tenant CAN insert visit (proposed status)', async () => {
      const clientTenant = getClient(tenant);
      
      // First create a conversation (need residence -> conversation)
      const residenceId = await supabaseAdmin.rpc('create_residence', {
        title: 'Test Residence',
        description: 'Test',
        type: 'appartement',
        price_monthly: 100000,
        deposit: 200000,
        bedrooms: 2,
        bathrooms: 1,
        city: 'Cotonou',
        zone: 'Haie Vive',
      });
      if (residenceId.error) throw residenceId.error;

      // Admin approves it
      await supabaseAdmin.rpc('admin_moderate_residence', { 
        p_residence_id: residenceId.data, 
        p_action: 'approve' 
      });

      // Tenant opens conversation
      const convResult = await clientTenant.rpc('open_conversation', { 
        p_residence_id: residenceId.data 
      });
      if (convResult.error) throw convResult.error;
      const conversationId = convResult.data;

      // NOW THE ACTUAL TEST: tenant inserts a visit
      const { data, error } = await clientTenant
        .from('visits')
        .insert({
          conversation_id: conversationId,
          proposed_by: tenant.user.id,
          slot_start: '2026-08-20 14:00:00+00',
          slot_end: '2026-08-20 16:00:00+00',
          status: 'proposed',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.conversation_id).toBe(conversationId);
      expect(data?.proposed_by).toBe(tenant.user.id);
      expect(data?.status).toBe('proposed');
    });
  });
});