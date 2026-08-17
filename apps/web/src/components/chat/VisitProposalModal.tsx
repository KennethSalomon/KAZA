'use client';
import { useState } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Slot { start: string; end: string; }

export function VisitProposalModal({
  conversationId,
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-sora text-lg font-semibold">Proposer une visite</h3>
          <button onClick={onClose} className="text-muted hover:text-text"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-muted">Choisissez 1 à 3 créneaux</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          {slots.map((slot, i) => (
            <div key={i} className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted" />
              <Input type="datetime-local" value={slot.start} onChange={e => setSlots(slots.map((s, idx) => idx === i ? { ...s, start: e.target.value } : s))} required />
              <span className="text-muted">→</span>
              <Clock className="h-4 w-4 text-muted" />
              <Input type="datetime-local" value={slot.end} onChange={e => setSlots(slots.map((s, idx) => idx === i ? { ...s, end: e.target.value } : s))} required />
              {slots.length > 1 && <button type="button" onClick={() => removeSlot(i)} className="text-red-500 hover:text-red-700">×</button>}
            </div>
          ))}
          {slots.length < 3 && <button type="button" onClick={addSlot} className="text-sm text-brand hover:underline">+ Ajouter un créneau</button>}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Annuler</Button>
            <Button type="submit" disabled={loading} className="flex-1">{loading ? 'Envoi...' : 'Proposer'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}