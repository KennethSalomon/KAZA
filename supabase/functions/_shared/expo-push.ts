/**
 * Helpers purs pour l'envoi de notifications push via l'API Expo
 * (https://exp.host/--/api/v2/push/send).
 * Évite toute logique métier dans l'index.ts de l'edge function
 * afin de pouvoir tester unitairement le comportement.
 */

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: 'default';
  android: { channelId: string };
}

export interface PendingPushNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
}

/** Ticket renvoyé par l'API Expo pour chaque message envoyé. */
export interface ExpoPushTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string } | null;
}

/**
 * Erreurs Expo définitives : tenter de les renvoyer plus tard ne changera rien
 * (contenu trop grand, jeton mal formé, credential/configuration invalide...).
 * Elles doivent être marquées traitées pour stopper le retry toutes les minutes.
 */
export const PERMANENT_ERRORS: ReadonlySet<string> = new Set([
  'InvalidChannelId',
  'InvalidCredentials',
  'InvalidPushToken',
  'InvalidRegularPushToken',
  'InvalidToken',
  'InvalidTokenFormat',
  'MessageTooBig',
]);

/**
 * Erreurs indiquant que le jeton utilisé est invalide : le push_token du profil
 * doit être purgé en plus du marquage traité (l'appareil devra se ré-enregistrer).
 */
export const TOKEN_INVALID_ERRORS: ReadonlySet<string> = new Set([
  'DeviceNotRegistered',
  'InvalidPushToken',
  'InvalidRegularPushToken',
  'InvalidToken',
  'InvalidTokenFormat',
]);

/**
 * Construit les messages Expo à partir des notifications en attente et des
 * jetons connus. Les notifications dont le destinataire n'a pas de jeton sont
 * renvoyées dans `noTokenIds` (rien à envoyer → à marquer traitées).
 */
export function buildExpoMessages(
  notifications: PendingPushNotification[],
  tokenByUserId: Map<string, string>,
  channelId = 'default',
): { messages: ExpoPushMessage[]; noTokenIds: string[] } {
  const messages: ExpoPushMessage[] = [];
  const noTokenIds: string[] = [];

  for (const notification of notifications) {
    const token = tokenByUserId.get(notification.user_id);
    if (!token) {
      noTokenIds.push(notification.id);
      continue;
    }
    messages.push({
      to: token,
      title: notification.title,
      body: notification.body ?? notification.title,
      data: {
        ...(notification.data ?? {}),
        notificationId: notification.id,
        type: notification.type,
      },
      sound: 'default',
      android: { channelId },
    });
  }

  return { messages, noTokenIds };
}

/**
 * Classe les tickets Expo retournés par l'API en fonction des messages envoyés
 * (même ordre).
 *  - `okIds` : livrés → marquer push_sent_at + libérer le claim.
 *  - `deviceNotRegisteredIds` : appareil supprimé → marquer traité + purger le token.
 *  - `permanentIds` : erreur définitive (voir PERMANENT_ERRORS) → marquer traité,
 *    purger le token uniquement si l'erreur porte sur le jeton.
 *  - `retryIds` : erreur transitoire/inconnue → libérer le claim, push_sent_at
 *    reste NULL → le cron suivant retente.
 * `invalidTokens` : jetons à purger (appareils désenregistrés + jetons invalides).
 */
export function classifyExpoTickets(
  messages: ExpoPushMessage[],
  tickets: ExpoPushTicket[],
): {
  okIds: string[];
  deviceNotRegisteredIds: string[];
  permanentIds: string[];
  retryIds: string[];
  invalidTokens: string[];
} {
  const okIds: string[] = [];
  const deviceNotRegisteredIds: string[] = [];
  const permanentIds: string[] = [];
  const retryIds: string[] = [];
  const invalidTokens: string[] = [];

  for (let i = 0; i < messages.length; i++) {
    const notificationId = String(messages[i].data.notificationId ?? '');
    if (!notificationId) continue;

    const ticket = tickets[i];
    if (!ticket) {
      // Ticket manquant (réponse incomplète) : prudent de retenter.
      retryIds.push(notificationId);
      continue;
    }

    if (ticket.status === 'ok') {
      okIds.push(notificationId);
      continue;
    }

    const error = ticket.details?.error;
    if (!error) {
      // Erreur sans code détaillé : supposée transitoire (pas de drop prématuré).
      retryIds.push(notificationId);
      continue;
    }

    if (error === 'DeviceNotRegistered') {
      deviceNotRegisteredIds.push(notificationId);
      invalidTokens.push(messages[i].to);
      continue;
    }

    if (PERMANENT_ERRORS.has(error)) {
      permanentIds.push(notificationId);
      if (TOKEN_INVALID_ERRORS.has(error)) invalidTokens.push(messages[i].to);
      continue;
    }

    // Erreur inconnue : on ne la transforme pas en erreur permanente.
    retryIds.push(notificationId);
  }

  return { okIds, deviceNotRegisteredIds, permanentIds, retryIds, invalidTokens };
}