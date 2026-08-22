import { callFunction } from '../supabase-api';

export interface AccountPurgeResult {
  removed_count: number;
  removed: string[];
}

export async function deleteMyAccount(): Promise<AccountPurgeResult> {
  return callFunction<AccountPurgeResult>('account-purge', {});
}