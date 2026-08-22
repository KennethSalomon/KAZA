import { supabase } from '../supabase-client';
import { env } from '../env';
import type {
  PaymentWithRelations,
  ReceiptWithRelations,
  LeaseWithRelations,
} from '../types';
import { ApiError, normalizeError, callFunction } from '../supabase-api';

export interface FedapayInitResult {
  payment_id: string;
  payment_token: string;
  payment_url: string;
  amount: number;
  period_start: string;
  period_end: string;
}

export interface SignReceiptResult {
  receipt_id: string;
  file_url: string;
  signature_hash: string;
  signed_at: string;
}

export async function listMyPayments(): Promise<PaymentWithRelations[]> {
  const { data, error } = await supabase.rpc('list_my_payments');
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as unknown as PaymentWithRelations[];
}

export async function listMyReceipts(): Promise<ReceiptWithRelations[]> {
  const { data, error } = await supabase.rpc('list_my_receipts');
  if (error) throw normalizeError(error, 'Chargement impossible');
  return (data ?? []) as unknown as ReceiptWithRelations[];
}

export async function reportCashPayment(input: {
  lease_id: string;
  amount: number;
  period_start: string;
  period_end: string;
}): Promise<void> {
  const { error } = await supabase.rpc('report_cash_payment', {
    p_lease_id: input.lease_id,
    p_amount: input.amount,
    p_period_start: input.period_start,
    p_period_end: input.period_end,
  });
  if (error) throw normalizeError(error, 'Signalement impossible');
}

export async function initFedapayPayment(
  leaseId: string,
  channel: string,
  phone?: string,
  months: number = 1,
): Promise<FedapayInitResult> {
  return callFunction<FedapayInitResult>('fedapay-init', { lease_id: leaseId, channel, phone, months });
}

export async function confirmPayment(paymentId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('payments')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      confirmed_by: user.id,
    })
    .eq('id', paymentId);
  if (error) throw normalizeError(error, 'Validation impossible');
}

export async function rejectPayment(paymentId: string): Promise<void> {
  const { error } = await supabase
    .from('payments')
    .update({ status: 'rejected' })
    .eq('id', paymentId);
  if (error) throw normalizeError(error, 'Rejet impossible');
}

export async function signReceipt(receiptId: string): Promise<SignReceiptResult> {
  return callFunction<SignReceiptResult>('receipts-sign', { receipt_id: receiptId });
}