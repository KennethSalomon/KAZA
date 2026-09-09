'use client';
import { useState } from 'react';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface VisitSlotProps {
  visitId: string;
  slotStart: string;
  slotEnd: string;
  onConfirm: (visitId: string) => Promise<void>;
}

export function VisitSlot({ visitId, slotStart, slotEnd, onConfirm }: VisitSlotProps) {
  const [loading, setLoading] = useState(false);
  const start = new Date(slotStart);
  const end = new Date(slotEnd);

  return (
    <div className="rounded-lg border border-brand/30 bg-brand/5 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 text-brand" />
        <span>{format(start, 'EEEE d MMMM', { locale: fr })}</span>
        <span className="text-muted">•</span>
        <span>{format(start, 'HH:mm', { locale: fr })} – {format(end, 'HH:mm', { locale: fr })}</span>
      </div>
      <Button onClick={() => { setLoading(true); onConfirm(visitId).finally(() => setLoading(false)); }} disabled={loading} className="w-full" size="sm">
        {loading ? 'Confirmation...' : 'Confirmer ce créneau'}
      </Button>
    </div>
  );
}