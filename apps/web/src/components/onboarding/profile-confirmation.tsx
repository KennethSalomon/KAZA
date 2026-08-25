'use client';

import { motion } from 'framer-motion';
import { Search, Building2, ShieldCheck, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Profile } from '@/lib/types';

interface ProfileConfirmationProps {
  readonly user: Profile | null;
  readonly role: string;
  readonly onConfirm: (role: string) => void;
  readonly onChangeRole: () => void;
}

const ROLE_META: Record<
  string,
  {
    title: string;
    subtitle: string;
    description: string;
    icon: typeof Search;
    targetLabel: string;
  }
> = {
  locataire: {
    title: 'Locataire',
    subtitle: 'Recherche & Location Directe',
    description:
      'Parcourez les logements vérifiés, contactez directement les propriétaires et gérez vos visites sans commission ni démarcheur.',
    icon: Search,
    targetLabel: 'Accéder à mon espace Locataire',
  },
  bailleur: {
    title: 'Propriétaire',
    subtitle: 'Publication & Gestion de Biens',
    description:
      'Publiez vos biens, gérez les demandes de location et suivez vos paiements de loyers en toute simplicité.',
    icon: Building2,
    targetLabel: 'Accéder à mon tableau de bord Propriétaire',
  },
  admin: {
    title: 'Administrateur',
    subtitle: 'Gestion & Supervision',
    description: 'Accédez à la console de gestion globale et à la modération de la plateforme KAZA.',
    icon: ShieldCheck,
    targetLabel: "Accéder à l'Administration",
  },
};

export function ProfileConfirmation({
  user,
  role,
  onConfirm,
  onChangeRole,
}: ProfileConfirmationProps) {
  const normalizedRole = role in ROLE_META ? role : 'locataire';
  const meta = ROLE_META[normalizedRole]!;
  const Icon = meta.icon;

  const displayName = user?.full_name || user?.email || 'Bienvenue sur KAZA';

  return (
    <div className="flex min-h-dvh items-center justify-center bg-kaza-bg px-5 py-10 text-kaza-text select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg rounded-[28px] border border-kaza-border bg-kaza-surface p-7 shadow-card sm:p-9"
      >
        {/* Header Badge */}
        <div className="flex items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-kaza-brand/10 px-3.5 py-1 text-xs font-semibold text-kaza-brand">
            <CheckCircle2 className="h-3.5 w-3.5 text-kaza-brand" />
            Authentification confirmée
          </span>
        </div>

        <div className="mt-5 text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight text-kaza-text sm:text-3xl">
            {displayName}
          </h1>
          <p className="mt-1.5 text-sm text-kaza-muted">
            Votre profil est configuré. Vous pouvez accéder directement à votre espace de travail.
          </p>
        </div>

        {/* Card du profil sélectionné */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-kaza-border bg-kaza-raised p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-kaza-brand text-white">
              <Icon className="h-6 w-6" />
            </div>
            <span className="rounded-full bg-kaza-surface px-3 py-1 text-xs font-semibold text-kaza-brand border border-kaza-border">
              {meta.title}
            </span>
          </div>

          <div className="mt-4">
            <h2 className="font-display text-lg font-bold text-kaza-text">{meta.title}</h2>
            <p className="text-xs font-medium text-kaza-faint">{meta.subtitle}</p>
            <p className="mt-2 text-sm leading-relaxed text-kaza-muted">{meta.description}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3">
          <Button
            type="button"
            size="lg"
            className="w-full justify-center bg-kaza-brand hover:bg-kaza-brand-dark text-white font-medium"
            onClick={() => onConfirm(normalizedRole)}
          >
            {meta.targetLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full justify-center text-kaza-muted hover:text-kaza-text border-kaza-border"
            onClick={onChangeRole}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Changer de profil
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
