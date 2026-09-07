import type { Database } from '../database.types';

export type Role = Database['public']['Enums']['user_role'];

type LandlordBillingColumns = {
  business_name?: string | null;
  tax_id?: string | null;
  momo_provider?: 'mtn' | 'moov' | 'celtiis' | null;
  momo_number?: string | null;
  bank_name?: string | null;
  bank_iban?: string | null;
  onboarding_completed?: boolean;
  is_verified_landlord?: boolean;
};

export type Profile = Database['public']['Tables']['profiles']['Row'] & LandlordBillingColumns;
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'] & LandlordBillingColumns;
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'] & LandlordBillingColumns;

export interface UserSessionProfile {
  id: string;
  email?: string;
  full_name: string;
  phone: string | null;
  role: Role;
  avatar_url: string | null;
  is_premium: boolean;
  is_verified_landlord: boolean;
}
