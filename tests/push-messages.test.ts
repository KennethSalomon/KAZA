import { describe, it, expect } from 'vitest';
import {
  buildExpoMessages,
  classifyExpoTickets,
  PERMANENT_ERRORS,
  TOKEN_INVALID_ERRORS,
  type ExpoPushMessage,
  type PendingPushNotification,
} from '../supabase/functions/_shared/expo-push';

const notif = (overrides: Partial<PendingPushNotification> = {}): PendingPushNotification => ({
  id: '00000000-0000-0000-0000-000000000001',
  user_id: '11111111-1111-1111-1111-111111111111',
  type: 'payment',
  title: 'Paiement confirmé',
  body: 'Quittance disponible',
  data: { lease_id: 'aaa' },
  ...overrides,
});

describe('buildExpoMessages', () => {
  it('builds one Expo message per notification with a token', () => {
    const { messages, noTokenIds } = buildExpoMessages(
      [notif()],
      new Map([['11111111-1111-1111-1111-111111111111', 'ExponentPushToken[abc]']]),
    );
    expect(noTokenIds).toEqual([]);
    expect(messages).toHaveLength(1);
    const m = messages[0];
    expect(m.to).toBe('ExponentPushToken[abc]');
    expect(m.title).toBe('Paiement confirmé');
    expect(m.body).toBe('Quittance disponible');
    expect(m.sound).toBe('default');
    expect(m.android?.channelId).toBe('default');
    expect(m.data.notificationId).toBe(notif().id);
    expect(m.data.type).toBe('payment');
    expect(m.data.lease_id).toBe('aaa');
  });

  it('marks notifications without a token as noToken (nothing to send)', () => {
    const a = notif({ id: 'aaa', user_id: 'u1' });
    const b = notif({ id: 'bbb', user_id: 'u2' });
    const { messages, noTokenIds } = buildExpoMessages(
      [a, b],
      new Map([['u2', 'ExponentPushToken[only-u2]']]),
    );
    expect(noTokenIds).toEqual(['aaa']);
    expect(messages).toHaveLength(1);
    expect(messages[0].to).toBe('ExponentPushToken[only-u2]');
  });

  it('falls back to title when body is null', () => {
    const { messages } = buildExpoMessages(
      [notif({ body: null })],
      new Map([['11111111-1111-1111-1111-111111111111', 'ExponentPushToken[abc]']]),
    );
    expect(messages[0].body).toBe('Paiement confirmé');
  });

  it('uses the channel override passed by the caller', () => {
    const { messages } = buildExpoMessages(
      [notif()],
      new Map([['11111111-1111-1111-1111-111111111111', 'ExponentPushToken[abc]']]),
      'priority',
    );
    expect(messages[0].android?.channelId).toBe('priority');
  });

  it('never lets notification.data override the system notificationId/type envelope', () => {
    const { messages } = buildExpoMessages(
      [
        notif({
          data: { notificationId: 'attacker-id', type: 'attacker-type', custom_field: 'kept' },
        }),
      ],
      new Map([['11111111-1111-1111-1111-111111111111', 'ExponentPushToken[abc]']]),
    );
    const data = messages[0].data;
    expect(data.notificationId).toBe(notif().id);
    expect(data.type).toBe('payment');
    expect(data.custom_field).toBe('kept');
  });
});

