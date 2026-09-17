'use client';

import { useEffect, useState } from 'react';
import { listExpenses, createExpense, updateExpense, deleteExpense, listMyResidences } from '@/lib/supabase-api';
import type { ResidenceWithRelations } from '@/lib/types';
import { useToast } from '@/components/ui/toast';

export default function LandlordExpensesPage() {
  const { error: toastError, success: toastSuccess } = useToast();

  interface ExpenseFormValues {
    category: 'travaux' | 'charges' | 'taxes' | 'assurance' | 'autre';
    amount: number;
    date: string;
    residence_id: string | undefined;
    description: string | undefined;
  }

  interface Expense {
    id: string;
    category: 'travaux' | 'charges' | 'taxes' | 'assurance' | 'autre';
    amount: number;
    date: string;
    description: string | null;
    residence_id: string | null;
  }

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [residences, setResidences] = useState<ResidenceWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filters, setFilters] = useState<{
    from?: string | undefined;
    to?: string | undefined;
    category?: 'travaux' | 'charges' | 'taxes' | 'assurance' | 'autre' | undefined;
    residence_id?: string | undefined;
  }>({ from: undefined, to: undefined, category: undefined, residence_id: undefined });
  const [total, setTotal] = useState(0);

  const [form, setForm] = useState<ExpenseFormValues>({
    category: 'travaux',
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    residence_id: undefined,
    description: undefined,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<'create' | 'update'>('create');
  // Id de la dépense en cours d'édition : source de vérité unique pour
  // l'update (l'ancien lookup `expenses.find((e) => e.id === '')` passait
  // un objet vide à update_expense → échec systématique).
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listExpenses(filters);
      setExpenses(data);
      // Total calculé depuis les données fraîchement chargées (et donc
      // filtrées) — pas depuis le state `expenses` du render précédent.
      setTotal(data.reduce((acc, exp) => acc + exp.amount, 0));
    } catch (err) {
      toastError(err instanceof Error ? err.message : String(err), 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const loadResidences = async () => {
    try {
      setResidences(await listMyResidences());
    } catch (err) {
      toastError(err instanceof Error ? err.message : String(err), 'Erreur');
    }
  };

  useEffect(() => {
    void load();
  }, [filters]);

  useEffect(() => {
    void loadResidences();
  }, []);

  const handleCreate = () => {
    setForm({
      category: 'travaux',
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      residence_id: undefined,
      description: undefined,
    });
    setEditingId(null);
    setFormOpen(true);
    setFormType('create');
  };

  const handleSubmit = async () => {
    if (form.amount <= 0) {
      toastError('Le montant doit être supérieur à 0', 'Erreur');
      return;
    }
    if (form.date > new Date().toISOString().slice(0, 10)) {
      toastError('La date ne peut pas être dans le futur', 'Erreur');
      return;
    }
    setIsSubmitting(true);
    try {
      await createExpense({
        category: form.category,
        amount: form.amount,
        date: form.date,
        description: form.description,
        residence_id: form.residence_id,
        receipt_path: undefined,
      });
      toastSuccess('Dépense créée');
      setFormOpen(false);
      void load();
    } catch (err) {
      toastError(err instanceof Error ? err.message : String(err), 'Erreur');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = (expense: Expense) => {
    setForm({
      category: expense.category,
      amount: expense.amount,
      date: expense.date,
      residence_id: expense.residence_id ?? undefined,
      description: expense.description ?? undefined,
    });
    setEditingId(expense.id);
    setFormOpen(true);
    setFormType('update');
  };

  const handleUpdateSubmit = async () => {
    if (!editingId) return;
    if (form.amount <= 0) {
      toastError('Le montant doit être supérieur à 0', 'Erreur');
      return;
    }
    if (form.date > new Date().toISOString().slice(0, 10)) {
      toastError('La date ne peut pas être dans le futur', 'Erreur');
      return;
    }
    setIsSubmitting(true);
    try {
      await updateExpense(editingId, {
        category: form.category,
        amount: form.amount,
        date: form.date,
        description: form.description,
        residence_id: form.residence_id,
        // receipt_path hors périmètre P0 : update_expense (migration 031)
        // écrase encore receipt_url à NULL en l'absence du paramètre —
        // préservation du justificatif à traiter au lot Storage (P1).
        receipt_path: undefined,
      });
      toastSuccess('Dépense mise à jour');
      setFormOpen(false);
      setEditingId(null);
      void load();
    } catch (err) {
      toastError(err instanceof Error ? err.message : String(err), 'Erreur');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer cette dépense ?')) return;
    setIsSubmitting(true);
    try {
      await deleteExpense(id);
      toastSuccess('Dépense supprimée');
      void load();
    } catch (err) {
      toastError(err instanceof Error ? err.message : String(err), 'Erreur');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetFilters = () => {
    setFilters({ from: undefined, to: undefined, category: undefined, residence_id: undefined });
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setFormType('create');
  };

  return (
    <div className="py-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Gestion des dépenses</h1>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-1 rounded-sm px-3 py-1 text-sm hover:bg-gray-100"
            aria-label="Nouvelle dépense"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Nouvelle dépense
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Du</label>
            <input
              type="date"
              value={filters.from || ''}
              onChange={(e) => setFilters({ ...filters, from: e.target.value || undefined })}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Jusqu&apos;au</label>
            <input
              type="date"
              value={filters.to || ''}
              onChange={(e) => setFilters({ ...filters, to: e.target.value || undefined })}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Catégorie</label>
            <select
              value={filters.category || ''}
              onChange={(e) =>
                setFilters({ ...filters, category: (e.target.value || undefined) as typeof filters.category })
              }
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Toutes</option>
              <option value="travaux">Travaux</option>
              <option value="charges">Charges</option>
              <option value="taxes">Taxes</option>
              <option value="assurance">Assurance</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Résidence</label>
            <select
              value={filters.residence_id || ''}
              onChange={(e) => setFilters({ ...filters, residence_id: e.target.value || undefined })}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Toutes</option>
              {residences.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button
              onClick={handleResetFilters}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              Réinitialiser
            </button>
          </div>
        </div>

        <div>
          {loading ? (
            <span>Chargement...</span>
          ) : expenses.length === 0 ? (
            <p>Aucune dépense</p>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full border rounded border-border">
                  <thead>
                    <tr>
                      <th className="p-4 border-b border-border text-left font-medium">Catégorie</th>
                      <th className="p-4 border-b border-border text-left font-medium">Date</th>
                      <th className="p-4 border-b border-border text-left font-medium">Montant</th>
                      <th className="p-4 border-b border-border text-left font-medium">Description</th>
                      <th className="p-4 border-b border-border text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((expense: Expense) => (
                      <tr key={expense.id} className="border-b">
                        <td className="p-4">
                          <span className="capitalize">{expense.category}</span>
                        </td>
                        <td className="p-4">
                          <span>{expense.date}</span>
                        </td>
                        <td className="p-4">
                          <span>{expense.amount} XOF</span>
                        </td>
                        <td className="p-4">
                          <p>{expense.description || ''}</p>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdate(expense)}
                              className="text-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                              aria-label="Modifier"
                            >
                              Modifier
                            </button>
                            <button
                              onClick={() => handleDelete(expense.id)}
                              disabled={isSubmitting}
                              className="text-destructive hover:text-destructive focus:outline-none focus:ring-2 focus:ring-destructive"
                              aria-label="Supprimer"
                            >
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div>
          <p>Total: {total} XOF</p>
        </div>

        {formOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-kaza-bg rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">
                {formType === 'create' ? 'Nouvelle dépense' : 'Modifier la dépense'}
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (formType === 'create') void handleSubmit();
                  else void handleUpdateSubmit();
                }}
              >
                <div className="grid grid-cols-1 gap-4 mb-4">
                  <select
                    value={form.category}
                    onChange={(e) => {
                      setForm({ ...form, category: e.target.value as 'travaux' | 'charges' | 'taxes' | 'assurance' | 'autre' });
                    }}
                    className="rounded border border-gray-300 px-3 py-2"
                  >
                    <option value="travaux">Travaux</option>
                    <option value="charges">Charges</option>
                    <option value="taxes">Taxes</option>
                    <option value="assurance">Assurance</option>
                    <option value="autre">Autre</option>
                  </select>

                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => {
                      setForm({ ...form, amount: parseFloat(e.target.value) || 0 });
                    }}
                    className="rounded border border-gray-300 px-3 py-2"
                    min="0"
                  />
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => {
                      setForm({ ...form, date: e.target.value });
                    }}
                    className="rounded border border-gray-300 px-3 py-2"
                  />
                  <select
                    value={form.residence_id || ''}
                    onChange={(e) => {
                      setForm({ ...form, residence_id: e.target.value === '' ? undefined : e.target.value });
                    }}
                    className="rounded border border-gray-300 px-3 py-2"
                  >
                    <option value="">Aucune</option>
                    {residences.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <textarea
                    value={form.description ?? ''}
                    onChange={(e) => {
                      setForm({ ...form, description: e.target.value || undefined });
                    }}
                    className="w-full rounded border border-gray-300 px-3 py-2 resize-h p-2 min-h-20"
                    placeholder="Description (optionnel)"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="px-4 py-2 rounded border border-border hover:bg-gray-100"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded bg-primary text-white hover:bg-kaza-primary-focus"
                  >
                    {formType === 'create' ? 'Créer' : 'Mettre à jour'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
