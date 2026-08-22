import { supabase } from '../supabase-client';
import type {
  ConversationWithRelations,
  Message,
  Visit,
} from '../types';
import { normalizeError, getSignedStorageUrl } from '../supabase-api';

const STORAGE_MAX = 8 * 1024 * 1024;

export async function openConversation(residenceId: string): Promise<string> {
  const { data, error } = await supabase.rpc('open_conversation', {
    p_residence_id: residenceId,
  });
  if (error) throw normalizeError(error, 'Ouverture de la conversation impossible');
  return data as string;
}

export async function listMyConversations(): Promise<ConversationWithRelations[]> {
  const { data, error } = await supabase.rpc('list_my_conversations');
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as unknown as ConversationWithRelations[];
}

export async function getConversation(id: string): Promise<ConversationWithRelations | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw normalizeError(error, 'Conversation introuvable');
  return data as ConversationWithRelations | null;
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as Message[];
}

export async function sendMessage(
  conversationId: string,
  input: { body: string | null; kind?: Message['kind']; attachments?: string[] },
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Connectez-vous pour envoyer un message');
  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body: input.body,
    kind: input.kind ?? 'text',
    attachments: input.attachments ?? [],
  });
  if (error) throw normalizeError(error, 'Envoi impossible');
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', user.id)
    .is('read_at', null);
}

export async function agreeVisit(
  conversationId: string,
  agreed: boolean,
  note = '',
): Promise<void> {
  const { error } = await supabase.rpc('agree_visit', {
    p_conversation_id: conversationId,
    p_agreed: agreed,
    p_note: note,
  });
  if (error) throw normalizeError(error, 'Action impossible');
}

export async function proposeVisit(
  conversationId: string,
  slots: { start: string; end: string }[]
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Connectez-vous');
  const visitPromises = slots.map(slot =>
    supabase.from('visits').insert({
      conversation_id: conversationId,
      proposed_by: user.id,
      slot_start: slot.start,
      slot_end: slot.end,
      status: 'proposed',
    }).select('id').single()
  );
  const results = await Promise.all(visitPromises);
  const first = results[0];
  if (first.error) throw normalizeError(first.error, 'Proposition impossible');
  return first.data.id;
}

export async function listVisits(conversationId: string): Promise<Visit[]> {
  const { data, error } = await supabase
    .from('visits')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false });
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as Visit[];
}

export async function listMyVisits(): Promise<Visit[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('visits')
    .select('*')
    .or(`proposed_by.eq.${user.id},confirmed_by.eq.${user.id}`)
    .order('created_at', { ascending: false });
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as Visit[];
}

export async function uploadChatFile(userId: string, file: File): Promise<string> {
  if (file.size > STORAGE_MAX) {
    throw new Error('Fichier trop volumineux (max 8 Mo)');
  }
  const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
  const { error } = await supabase.storage.from('chat-files').upload(path, file, {
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

export async function getSignedChatUrl(path: string): Promise<string | null> {
  return getSignedStorageUrl('chat-files', path);
}