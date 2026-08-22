import { supabase } from '../supabase-client';
import type { LeaseWithRelations, Profile } from '../types';
import { normalizeError } from '../supabase-api';

export async function listMyLeases(): Promise<LeaseWithRelations[]> {
  const { data, error } = await supabase.rpc('list_my_leases');
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as unknown as LeaseWithRelations[];
}

export async function createLease(input: {
  residence_id: string;
  tenant_id: string;
  start_date: string;
  end_date?: string;
  monthly_rent: number;
  deposit: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_lease', {
    p_residence_id: input.residence_id,
    p_tenant_id: input.tenant_id,
    p_start_date: input.start_date,
    p_end_date: input.end_date ?? null,
    p_monthly_rent: input.monthly_rent,
    p_deposit: input.deposit,
  });
  if (error) throw normalizeError(error, 'Bail impossible');
  return data as string;
}

export async function terminateLease(leaseId: string): Promise<void> {
  const { error } = await supabase.rpc('terminate_lease', { p_lease_id: leaseId });
  if (error) throw normalizeError(error, 'Clôture impossible');
}

export async function listTenants(): Promise<Profile[]> {
  const { data, error } = await supabase.rpc('list_tenants');
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as unknown as Profile[];
}