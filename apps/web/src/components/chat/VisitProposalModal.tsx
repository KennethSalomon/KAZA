'use client';
import { useState } from 'react';
import { Calendar, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

interface Slot { start: string; end: string; }

export function VisitProposalModal({
  conversationId: _conversationId,
  onClose,
  onPropose,
}: {
  conversationId: string;
  onClose: () => void;
  onPropose: (slots: Slot[]) => Promise<void>;
}) {
  const [slots, setSlots] = useState<Slot[]>([{ start: '', end: '' }]);
  const [loading, setLoading] = useState(false);

  const addSlot = () => setSlots([...slots, { start: '', end: '' }]);
  const removeSlot = (i: number) => setSlots(slots.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onPropose(slots.map(s => ({ start: s.start, end: s.end })));
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const updateSlot = (i: number, key: 'start' | 'end', value: string) =>
    setSlots(slots.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)));

  return (
    <Modal open onClose={onClose} title="Proposer une visite">
      <p className="text-sm text-kaza-muted">Choisissez 1 à 3 créneaux</p>
      <form onSubmit={(e) => void handleSubmit(e)} className="mt-3 space-y-4">
        {slots.map((slot, i) => (
          <div key={i} className="space-y-2 rounded-kaza border border-kaza-border bg-kaza-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium text-kaza-text">
                <Calendar className="h-4 w-4 text-kaza-muted" aria-hidden />
                Créneau {i + 1}
              </span>
              {slots.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSlot(i)}
                  className="rounded-md p-1 text-kaza-faint transition-colors hover:text-kaza-danger"
                  aria-label={`Supprimer le créneau ${i + 1}`}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 min-w-0 sm:grid-cols-2">
              <label className="block min-w-0">
                <span className="kaza-label">Début</span>
                <Input
                  type="datetime-local"
                  value={slot.start}
                  onChange={(e) => updateSlot(i, 'start', e.target.value)}
                  className="w-full min-w-0"
                  required
                />
              </label>
              <label className="block min-w-0">
                <span className="kaza-label">Fin</span>
                <Input
                  type="datetime-local"
                  value={slot.end}
                  onChange={(e) => updateSlot(i, 'end', e.target.value)}
                  className="w-full min-w-0"
                  required
                />
              </label>
            </div>
          </div>
        ))}
        {slots.length < 3 && (
          <button type="button" onClick={addSlot} className="text-sm font-medium text-kaza-brand hover:underline">
            + Ajouter un créneau
          </button>
        )}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Annuler
          </Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Envoi…' : 'Proposer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}