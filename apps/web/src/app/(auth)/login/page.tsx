'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, signInWithGoogle, ApiError } from '@/lib/supabase-api';
import { env } from '@/lib/env';
import { useVisibleHcaptcha } from '@/components/ui/hcaptcha';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GoogleIcon } from '@/components/ui/google-icon';
import { useToast } from '@/components/ui/toast';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [captchaTokenVisible, setCaptchaTokenVisible] = useState('');
  const visibleHcaptcha = useVisibleHcaptcha('kaza-hcaptcha-login', env.hcaptchaSitekey, setCaptchaTokenVisible);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (env.hcaptchaSitekey) visibleHcaptcha.render();
  }, [visibleHcaptcha]);

  async function onGoogle() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch {
      toast.error('Connexion Google impossible', 'Réessayez ou utilisez votre email.');
      setGoogleLoading(false);
    }
  }

  function afterLogin() {
    // Retour au deep-link demandé (défini par le middleware), sinon explorer.
    const redirect = searchParams.get('redirect');
    const target = redirect && redirect.startsWith('/') && !redirect.startsWith('//')
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
    // hCaptcha visible : la case doit être cochée explicitement avant
    // soumission lorsque la sitekey est configurée (pas de fallback invisible).
    if (env.hcaptchaSitekey && !captchaTokenVisible) {
      setError('Vérification anti-robot requise. Cochez la case « Je suis un humain ».');
      return;
    }
    setLoading(true);
    try {
      await signIn(trimmed, password, captchaTokenVisible);
      visibleHcaptcha.reset();
      setCaptchaTokenVisible('');
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
      // Le token hCaptcha a été consommé par l'appel : relancer un challenge.
      visibleHcaptcha.reset();
      setCaptchaTokenVisible('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">Connexion</h1>
        <p className="mt-1 text-sm text-kaza-muted">Retrouvez votre espace KAZA.</p>
      </div>

      {error && (
        <p role="alert" className="rounded-kaza border border-kaza-danger/30 bg-kaza-danger/10 px-4 py-2.5 text-sm text-kaza-danger">
          {error}
        </p>
      )}

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
        togglePassword
        autoComplete="current-password"
        required
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {env.hcaptchaSitekey && (
        <div className="flex justify-center">
          <div id="kaza-hcaptcha-login" className="min-h-[78px]" />
        </div>
      )}

      <Button type="submit" loading={loading} className="w-full btn-responsive-lg" size="lg">
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}