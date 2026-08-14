'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updatePassword, ApiError } from '@/lib/supabase-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    // Le lien de réinitialisation contient le token dans l'URL ; s'il est
    // invalide/expiré, updateUser échouera avec une erreur claire.
    if (window.location.hash && !window.location.hash.includes('access_token')) {
      setInvalid(true);
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('8 caractères minimum');
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas');
      return;
    }
    setLoading(true);
    try {
      await updatePassword(password);
      toast.success('Mot de passe mis à jour', 'Connectez-vous avec votre nouveau mot de passe.');
      router.push('/login');
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Lien expiré ou invalide. Demandez un nouveau lien.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">
          Nouveau mot de passe
        </h2>
        <p className="mt-1 text-sm text-kaza-muted">
          Choisissez un mot de passe robuste (8 caractères min, lettres + chiffres).
        </p>
      </div>

      {invalid && (
        <p role="alert" className="rounded-kaza border border-kaza-danger/30 bg-kaza-danger/10 px-4 py-2.5 text-sm text-kaza-danger">
          Ce lien est invalide ou a expiré.{' '}
          <Link href="/forgot-password" className="font-medium underline">
            Demandez un nouveau lien
          </Link>
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-kaza border border-kaza-danger/30 bg-kaza-danger/10 px-4 py-2.5 text-sm text-kaza-danger">
          {error}
        </p>
      )}

      <Input
        label="Nouveau mot de passe"
        type="password"
        autoComplete="new-password"
        required
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Input
        label="Confirmer le mot de passe"
        type="password"
        autoComplete="new-password"
        required
        placeholder="••••••••"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />

      <Button type="submit" loading={loading} className="w-full" size="lg">
        Mettre à jour
      </Button>
    </form>
  );
}
