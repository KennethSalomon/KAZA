'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn, ApiError } from '@/lib/supabase-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success('Bienvenue sur Kaza');
      router.push('/explorer');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">Connexion</h2>
        <p className="mt-1 text-sm text-kaza-muted">Retrouvez votre espace Kaza.</p>
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
      <Input
        label="Mot de passe"
        type="password"
        autoComplete="current-password"
        required
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <Button type="submit" loading={loading} className="w-full" size="lg">
        Se connecter
      </Button>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <Link href="/verify-otp" className="font-medium text-kaza-brand transition-opacity hover:opacity-80">
            Connexion par SMS
          </Link>
          <Link href="/forgot-password" className="font-medium text-kaza-brand transition-opacity hover:opacity-80">
            Mot de passe oublié ?
          </Link>
        </div>
        <Link href="/register" className="font-medium text-kaza-brand transition-opacity hover:opacity-80">
          Créer un compte
        </Link>
      </div>
    </form>
  );
}