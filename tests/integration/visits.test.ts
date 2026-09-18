import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { supabaseAnon, supabaseAdmin, createTestUser, signInTestUser, deleteTestUser, resetDatabase } from '../helpers/supabase-test-client';
import { createClient } from '@supabase/supabase-js';
import { proposeVisit } from '@/lib/supabase-api';
import { supabase as appSupabase } from '@/lib/supabase-client';

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
      u.session = signIn.session;
    }
  });

  afterAll(async () => {
    // Le singleton frontend du test porte la session du locataire :
    // la nettoyer pour ne pas polluer d'autres suites du meme process.
    await appSupabase.auth.signOut().catch(() => {});
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

  async function setupConversation() {
    const residenceId = await createPublishedVerifiedResidence(landlord.user.id);

    await supabaseAdmin.rpc('admin_moderate_residence', { 
      p_residence_id: residenceId, 
      p_action: 'approve' 
    });

    const clientTenant = getClient(tenant);
    const { data: convId, error } = await clientTenant.rpc('open_conversation', { 
      p_residence_id: residenceId 
    });
    if (error) throw error;
    return convId;
  }

  async function createPublishedVerifiedResidence(ownerId: string): Promise<string> {
    const { data, error } = await supabaseAdmin.from('residences').insert({
      owner_id: ownerId,
      title: `Test Residence ${Date.now()}`,
      description: 'Test',
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

  describe('INSERT policies', () => {
    it('tenant CAN insert visit (proposed status)', async () => {
      const clientTenant = getClient(tenant);
      const conversationId = await setupConversation();

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

  describe('RPC: confirm_visit', () => {
    it('landlord confirms slot', async () => {
      const clientLandlord = getClient(landlord);
      const conversationId = await setupConversation();

      // Create a proposed visit directly
      const { data: visit, error: visitError } = await supabaseAdmin
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

      expect(visitError).toBeNull();
      expect(visit).toBeDefined();

      // Landlord confirms the visit
      const { error: confirmError } = await clientLandlord.rpc('confirm_visit', {
        p_visit_id: visit.id,
        p_slot_index: 0,
      });

      expect(confirmError).toBeNull();

      // Verify visit is confirmed
      const { data: confirmedVisit, error: selectError } = await supabaseAdmin
        .from('visits')
        .select('status, confirmed_by')
        .eq('id', visit.id)
        .single();

      expect(selectError).toBeNull();
      expect(confirmedVisit?.status).toBe('confirmed');
      expect(confirmedVisit?.confirmed_by).toBe(landlord.user.id);
    });
  });

  describe('API: proposeVisit', () => {
    it('proposeVisit API', async () => {
      const conversationId = await setupConversation();

      // proposeVisit() passe par requireUser() qui lit la session du
      // singleton frontend (@/lib/supabase-client). On y installe la
      // VRAIE session Supabase du locataire (token réel, vrai RLS) —
      // aucun mock, aucun bypass.
      const { error: sessionError } = await appSupabase.auth.setSession({
        access_token: tenant.session.access_token,
        refresh_token: tenant.session.refresh_token,
      });
      expect(sessionError).toBeNull();

      try {
        const visitId = await proposeVisit(conversationId, [{ start: '2026-08-20T14:00:00Z', end: '2026-08-20T16:00:00Z' }]);
        expect(visitId).toBeDefined();
      } finally {
        // Ne pas laisser la session dans le singleton pour les tests suivants.
        await appSupabase.auth.signOut().catch(() => {});
      }
    });
  });
});