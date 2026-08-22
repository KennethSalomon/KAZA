// Barrel export — API KAZA.BJ découpée par domaine
// Importe depuis les modules spécialisés pour maintenir la compatibilité

export * from './auth';
export * from './payments';
export * from './chat';
export * from './residences';
export * from './admin';
export * from './notifications';
export * from './storage';
export * from './leases';
export * from './account';

// Types ré-exportés pour compatibilité
export type {
  Profile,
  Residence,
  ResidenceCreateInput,
  ResidenceWithRelations,
  ResidenceType,
  PaymentWithRelations,
  ReceiptWithRelations,
  LeaseWithRelations,
  ConversationWithRelations,
  Message,
  Visit,
  AppNotification,
  ReviewsResult,
} from '../types';

export { ApiError, normalizeError, callFunction } from '../supabase-api';