// note : Types du domaine Utilisateurs / Profils / Authentification
import type { Database } from '@/lib/database.types';

export type Role = Database['public']['Enums']['user_role'];

// note : les colonnes onboarding bailleur (migration 023_landlord_billing.sql)
// ne sont pas encore présentes dans database.types.ts (généré depuis la base
// distante). On les déclare ici comme facultatives pour rester rétro-compatible
// tant que `npm run db:types` n'a pas resynchronisé le fichier généré.
type LandlordBillingColumns = {
  business_name?: string | null;
  tax_id?: string | null;
  momo_provider?: 'mtn' | 'moov' | 'celtiis' | null;
  momo_number?: string | null;
  bank_name?: string | null;
  bank_iban?: string | null;
  onboarding_completed?: boolean;
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
