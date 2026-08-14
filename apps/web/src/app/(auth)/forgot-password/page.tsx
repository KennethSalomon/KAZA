'use client';

import { useState } from 'react';
import Link from 'next/link';
import { requestPasswordReset, ApiError } from '@/lib/supabase-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email);
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
        <h2 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">
          Vérifiez votre boîte mail
        </h2>
        <p className="text-sm text-kaza-muted">
          Nous avons envoyé un lien de réinitialisation à <span className="font-medium text-kaza-text">{email}</span>.
          <br />
          Le lien expire rapidement.
        </p>
        <p className="text-sm text-kaza-muted">
          <Link href="/login" className="font-medium text-kaza-brand hover:opacity-80">
            Retour à la connexion
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">
          Mot de passe oublié
        </h2>
        <p className="mt-1 text-sm text-kaza-muted">
          Saisissez votre email pour recevoir un lien de réinitialisation.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-kaza border border-kaza-danger/30 bg-kaza-danger/10 px-4 py-2.5 text-sm text-kaza-danger">
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
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
