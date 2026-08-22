// Re-export database-generated types for application use
// DO NOT EDIT MANUALLY — this file derives from database.types.ts
// Run `npm run db:types` to regenerate the source

import type { Database } from './database.types';

export type Role = Database['public']['Enums']['user_role'];
export type ResidenceStatus = Database['public']['Enums']['residence_status'];
export type ResidenceType = Database['public']['Enums']['residence_type'];
export type LeaseStatus = Database['public']['Enums']['lease_status'];
export type PaymentMethod = Database['public']['Enums']['payment_method'];
export type PaymentProvider = Database['public']['Enums']['payment_provider'];
export type PaymentStatus = Database['public']['Enums']['payment_status'];
export type NotificationType = Database['public']['Enums']['notification_type'];
export type VisitStatus = 'proposed' | 'confirmed' | 'cancelled' | 'completed';

export type Profile = Database['public']['Tables']['profiles']['Row'];
// note : la colonne `charges_monthly` (migration 028) n'est pas encore présente
// dans database.types.ts (généré depuis la base). On l'ajoute manuellement en
// intersection pour bénéficier de l'auto-complétion et du strict TS. À supprimer
// après un `npm run db:types` post-migration.
type ResidenceExtraColumns = { charges_monthly?: number | null };

export type Residence = Database['public']['Tables']['residences']['Row'] & ResidenceExtraColumns;
export type Conversation = Database['public']['Tables']['conversations']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type Lease = Database['public']['Tables']['leases']['Row'];
export type Payment = Database['public']['Tables']['payments']['Row'];
export type Receipt = Database['public']['Tables']['receipts']['Row'];
export type AppNotification = Database['public']['Tables']['notifications']['Row'];

export interface Visit {
  id: string;
  conversation_id: string;
  proposed_by: string;
  confirmed_by: string | null;
  slot_start: string;
  slot_end: string;
  status: VisitStatus;
  note: string | null;
  created_at: string;
  confirmed_at: string | null;
}

// Extended types with relations (matching RPC return shapes)
export type ResidenceWithRelations = Residence & {
  distance_km?: number | null;
  rating_avg?: number | null;
  rating_count?: number;
  owner?: {
    id: string;
    full_name: string;
    phone: string | null;
    avatar_url: string | null;
    is_premium: boolean;
    is_verified_landlord: boolean;
  } | null;
};

export type ConversationWithRelations = Conversation & {
  residence: {
    id: string;
    title: string;
    photos: string[];
    price_monthly: number;
    city: string;
    zone: string | null;
  } | null;
  peer: {
    id: string;
    full_name: string;
    role: string;
    avatar_url: string | null;
  } | null;
  unread_count: number;
};

export type LeaseWithRelations = Lease & {
  residence?: ResidenceWithRelations | null;
  tenant?: Profile | null;
  landlord?: Profile | null;
  is_overdue?: boolean;
};

export type PaymentWithRelations = Payment & {
  lease?: { id: string; residence_id: string; monthly_rent: number; status: string } | null;
};

export type ReceiptWithRelations = Receipt & {
  landlord?: { id: string; full_name: string } | null;
};

export type MessageKind = Message['kind'];

export interface Review {
  id: string;
  residence_id: string;
  tenant_id: string;
  tenant_name?: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface ReviewsResult {
  average: number;
  count: number;
  reviews: Review[];
}

// Admin types
export interface AdminStats {
  users: {
    total: number;
    by_role: Record<string, number>;
  };
  residences: {
    total: number;
    by_status: Record<string, number>;
  };
  leases: {
    total: number;
  };
  payments: {
    confirmed_count: number;
    total_collected_xof: number;
  };
}

// Type aliases for backward compatibility (components expecting relations)
export type ResidenceInput = Database['public']['Tables']['residences']['Insert'] & ResidenceExtraColumns;
export type ResidenceCreateInput = Omit<ResidenceInput, 'owner_id'>;
export type Status = ResidenceStatus;