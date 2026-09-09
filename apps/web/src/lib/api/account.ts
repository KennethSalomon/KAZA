import { callFunction } from '../supabase-api';
import { supabase } from '../supabase-client';
import { normalizeError, assertBeninPhone } from '../supabase-api';

export interface AccountPurgeResult {
  removed_count: number;
  removed: string[];
}

export async function deleteMyAccount(): Promise<AccountPurgeResult> {
  return callFunction<AccountPurgeResult>('account-purge', {});
}

export type MomoProvider = 'mtn' | 'moov' | 'celtiis';

export interface LandlordBilling {
  business_name: string | null;
  tax_id: string | null;
  momo_provider: MomoProvider | null;
  momo_number: string | null;
  bank_name: string | null;
  bank_iban: string | null;
  onboarding_completed: boolean;
}

export interface LandlordOnboardingInput {
  business_name: string;
  tax_id?: string;
  momo_provider: MomoProvider;
  momo_number: string;
  bank_name?: string;
  bank_iban?: string;
}

export async function getMyBilling(): Promise<LandlordBilling | null> {
  const { data, error } = await supabase.rpc('get_my_billing');

  if (error) {
    throw normalizeError(error, 'Chargement des coordonnées impossible');
  }

  const row = Array.isArray(data) ? data[0] : data;
  return (row as LandlordBilling | null) ?? null;
}

export async function completeLandlordOnboarding(
  input: LandlordOnboardingInput,
): Promise<void> {
  assertBeninPhone(input.momo_number);

  const { error } = await supabase.rpc('complete_landlord_onboarding', {
    p_business_name: input.business_name,
    p_tax_id: input.tax_id ?? null,
    p_momo_provider: input.momo_provider,
    p_momo_number: input.momo_number,
    p_bank_name: input.bank_name ?? null,
    p_bank_iban: input.bank_iban ?? null,
  });

  if (error) {
    throw normalizeError(error, 'Onboarding impossible');
  }
}