export type Role = 'visiteur' | 'locataire' | 'bailleur' | 'admin';
export type Status = 'libre' | 'occupee' | 'en_visite' | 'maintenance';
export type ResidenceType = 'studio' | 'chambre' | 'appartement' | 'villa' | 'magasin' | 'terrain';

export interface Profile {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  role: Role;
  avatar_url: string | null;
  is_premium: boolean;
  consent_apdp: boolean;
}

export interface Residence {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  type: ResidenceType;
  price_monthly: number;
  deposit: number;
  bedrooms: number;
  bathrooms: number;
  surface: number | null;
  address: string | null;
  city: string;
  zone: string | null;
  lat: number | null;
  lng: number | null;
  photos: string[];
  status: Status;
  is_published: boolean;
  is_verified: boolean;
  views_count: number;
  created_at: string;
  distance_km?: number | null;
  owner?: { id: string; full_name: string; phone: string | null; avatar_url: string | null; is_premium: boolean } | null;
}

export interface Conversation {
  id: string;
  residence_id: string;
  landlord_id: string;
  tenant_id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  residence: { id: string; title: string; photos: string[]; price_monthly: number; city: string; zone: string } | null;
  peer: { id: string; full_name: string; role: string; avatar_url: string | null } | null;
  unread_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  attachments: string[];
  kind: 'text' | 'image' | 'document' | 'visit_request' | 'visit_agreed' | 'system';
  read_at: string | null;
  created_at: string;
}

export interface Lease {
  id: string;
  residence_id: string;
  tenant_id: string;
  landlord_id: string;
  monthly_rent: number;
  deposit: number;
  start_date: string;
  end_date: string | null;
  status: 'active' | 'terminated' | 'pending';
  date_fn_couverture: string;
  created_at: string;
  residence?: Residence | null;
  tenant?: Profile | null;
  landlord?: Profile | null;
  is_overdue?: boolean;
}

export interface Payment {
  id: string;
  lease_id: string;
  tenant_id: string;
  landlord_id: string;
  amount: number;
  period_start: string;
  period_end: string;
  method: 'mobile_money' | 'cash';
  provider: 'mtn' | 'moov' | 'celtiis' | 'cash';
  provider_ref: string | null;
  status: 'pending' | 'confirmed' | 'rejected';
  created_at: string;
  lease?: { id: string; residence_id: string; monthly_rent: number; status: string } | null;
}

export interface Receipt {
  id: string;
  payment_id: string;
  lease_id: string;
  tenant_id: string;
  landlord_id: string;
  amount: number;
  period_start: string;
  period_end: string;
  file_url: string | null;
  signature_hash: string | null;
  signed_at: string | null;
  status: 'pending_signature' | 'signed';
  created_at: string;
  landlord?: { id: string; full_name: string } | null;
}

export interface AppNotification {
  id: string;
  type: 'message' | 'payment' | 'receipt' | 'lease' | 'overdue' | 'system' | 'visit';
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}