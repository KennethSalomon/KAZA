// note : Point d'entrée centralisé pour tous les types KAZA
export * from './common';
export * from './user';
export * from './residence';
export * from './lease';
export * from './payment';
export * from './notification';
export * from './components';
export type { Database } from '@/lib/database.types';

// Export spécifique des stats admin
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
