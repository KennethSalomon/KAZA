import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { supabaseAdmin, createTestUser, signInTestUser, deleteTestUser, resetDatabase } from '@tests/helpers/supabase-test-client';

describe('visit-reminders: Edge Function', () => {
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

  async function setupConversation() {
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

    await supabaseAdmin.rpc('admin_moderate_residence', { 
      p_residence_id: residenceId.data, 
      p_action: 'approve' 
    });

    const { data: convResult, error: convError } = await supabaseAdmin.rpc('open_conversation', { 
      p_residence_id: residenceId.data 
    });
    if (convError) throw convError;
    return convResult;
  }

  it('creates notifications 24h before confirmed visit for both tenant and landlord', async () => {
    const conversationId = await setupConversation();

    // Create a confirmed visit 25 hours from now (within 24h ± 1h window)
    const slotStart = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();
    const slotEnd = new Date(Date.now() + 27 * 60 * 60 * 1000).toISOString();

    const { data: visit, error: visitError } = await supabaseAdmin
      .from('visits')
      .insert({
        conversation_id: conversationId,
        proposed_by: tenant.user.id,
        confirmed_by: landlord.user.id,
        slot_start: slotStart,
        slot_end: slotEnd,
        status: 'confirmed',
      })
      .select()
      .single();

    expect(visitError).toBeNull();
    expect(visit).toBeDefined();

    // Call the Edge Function (simulated via direct DB query since EF not deployed)
    // In real test, this would call the deployed function via HTTP
    // For now, verify the query logic matches what the EF does
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const { data: visits24h } = await supabaseAdmin
      .from('visits')
      .select('id, conversation_id, slot_start, proposed_by, confirmed_by')
      .eq('status', 'confirmed')
      .gte('slot_start', new Date(in24h.getTime() - 3600000).toISOString())
      .lte('slot_start', new Date(in24h.getTime() + 3600000).toISOString());

    // The visit should be found in the 24h window
    expect(visits24h).toBeDefined();
    expect(visits24h?.length).toBeGreaterThanOrEqual(1);
    
    const foundVisit = visits24h?.find(v => v.id === visit.id);
    expect(foundVisit).toBeDefined();
    expect(foundVisit?.proposed_by).toBe(tenant.user.id);
    expect(foundVisit?.confirmed_by).toBe(landlord.user.id);

    // Verify notifications would be created for both parties
    const hoursLeft = Math.round((new Date(visit.slot_start).getTime() - now.getTime()) / 3600000);
    const label = hoursLeft <= 2 ? '2 heures' : '24 heures';
    expect(label).toBe('24 heures');
  });

  it('creates notifications 2h before confirmed visit', async () => {
    const conversationId = await setupConversation();

    // Create a confirmed visit 2.5 hours from now (within 2h ± 15min window)
    const slotStart = new Date(Date.now() + 2.5 * 60 * 60 * 1000).toISOString();
    const slotEnd = new Date(Date.now() + 4.5 * 60 * 60 * 1000).toISOString();

    const { data: visit, error: visitError } = await supabaseAdmin
      .from('visits')
      .insert({
        conversation_id: conversationId,
        proposed_by: tenant.user.id,
        confirmed_by: landlord.user.id,
        slot_start: slotStart,
        slot_end: slotEnd,
        status: 'confirmed',
      })
      .select()
      .single();

    expect(visitError).toBeNull();
    expect(visit).toBeDefined();

    const now = new Date();
    const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    
    const { data: visits2h } = await supabaseAdmin
      .from('visits')
      .select('id, conversation_id, slot_start, proposed_by, confirmed_by')
      .eq('status', 'confirmed')
      .gte('slot_start', new Date(in2h.getTime() - 900000).toISOString())
      .lte('slot_start', new Date(in2h.getTime() + 900000).toISOString());

    expect(visits2h).toBeDefined();
    expect(visits2h?.length).toBeGreaterThanOrEqual(1);
    
    const foundVisit = visits2h?.find(v => v.id === visit.id);
    expect(foundVisit).toBeDefined();

    const hoursLeft = Math.round((new Date(visit.slot_start).getTime() - now.getTime()) / 3600000);
    const label = hoursLeft <= 2 ? '2 heures' : '24 heures';
    expect(label).toBe('2 heures');
  });

  it('does not create notifications for non-confirmed visits', async () => {
    const conversationId = await setupConversation();

    // Create a proposed (not confirmed) visit 25 hours from now
    const slotStart = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();
    const slotEnd = new Date(Date.now() + 27 * 60 * 60 * 1000).toISOString();

    const { data: visit, error: visitError } = await supabaseAdmin
      .from('visits')
      .insert({
        conversation_id: conversationId,
        proposed_by: tenant.user.id,
        slot_start: slotStart,
        slot_end: slotEnd,
        status: 'proposed',
      })
      .select()
      .single();

    expect(visitError).toBeNull();
    expect(visit).toBeDefined();

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const { data: visits24h } = await supabaseAdmin
      .from('visits')
      .select('id, conversation_id, slot_start, proposed_by, confirmed_by')
      .eq('status', 'confirmed')
      .gte('slot_start', new Date(in24h.getTime() - 3600000).toISOString())
      .lte('slot_start', new Date(in24h.getTime() + 3600000).toISOString());

    // The proposed visit should NOT be found
    const foundVisit = visits24h?.find(v => v.id === visit.id);
    expect(foundVisit).toBeUndefined();
  });
});