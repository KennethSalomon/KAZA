'use client';

import { useState } from 'react';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { requestPasswordReset, ApiError } from '@/lib/supabase-api';
import { env } from '@/lib/env';
import { useHcaptcha } from '@/components/ui/hcaptcha';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const hcaptcha = useHcaptcha();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const captchaToken = env.hcaptchaSitekey
        ? await hcaptcha.execute({ sitekey: env.hcaptchaSitekey })
        : '';
      await requestPasswordReset(email, captchaToken);
      hcaptcha.reset();
      setSent(true);
      toast.success('Email envoyé', 'Vérifiez votre boîte de réception.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Envoi impossible');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-kaza-vert/10">
          <KeyRound className="h-7 w-7 text-kaza-vert" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">
            Vérifiez votre boîte mail
          </h1>
          <p className="mt-2 text-sm text-kaza-muted">
            Nous avons envoyé un lien de réinitialisation à{' '}
            <span className="font-medium text-kaza-text">{email}</span>.
            <br />
            Le lien expire rapidement.
          </p>
        </div>
        <p className="text-sm text-kaza-muted">
          <Link href="/login" className="font-medium text-kaza-brand hover:opacity-80">
            ← Retour à la connexion
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-kaza-vert/10">
          <KeyRound className="h-7 w-7 text-kaza-vert" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">
            Mot de passe oublié ?
          </h1>
          <p className="mt-1 max-w-[280px] text-sm text-kaza-muted">
            Saisissez votre email. Nous vous enverrons un lien pour créer un nouveau mot de passe.
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-kaza border border-kaza-danger/30 bg-kaza-danger/10 px-4 py-2.5 text-sm text-kaza-danger"
        >
          {error}
        </p>
      )}

      <Input
        label="Email"
        type="email"
        autoComplete="email"
        required
        placeholder="vous@exemple.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <Button type="submit" loading={loading} className="w-full" size="lg">
        Envoyer le lien
      </Button>

      <p className="text-center text-sm text-kaza-muted">
        <Link href="/login" className="font-medium text-kaza-brand hover:opacity-80">
          ← Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
