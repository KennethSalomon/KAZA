import { supabase } from '../supabase-client';
import type { AdminStats, Profile, Residence } from '../types';
import { normalizeError } from '../supabase-api';

export async function adminStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('admin_stats');
  if (error) throw normalizeError(error, 'Statistiques indisponibles');
  return data as unknown as AdminStats;
}

export async function adminListResidences(limit = 30): Promise<Residence[]> {
  const { data, error } = await supabase
    .from('residences')
    .select('*, owner:profiles(id, full_name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as Residence[];
}

export async function adminListUsers(limit = 30): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as Profile[];
}

export async function adminVerifyResidence(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_verify_residence', { p_residence_id: id });
  if (error) throw normalizeError(error, 'Action impossible');
  await logAdminAction('verify_residence', 'residence', id);
}

export async function adminUnpublishResidence(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_unpublish_residence', { p_residence_id: id });
  if (error) throw normalizeError(error, 'Action impossible');
  await logAdminAction('unpublish_residence', 'residence', id);
}

export async function adminSetPremium(userId: string, isPremium: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_premium', { p_user_id: userId, p_is_premium: isPremium });
  if (error) throw normalizeError(error, 'Action impossible');
  await logAdminAction('set_premium', 'user', userId, null, { is_premium: isPremium });
}

export async function adminToggleRole(userId: string, role: Profile['role']): Promise<void> {
  const { error } = await supabase.rpc('admin_toggle_role', { p_user_id: userId, p_role: role });
  if (error) throw normalizeError(error, 'Action impossible');
  await logAdminAction('toggle_role', 'user', userId, null, { role });
}

export async function adminModerateResidence(id: string, action: 'approve' | 'reject', reason = ''): Promise<void> {
  const { error } = await supabase.rpc('admin_moderate_residence', {
    p_residence_id: id,
    p_action: action,
    p_reason: reason,
  });
  if (error) throw normalizeError(error, 'Action impossible');
  await logAdminAction(`moderate_residence_${action}`, 'residence', id, null, { reason });
}

export async function adminSetLandlordVerified(userId: string, verified: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_landlord_verified', {
    p_user_id: userId,
    p_verified: verified,
  });
  if (error) throw normalizeError(error, 'Action impossible');
  await logAdminAction('set_landlord_verified', 'user', userId, null, { verified });
}

export async function listAdminAuditLogs(params: {
  limit?: number;
  offset?: number;
  adminId?: string;
  targetType?: string;
  action?: string;
} = {}): Promise<{ id: string; admin_id: string; action: string; target_type: string; target_id: string | null; old_value: unknown; new_value: unknown; metadata: unknown; created_at: string }[]> {
  const { data, error } = await supabase.rpc('list_admin_audit_logs', {
    p_limit: params.limit ?? 100,
    p_offset: params.offset ?? 0,
    p_admin_id: params.adminId ?? null,
    p_target_type: params.targetType ?? null,
    p_action: params.action ?? null,
  });
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as { id: string; admin_id: string; action: string; target_type: string; target_id: string | null; old_value: unknown; new_value: unknown; metadata: unknown; created_at: string }[];
}

async function logAdminAction(
  action: string,
  targetType: string,
  targetId: string,
  oldValue?: unknown,
  newValue?: unknown
): Promise<void> {
  const { error } = await supabase.rpc('log_admin_action', {
    p_action: action,
    p_target_type: targetType,
    p_target_id: targetId,
    p_old_value: oldValue ?? null,
    p_new_value: newValue ?? null,
    p_metadata: null,
  });
  if (error) {
    console.error('Failed to log admin action:', error);
  }
}