describe('classifyExpoTickets — ok / DeviceNotRegistered', () => {
  const mk = (id: string): ExpoPushMessage => ({
    to: 'ExponentPushToken[tok]',
    title: 't',
    body: 'b',
    data: { notificationId: id },
    sound: 'default',
    android: { channelId: 'default' },
  });

  it('marks ok tickets as sent', () => {
    const result = classifyExpoTickets([mk('n1')], [{ status: 'ok' }]);
    expect(result.okIds).toEqual(['n1']);
    expect(result.permanentIds).toEqual([]);
    expect(result.deviceNotRegisteredIds).toEqual([]);
    expect(result.retryIds).toEqual([]);
    expect(result.invalidTokens).toEqual([]);
  });

  it('clears tokens for DeviceNotRegistered and marks handled', () => {
    const result = classifyExpoTickets([mk('n1')], [
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
    ]);
    expect(result.deviceNotRegisteredIds).toEqual(['n1']);
    expect(result.invalidTokens).toEqual(['ExponentPushToken[tok]']);
    expect(result.okIds).toEqual([]);
    expect(result.permanentIds).toEqual([]);
    expect(result.retryIds).toEqual([]);
  });

  it('treats missing tickets as retry', () => {
    const result = classifyExpoTickets([mk('n1'), mk('n2')], [{ status: 'ok' }]);
    expect(result.retryIds).toEqual(['n2']);
  });
});

describe('classifyExpoTickets — permanent errors', () => {
  const mk = (id: string): ExpoPushMessage => ({
    to: 'ExponentPushToken[tok]',
    title: 't',
    body: 'b',
    data: { notificationId: id },
    sound: 'default',
    android: { channelId: 'default' },
  });

  it('marks MessageTooBig as permanent WITHOUT purging the token', () => {
    const result = classifyExpoTickets([mk('n1')], [
      { status: 'error', details: { error: 'MessageTooBig' } },
    ]);
    expect(result.permanentIds).toEqual(['n1']);
    expect(result.retryIds).toEqual([]);
    expect(result.invalidTokens).toEqual([]);
  });

  it('marks InvalidTokenFormat as permanent AND purges the token', () => {
    const result = classifyExpoTickets([mk('n1')], [
      { status: 'error', details: { error: 'InvalidTokenFormat' } },
    ]);
    expect(result.permanentIds).toEqual(['n1']);
    expect(result.invalidTokens).toEqual(['ExponentPushToken[tok]']);
    expect(result.retryIds).toEqual([]);
  });

  it('treats InvalidToken as permanent AND purges the token', () => {
    const result = classifyExpoTickets([mk('n1')], [
      { status: 'error', details: { error: 'InvalidToken' } },
    ]);
    expect(result.permanentIds).toEqual(['n1']);
    expect(result.invalidTokens).toEqual(['ExponentPushToken[tok]']);
  });

  it('lists all known permanent error codes, distinct from token-invalid codes', () => {
    expect(PERMANENT_ERRORS.has('MessageTooBig')).toBe(true);
    expect(PERMANENT_ERRORS.has('InvalidCredentials')).toBe(true);
    expect(PERMANENT_ERRORS.has('InvalidChannelId')).toBe(true);
    expect(PERMANENT_ERRORS.has('DeviceNotRegistered')).toBe(false);
    expect(TOKEN_INVALID_ERRORS.has('DeviceNotRegistered')).toBe(true);
    // Toute erreur "jeton invalide" est aussi une erreur permanente.
    for (const code of TOKEN_INVALID_ERRORS) {
      if (code !== 'DeviceNotRegistered') expect(PERMANENT_ERRORS.has(code)).toBe(true);
    }
  });
});

describe('classifyExpoTickets — transient errors', () => {
  const mk = (id: string): ExpoPushMessage => ({
    to: 'ExponentPushToken[tok]',
    title: 't',
    body: 'b',
    data: { notificationId: id },
    sound: 'default',
    android: { channelId: 'default' },
  });

  it('keeps unknown errors as retry (not downgraded to permanent)', () => {
    const result = classifyExpoTickets([mk('n1')], [
      { status: 'error', details: { error: 'SomeUnknownCode' } },
    ]);
    expect(result.retryIds).toEqual(['n1']);
    expect(result.permanentIds).toEqual([]);
    expect(result.invalidTokens).toEqual([]);
  });

  it('keeps errors without details as retry', () => {
    const result = classifyExpoTickets([mk('n1')], [{ status: 'error' }]);
    expect(result.retryIds).toEqual(['n1']);
    expect(result.permanentIds).toEqual([]);
  });
});