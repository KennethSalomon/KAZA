import { supabase } from '../supabase-client';
import { normalizeError } from '../supabase-api';

export interface Expense {
  id: string;
  landlord_id: string;
  residence_id: string | null;
  category: 'travaux' | 'charges' | 'taxes' | 'assurance' | 'autre';
  amount: number;
  date: string;
  description: string | null;
  receipt_url: string | null; // chemin Storage: expenses/{expense_id}.{extension}
  receipt_sha256: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseFilters {
  from?: string;
  to?: string;
  category?: 'travaux' | 'charges' | 'taxes' | 'assurance' | 'autre';
  residence_id?: string;
}

export interface CashflowMonth {
  month: string;
  expected: number;
  collected: number;
  overdue: number;
  expenses: number;
  net: number;
}

export async function listExpenses(filters: ExpenseFilters = {}): Promise<Expense[]> {
  const { data, error } = await supabase.rpc('list_landlord_expenses', {
    p_from: filters.from,
    p_to: filters.to,
    p_category: filters.category,
    p_residence_id: filters.residence_id,
  });
  if (error) throw normalizeError(error, 'Chargement des dépenses impossible');
  return (data ?? []) as unknown as Expense[];
}

export async function createExpense(input: {
  category: 'travaux' | 'charges' | 'taxes' | 'assurance' | 'autre';
  amount: number;
  date: string;
  description?: string;
  residence_id?: string;
  receipt_path?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_expense', {
    p_category: input.category,
    p_amount: input.amount,
    p_date: input.date,
    p_description: input.description,
    p_residence_id: input.residence_id,
    p_receipt_path: input.receipt_path,
  });
  if (error) throw normalizeError(error, 'Création impossible');
  return data as string;
}

export async function updateExpense(id: string, input: {
  category: 'travaux' | 'charges' | 'taxes' | 'assurance' | 'autre';
  amount: number;
  date: string;
  description?: string;
  residence_id?: string;
  receipt_path?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('update_expense', {
    p_id: id,
    p_category: input.category,
    p_amount: input.amount,
    p_date: input.date,
    p_description: input.description,
    p_residence_id: input.residence_id,
    p_receipt_path: input.receipt_path,
  });
  if (error) throw normalizeError(error, 'Modification impossible');
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_expense', { p_id: id });
  if (error) throw normalizeError(error, 'Suppression impossible');
}

export async function getCashflow(from: string, to: string): Promise<CashflowMonth[]> {
  const { data, error } = await supabase.rpc('landlord_cashflow', {
    p_from: from,
    p_to: to,
  });
  if (error) throw normalizeError(error, 'Chargement du cash-flow impossible');
  return (data ?? []) as unknown as CashflowMonth[];
}

export const EXPENSE_CATEGORIES = [
  { value: 'travaux', label: 'Travaux' },
  { value: 'charges', label: 'Charges' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'assurance', label: 'Assurance' },
  { value: 'autre', label: 'Autre' },
] as const;