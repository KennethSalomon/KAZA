import { supabase } from '../supabase-client';
import { normalizeError } from '../supabase-api';

export interface LandlordDashboardStats {
  total_properties: number;
  occupied: number;
  vacant: number;
  in_visit: number;
  maintenance: number;
  total_monthly_rent: number;
  collected_this_month: number;
  overdue_total: number;
  overdue_count: number;
  pending_receipts: number;
  upcoming_due_7d: number;
  expenses_this_month: number;
}

export async function getLandlordDashboardStats(): Promise<LandlordDashboardStats> {
  const { data, error } = await supabase.rpc('landlord_dashboard_stats');
  if (error) throw normalizeError(error, 'Chargement du tableau de bord impossible');
  return (data ?? {}) as unknown as LandlordDashboardStats;
}