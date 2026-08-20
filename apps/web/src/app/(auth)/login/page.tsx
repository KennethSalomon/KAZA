'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, MessageSquare } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, ApiError } from '@/lib/supabase-api';
import { env } from '@/lib/env';
import { useHcaptcha } from '@/components/ui/hcaptcha';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const hcaptcha = useHcaptcha();

  function afterLogin() {
    // note : deep-link demandé par le middleware (ex: /bail/:id) sinon explorer
    const redirect = searchParams.get('redirect');
    const target =
      redirect && redirect.startsWith('/') && !redirect.startsWith('//')
        ? redirect
        : '/explorer';
    router.push(target);
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Saisissez une adresse email valide.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // note : en local (sitekey vide) le captcha est sauté ; en prod le token
      // est obtenu avant tout appel Supabase, sinon GoTrue répond 400 captcha_failed.
      const captchaToken = env.hcaptchaSitekey
        ? await hcaptcha.execute({ sitekey: env.hcaptchaSitekey })
        : '';
      await signIn(trimmed, password, captchaToken);
      hcaptcha.reset();
      toast.success('Bienvenue sur KAZA');
      afterLogin();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Connexion impossible';
      if (/confirm/i.test(msg)) {
        setError(
          'Adresse email non confirmée. Vérifiez votre boîte mail (et les spams) pour valider votre compte.',
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">
          Bon retour sur KAZA !
        </h1>
        <p className="text-sm text-kaza-muted">
          Connectez-vous pour accéder à vos annonces et vos contacts.
        </p>
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

      <div className="space-y-1.5">
        <div className="relative">
          <Input
            label="Mot de passe"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-kaza-brand transition-opacity hover:opacity-80"
          >
            Mot de passe oublié ?
          </Link>
        </div>
      </div>

      <div className="space-y-3 pt-1">
        <Button type="submit" loading={loading} className="w-full" size="lg">
          Se connecter
        </Button>
        <Link
          href="/verify-otp"
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-kaza border border-kaza-vert px-6 py-3',
            'text-sm font-medium text-kaza-vert transition-colors hover:bg-kaza-raised',
          )}
        >
          <MessageSquare className="h-4 w-4" aria-hidden />
          Connexion rapide par SMS
        </Link>
      </div>

      <p className="text-center text-sm text-kaza-muted">
        Pas encore de compte ?{' '}
        <Link href="/register" className="font-medium text-kaza-brand hover:opacity-80">
          S&apos;inscrire
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
