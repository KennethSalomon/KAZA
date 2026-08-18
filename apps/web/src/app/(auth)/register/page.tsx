'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signUp, signInWithGoogle, ApiError } from '@/lib/supabase-api';
import { env } from '@/lib/env';
import { useHcaptcha } from '@/components/ui/hcaptcha';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GoogleIcon } from '@/components/ui/google-icon';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';

const initial = {
  full_name: '',
  email: '',
  phone: '',
  role: 'locataire',
  password: '',
  consent: false,
};

export default function RegisterPage() {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const hcaptcha = useHcaptcha();
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onGoogle() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch {
      toast.error('Connexion Google impossible', 'Réessayez ou utilisez votre email.');
      setGoogleLoading(false);
    }
  }

  const set = (key: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let value: string | boolean = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    if (key === 'phone' && typeof value === 'string') {
      const digits = value.replace(/\D/g, '');
      if (digits.startsWith('229') && digits.length >= 3) {
        value = '+' + digits;
      } else if (digits.length > 0 && !digits.startsWith('229')) {
        value = '+229' + digits;
      }
    }
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
        setLoading(false);
        return;
      }

      const fieldErrors: Record<string, string[]> = {};
      if (!form.full_name.trim()) fieldErrors.full_name = ['Le nom complet est requis.'];
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) fieldErrors.email = ['Adresse email invalide.'];
      const phoneClean = form.phone.replace(/\s+/g, '');
      if (!/^\+229\d{10}$/.test(phoneClean)) {
        fieldErrors.phone = ['Format : +229 suivi de 10 chiffres (ex: +229019560880)'];
      }
      if (form.password.length < 8) fieldErrors.password = ['8 caractères minimum.'];
      if (!/[a-zA-Z]/.test(form.password) || !/\d/.test(form.password)) {
        fieldErrors.password = [...(fieldErrors.password ?? []), 'Lettres et chiffres requis.'];
      }
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        setLoading(false);
        return;
      }

      let captchaToken = '';
      try {
        captchaToken = env.hcaptchaSitekey
          ? await hcaptcha.execute({ sitekey: env.hcaptchaSitekey })
          : '';
      } catch (captchaErr) {
        console.error('[register] hCaptcha failed:', captchaErr);
        toast.error(
          'Vérification anti-robot échouée',
          'Désactivez votre bloqueur de publicités ou réessayez dans un autre navigateur.',
        );
        setLoading(false);
        return;
      }

      const { needsEmailConfirmation } = await signUp(
        {
          full_name: form.full_name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: phoneClean,
          role: form.role as 'locataire' | 'bailleur',
          password: form.password,
          consent_apdp: form.consent,
        },
        captchaToken,
      );
      hcaptcha.reset();
      if (needsEmailConfirmation) {
        toast.success(
          'Vérifiez votre boîte mail',
          `Un lien de confirmation a été envoyé à ${form.email.trim()}.`,
        );
      } else {
        toast.success('Compte créé', 'Connectez-vous pour commencer.');
      }
      router.push('/login');
    } catch (err) {
      console.error('[register] signUp error:', err);
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      else if (err instanceof ApiError && err.status === 429) {
        toast.error(
          'Trop de tentatives',
          'Le service d\'envoi d\'emails est momentanément saturé. Patientez 2-3 minutes puis réessayez.',
        );
      } else if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Erreur inattendue', 'Réessayez ou contactez le support.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">Créer un compte</h1>
        <p className="mt-1 text-sm text-kaza-muted">Gratuit. Sans commission sur les loyers.</p>
      </div>

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        size="lg"
        onClick={onGoogle}
        loading={googleLoading}
      >
        <GoogleIcon className="mr-2 h-5 w-5" />
        Continuer avec Google
      </Button>

      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-kaza-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-3 text-kaza-muted">Ou continuer avec email</span>
        </div>
      </div>

      <Select
        label="Je suis…"
        value={form.role}
        onChange={set('role')}
        options={[
          { value: 'locataire', label: 'Un locataire — je cherche un logement' },
          { value: 'bailleur', label: 'Un bailleur — je loue des biens' },
        ]}
      />

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
          placeholder="01 95 60 88 00"
          maxLength={16}
          value={form.phone}
          onChange={set('phone')}
          error={errors.phone?.[0]}
        />
      </div>
      <Input
        label="Mot de passe"
        type="password"
        togglePassword
        autoComplete="new-password"
        required
        placeholder="8 caractères min, lettres + chiffres"
        value={form.password}
        onChange={set('password')}
        error={errors.password?.[0]}
      />

      <label className="flex items-start gap-3 rounded-kaza border border-kaza-border bg-kaza-surface p-3.5 text-xs leading-relaxed text-kaza-muted">
        <input
          type="checkbox"
          checked={form.consent}
          onChange={set('consent')}
          className="mt-0.5 h-4 w-4 accent-kaza-brand"
          required
        />
        <span>
          J’accepte que KAZA traite mes données personnelles (identité, coordonnées) conformément à la
          loi béninoise sur la protection des données (APDP) —{' '}
          <a href="/confidentialite" target="_blank" rel="noopener noreferrer" className="underline hover:text-kaza-brand">
            voir notre politique de confidentialité
          </a>.
        </span>
      </label>
      {errors.consent_apdp && (
        <p role="alert" className="text-xs text-kaza-danger">
          {errors.consent_apdp[0]}
        </p>
      )}
      {errors.consent && (
        <p role="alert" className="text-xs text-kaza-danger">
          {errors.consent[0]}
        </p>
      )}

      <Button type="submit" loading={loading} className="w-full btn-responsive-lg" size="lg">
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
