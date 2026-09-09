// note : Types du domaine Baux & Contrats de Location KAZA
import type { Database } from '@/lib/database.types';
import type { ResidenceWithRelations } from './residence';
import type { Profile } from './user';

export type LeaseStatus = Database['public']['Enums']['lease_status'];
export type Lease = Database['public']['Tables']['leases']['Row'];
export type LeaseInsert = Database['public']['Tables']['leases']['Insert'];
export type LeaseUpdate = Database['public']['Tables']['leases']['Update'];

export type LeaseWithRelations = Lease & {
  residence?: ResidenceWithRelations | null;
  tenant?: Profile | null;
  landlord?: Profile | null;
  is_overdue?: boolean;
};

export interface LeaseCreateDTO {
  residence_id: string;
  tenant_id: string;
  start_date: string;
  end_date?: string;
  monthly_rent: number;
  deposit: number;
}
