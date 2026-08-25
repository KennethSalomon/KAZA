'use client';

import { Building2, Search, Compass } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

const STORAGE_KEY = 'kaza:selected-role';

interface ProfilePickerProps {
  readonly initialSelected?: string;
  readonly onSelectRole?: (role: string) => void;
}

export function ProfilePicker({ onSelectRole }: ProfilePickerProps) {
  const router = useRouter();

  const saveSelectedRole = (roleKey: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, roleKey);
    }
    if (onSelectRole) {
      onSelectRole(roleKey);
    }
  };

  const handleSelectLocataire = () => {
    saveSelectedRole('locataire');
    router.push('/login?role=locataire');
  };

  const handleSelectProprietaire = () => {
    saveSelectedRole('bailleur');
    router.push('/login?role=bailleur');
  };

  const handleSelectExplorer = () => {
    saveSelectedRole('locataire');
    router.push('/explorer');
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-kaza-bg px-4 py-12 text-kaza-text select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-4xl rounded-[28px] border border-kaza-border bg-kaza-surface p-6 shadow-card sm:p-10"
      >
        {/* Header */}
        <div className="mb-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-kaza-brand">Bienvenue sur KAZA</p>
          <h1 className="mt-2.5 font-display text-3xl font-extrabold tracking-tight text-kaza-text sm:text-4xl">
            Choisissez votre profil
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-kaza-muted sm:text-base max-w-lg mx-auto">
            Sélectionnez votre profil pour accéder à votre espace et profiter de tous nos services.
          </p>
        </div>

        {/* 3 Cartes Épurées (Icône, Titre, Description uniquement) */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Carte 1 : Je suis Locataire */}
          <button
            type="button"
            onClick={handleSelectLocataire}
            className="group flex flex-col rounded-2xl border border-kaza-border bg-white p-7 text-left transition-all duration-200 hover:border-kaza-brand hover:shadow-card-hover hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-kaza-brand/30"
          >
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-kaza-brand text-white shadow-md transition-transform duration-200 group-hover:scale-105">
              <Search className="h-7 w-7 text-kaza-peach" aria-hidden />
            </div>
            <h2 className="font-display text-xl font-extrabold text-kaza-text group-hover:text-kaza-brand transition-colors">
              Je suis Locataire
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-kaza-muted">
              Je cherche un logement à louer. Je souhaite comparer les offres, contacter les bailleurs et gérer mes locations.
            </p>
          </button>

          {/* Carte 2 : Je suis Propriétaire */}
          <button
            type="button"
            onClick={handleSelectProprietaire}
            className="group flex flex-col rounded-2xl border border-kaza-border bg-white p-7 text-left transition-all duration-200 hover:border-kaza-brand hover:shadow-card-hover hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-kaza-brand/30"
          >
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-kaza-brand text-white shadow-md transition-transform duration-200 group-hover:scale-105">
              <Building2 className="h-7 w-7 text-kaza-peach" aria-hidden />
            </div>
            <h2 className="font-display text-xl font-extrabold text-kaza-text group-hover:text-kaza-brand transition-colors">
              Je suis Propriétaire
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-kaza-muted">
              Je possède des logements à louer. Je souhaite publier des annonces, traiter les demandes et suivre mes loyers.
            </p>
          </button>

          {/* Carte 3 : Je veux explorer */}
          <button
            type="button"
            onClick={handleSelectExplorer}
            className="group flex flex-col rounded-2xl border border-kaza-border bg-white p-7 text-left transition-all duration-200 hover:border-kaza-brand hover:shadow-card-hover hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-kaza-brand/30"
          >
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-kaza-raised text-kaza-brand border border-kaza-border shadow-sm transition-transform duration-200 group-hover:scale-105">
              <Compass className="h-7 w-7 text-kaza-brand" aria-hidden />
            </div>
            <h2 className="font-display text-xl font-extrabold text-kaza-text group-hover:text-kaza-brand transition-colors">
              Je veux explorer
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-kaza-muted">
              Je souhaite consulter le catalogue d&apos;offres et découvrir la plateforme sans créer de compte pour le moment.
            </p>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
