'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signUp, ApiError } from '@/lib/supabase-api';
import { env } from '@/lib/env';
import { useHcaptcha } from '@/components/ui/hcaptcha';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

  const set = (key: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
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
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      else if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Création impossible');
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
          placeholder="+229 01 00 00 00 00"
          pattern="\+229[0-9]{10}"
          maxLength={16}
          value={form.phone}
          onChange={set('phone')}
          error={errors.phone?.[0]}
        />
      </div>
      <Input
        label="Mot de passe"
        type="password"
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
          J’accepte que MARSAL TECHNOLOGIES traite mes données personnelles (identité, coordonnées) conformément à la
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