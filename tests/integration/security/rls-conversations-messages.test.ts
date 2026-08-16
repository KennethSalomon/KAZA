import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { supabaseAnon, supabaseAdmin, createTestUser, signInTestUser, deleteTestUser, resetDatabase } from '../../helpers/supabase-test-client';
import { createClient } from '@supabase/supabase-js';

describe('RLS: conversations & messages tables', () => {
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

  async function setupConversation(landlord: any, tenant: any) {
    const residenceId = await createResidence(landlord);
    await supabaseAdmin.rpc('admin_moderate_residence', { p_residence_id: residenceId, p_action: 'approve' });
    const convId = await getClient(tenant).rpc('open_conversation', { p_residence_id: residenceId });
    return { residenceId, convId };
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

  describe('conversations SELECT', () => {
    it('tenant CAN see conversation they participate in', async () => {
      const { convId } = await setupConversation(landlordA, tenantA);
      const { data, error } = await getClient(tenantA).from('conversations').select('*').eq('id', convId).single();
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('landlord CAN see conversation they participate in', async () => {
      const { convId } = await setupConversation(landlordA, tenantA);
      const { data, error } = await getClient(landlordA).from('conversations').select('*').eq('id', convId).single();
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('tenant B CANNOT see conversation between tenant A and landlord', async () => {
      const { convId } = await setupConversation(landlordA, tenantA);
      const { data, error } = await getClient(tenantB).from('conversations').select('*').eq('id', convId).single();
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('landlord B CANNOT see conversation between tenant A and landlord A', async () => {
      const { convId } = await setupConversation(landlordA, tenantA);
      const { data, error } = await getClient(landlordB).from('conversations').select('*').eq('id', convId).single();
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('anon CANNOT see any conversation', async () => {
      const { convId } = await setupConversation(landlordA, tenantA);
      const { data, error } = await supabaseAnon.from('conversations').select('*').eq('id', convId).single();
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it('admin CAN see all conversations', async () => {
      const { convId } = await setupConversation(landlordA, tenantA);
      const { data, error } = await getClient(adminUser).from('conversations').select('*').eq('id', convId).single();
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('conversations INSERT', () => {
    it('tenant CAN open conversation via RPC (not direct insert)', async () => {
      const residenceId = await createResidence(landlordA);
      await supabaseAdmin.rpc('admin_moderate_residence', { p_residence_id: residenceId, p_action: 'approve' });
      const convId = await getClient(tenantA).rpc('open_conversation', { p_residence_id: residenceId });
      expect(convId).toBeDefined();
    });

    it('tenant CANNOT directly insert into conversations table', async () => {
      const residenceId = await createResidence(landlordA);
      await supabaseAdmin.rpc('admin_moderate_residence', { p_residence_id: residenceId, p_action: 'approve' });
      const { error } = await getClient(tenantA).from('conversations').insert({
        residence_id: residenceId,
        landlord_id: landlordA.user.id,
        tenant_id: tenantA.user.id,
      });
      expect(error).toBeDefined();
    });

    it('landlord CANNOT directly insert into conversations', async () => {
      const residenceId = await createResidence(landlordA);
      await supabaseAdmin.rpc('admin_moderate_residence', { p_residence_id: residenceId, p_action: 'approve' });
      const { error } = await getClient(landlordA).from('conversations').insert({
        residence_id: residenceId,
        landlord_id: landlordA.user.id,
        tenant_id: tenantA.user.id,
      });
      expect(error).toBeDefined();
    });
  });

  describe('messages SELECT', () => {
    it('participant CAN see messages in their conversation', async () => {
      const { convId } = await setupConversation(landlordA, tenantA);
      // Send a message first
      await getClient(tenantA).rpc('send_message', {
        p_conversation_id: convId,
        p_body: 'Hello landlord',
        p_kind: 'text',
      });
      const { data, error } = await getClient(tenantA).from('messages').select('*').eq('conversation_id', convId);
      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThan(0);
    });

    it('non-participant CANNOT see messages', async () => {
      const { convId } = await setupConversation(landlordA, tenantA);
      await getClient(tenantA).rpc('send_message', { p_conversation_id: convId, p_body: 'Hello', p_kind: 'text' });
      const { data, error } = await getClient(tenantB).from('messages').select('*').eq('conversation_id', convId);
      expect(error).toBeDefined();
      expect(data).toBeNull();
    });
  });

  describe('messages INSERT', () => {
    it('tenant CAN send message to their conversation', async () => {
      const { convId } = await setupConversation(landlordA, tenantA);
      const { error } = await getClient(tenantA).rpc('send_message', {
        p_conversation_id: convId,
        p_body: 'Test message',
        p_kind: 'text',
      });
      expect(error).toBeNull();
    });

    it('tenant CANNOT send message to conversation they are not in', async () => {
      const { convId } = await setupConversation(landlordA, tenantA);
      const { error } = await getClient(tenantB).rpc('send_message', {
        p_conversation_id: convId,
        p_body: 'Hack attempt',
        p_kind: 'text',
      });
      expect(error).toBeDefined();
    });

    it('sender_id spoofing is prevented', async () => {
      const { convId } = await setupConversation(landlordA, tenantA);
      const { error } = await getClient(tenantA).from('messages').insert({
        conversation_id: convId,
        sender_id: landlordA.user.id, // Spoofing!
        body: 'Fake message from landlord',
        kind: 'text',
      });
      expect(error).toBeDefined();
    });

    it('message kind is validated (no spoofing visit_agreed)', async () => {
      const { convId } = await setupConversation(landlordA, tenantA);
      const { error } = await getClient(tenantA).rpc('send_message', {
        p_conversation_id: convId,
        p_body: 'Fake visit confirmation',
        p_kind: 'visit_agreed',
      });
      // Should be rejected - only landlord via agree_visit can create visit_agreed
      expect(error).toBeDefined();
    });
  });

  describe('messages UPDATE/DELETE', () => {
    it('user CANNOT update messages', async () => {
      const { convId } = await setupConversation(landlordA, tenantA);
      await getClient(tenantA).rpc('send_message', { p_conversation_id: convId, p_body: 'Original', p_kind: 'text' });
      const { data: msgs } = await getClient(tenantA).from('messages').select('id').eq('conversation_id', convId);
      const msgId = msgs![0].id;
      const { error } = await getClient(tenantA).from('messages').update({ body: 'Hacked' }).eq('id', msgId);
      expect(error).toBeDefined();
    });

    it('user CANNOT delete messages', async () => {
      const { convId } = await setupConversation(landlordA, tenantA);
      await getClient(tenantA).rpc('send_message', { p_conversation_id: convId, p_body: 'To delete', p_kind: 'text' });
      const { data: msgs } = await getClient(tenantA).from('messages').select('id').eq('conversation_id', convId);
      const msgId = msgs![0].id;
      const { error } = await getClient(tenantA).from('messages').delete().eq('id', msgId);
      expect(error).toBeDefined();
    });
  });
});