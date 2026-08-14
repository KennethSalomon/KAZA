import type { Metadata } from 'next';
import { ResidenceForm } from '@/components/property/residence-form';

export const metadata: Metadata = { title: 'Nouveau bien' };

export default function NewResidencePage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">Ajouter un bien</h1>
      <p className="mt-1 text-sm text-kaza-muted">Photos, prix, localisation — publié après validation de nos équipes.</p>
      <div className="mt-6">
        <ResidenceForm />
      </div>
    </div>
  );
}