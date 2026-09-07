import type { Database } from '../database.types';

export type PaymentMethod = Database['public']['Enums']['payment_method'];
export type PaymentProvider = Database['public']['Enums']['payment_provider'];
export type PaymentStatus = Database['public']['Enums']['payment_status'];

export type Payment = Database['public']['Tables']['payments']['Row'];
export type PaymentInsert = Database['public']['Tables']['payments']['Insert'];
export type PaymentUpdate = Database['public']['Tables']['payments']['Update'];

export type Receipt = Database['public']['Tables']['receipts']['Row'];

export type PaymentWithRelations = Payment & {
  lease?: {
    id: string;
    residence_id: string;
    monthly_rent: number;
    status: string;
  } | null;
};

export type ReceiptWithRelations = Receipt & {
  landlord?: {
    id: string;
    full_name: string;
  } | null;
};

export interface FedapayInitResponse {
  payment_id: string;
  payment_token: string;
  payment_url: string;
  amount: number;
  period_start: string;
  period_end: string;
}

export interface SignReceiptResponse {
  receipt_id: string;
  file_url: string;
  signature_hash: string;
  signed_at: string;
}
