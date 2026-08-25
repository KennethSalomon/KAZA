'use client';

import { useRouter } from 'next/navigation';
import { ResidenceForm } from '@/components/property/residence-form';

export default function NewResidencePage() {
  const router = useRouter();

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md -mx-4 -my-8 sm:mx-0 sm:my-0">
      {/* Top Header App Bar */}
      <header className="sticky top-0 z-40 bg-surface dark:bg-surface-dim shadow-sm border-b border-surface-variant">
        <div className="flex items-center gap-3 px-margin-mobile md:px-margin-desktop py-base w-full max-w-3xl mx-auto">
          <button
            onClick={() => router.back()}
            aria-label="Retour"
            className="w-10 h-10 rounded-full hover:bg-surface-container-low flex items-center justify-center text-on-surface transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary font-bold">
            Publier une annonce
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-margin-mobile md:px-margin-desktop py-stack-lg max-w-3xl mx-auto w-full">
        {/* Step Indicator Header */}
        <div className="mb-stack-lg">
          <span className="inline-block px-3 py-1 rounded-full bg-primary-container text-on-primary-container font-label-md text-label-md mb-2">
            Étape 1 sur 2
          </span>
          <h2 className="font-title-lg text-title-lg text-on-surface">Informations du bien</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Renseignez les détails principaux de votre logement pour attirer rapidement des locataires.
          </p>
        </div>

        <ResidenceForm />
      </main>
    </div>
  );
}