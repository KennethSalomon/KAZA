export * from './common';
export * from './user';
export * from './residence';
export * from './lease';
export * from './payment';
export * from './notification';
export type { Database } from '../database.types';

export interface AdminStats {
  users: {
    total: number;
    by_role: Record<string, number>;
  };
  residences: {
    total: number;
    by_status: Record<string, number>;
  };
  leases: {
    total: number;
  };
  payments: {
    confirmed_count: number;
    total_collected_xof: number;
  };
}
