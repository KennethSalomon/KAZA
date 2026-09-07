'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signUp, ApiError } from '@/lib/supabase-api';
import { env } from '@/lib/env';
import { useHcaptcha } from '@/components/ui/hcaptcha';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';

type Role = 'locataire' | 'bailleur';

const initial = {
  full_name: '',
  email: '',
  phone: '',
  role: 'locataire' as Role,
  password: '',
  consent: false,
};

export default function RegisterPage() {
  const [form, setForm] = useState(initial);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const hcaptcha = useHcaptcha();

  const set =
    (key: keyof typeof initial) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value =
        e.target.type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : e.target.value;
      setForm((f) => ({ ...f, [key]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      if (!form.consent) {
        setErrors({ consent: ['Votre consentement est requis pour créer un compte.'] });
        return;
      }
      const captchaToken = env.hcaptchaSitekey
        ? await hcaptcha.execute({ sitekey: env.hcaptchaSitekey })
        : '';
      const { needsEmailConfirmation } = await signUp(
        {
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          role: form.role,
          password: form.password,
          consent_apdp: form.consent,
        },
        captchaToken,
      );
      hcaptcha.reset();
      const isLandlord = form.role === 'bailleur';
      if (needsEmailConfirmation) {
        toast.success(
          'Vérifiez votre boîte mail',
          isLandlord
            ? `Un lien de confirmation a été envoyé à ${form.email.trim()}. Après connexion, complétez votre profil bailleur (Mobile Money).`
            : `Un lien de confirmation a été envoyé à ${form.email.trim()}.`,
        );
        router.push('/login');
      } else if (isLandlord) {
        // note : session déjà active (pas de confirm email requise) → on emmène
        // directement le bailleur dans le tunnel d'onboarding, sinon il atterrit
        // sur /explorer et ne trouve jamais la page de configuration.
        toast.success('Compte créé', 'Configurons votre espace bailleur.');
        router.push('/onboarding');
      } else {
        toast.success('Compte créé', 'Connectez-vous pour commencer.');
        router.push('/login');
      }
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      else if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Création impossible');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">
          Rejoignez KAZA
        </h1>
        <p className="text-sm text-kaza-muted">Gratuit. Sans commission sur les loyers.</p>
      </div>

      {/* Segmented control — sélection du rôle */}
      <div className="flex rounded-kaza bg-kaza-raised p-1">
        {(['locataire', 'bailleur'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setForm((f) => ({ ...f, role: r }))}
            aria-pressed={form.role === r}
            className={cn(
              'flex-1 rounded-kaza-sm py-2.5 text-sm font-medium transition-all',
              form.role === r
                ? 'bg-kaza-vert text-white shadow-sm'
                : 'text-kaza-muted hover:text-kaza-text',
            )}
          >
            {r === 'locataire' ? 'Locataire' : 'Bailleur'}
          </button>
        ))}
      </div>

      <Input
        label="Nom complet"
        autoComplete="name"
        required
        placeholder="Aïcha Mensah"
        value={form.full_name}
        onChange={set('full_name')}
        error={errors.full_name?.[0]}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          placeholder="vous@exemple.com"
          value={form.email}
          onChange={set('email')}
          error={errors.email?.[0]}
        />
        <Input
          label="Téléphone (WhatsApp)"
          type="tel"
          autoComplete="tel"
          required
          placeholder="+229 01 00 00 00 00"
          pattern="\+229[0-9]{10}"
          maxLength={16}
          value={form.phone}
          onChange={set('phone')}
          error={errors.phone?.[0]}
        />
      </div>

      <div className="relative">
        <Input
          label="Mot de passe"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          required
          placeholder="8 caractères min, lettres + chiffres"
          value={form.password}
          onChange={set('password')}
          error={errors.password?.[0]}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute right-3 top-[34px] text-kaza-faint transition-colors hover:text-kaza-text"
          aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <label className="flex items-start gap-3 rounded-kaza border border-kaza-border bg-kaza-surface p-3.5 text-xs leading-relaxed text-kaza-muted">
        <input
          type="checkbox"
          checked={form.consent}
          onChange={set('consent')}
          className="mt-0.5 h-4 w-4 accent-kaza-brand"
          required
        />
        <span>
          J&apos;accepte que KAZA traite mes données personnelles (identité, coordonnées) conformément à
          la loi béninoise sur la protection des données (APDP) —{' '}
          <a
            href="/confidentialite"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-kaza-brand"
          >
            voir notre politique de confidentialité
          </a>
          .
        </span>
      </label>

      {(errors.consent?.[0] ?? errors.consent_apdp?.[0]) && (
        <p role="alert" className="text-xs text-kaza-danger">
          {errors.consent?.[0] ?? errors.consent_apdp?.[0]}
        </p>
      )}

      <Button type="submit" loading={loading} className="w-full" size="lg">
        Créer mon compte
      </Button>

      <p className="text-center text-sm text-kaza-muted">
        Déjà inscrit ?{' '}
        <Link href="/login" className="font-medium text-kaza-brand hover:opacity-80">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
