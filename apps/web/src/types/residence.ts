// note : Types du domaine Biens Immobiliers & Résidences KAZA
import type { Database } from '@/lib/database.types';

export type ResidenceStatus = Database['public']['Enums']['residence_status'];
export type ResidenceType = Database['public']['Enums']['residence_type'];
export type Residence = Database['public']['Tables']['residences']['Row'];
export type ResidenceInsert = Database['public']['Tables']['residences']['Insert'];
export type ResidenceUpdate = Database['public']['Tables']['residences']['Update'];

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

export type ResidenceInput = Database['public']['Tables']['residences']['Insert'];
export type ResidenceCreateInput = Omit<ResidenceInput, 'owner_id'>;
export type Status = ResidenceStatus;

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
