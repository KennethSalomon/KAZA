'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { requestOtp, verifyOtp, ApiError } from '@/lib/supabase-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

export default function VerifyOtpPage() {
  const [phone, setPhone] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestOtp(phone);
      setStep('verify');
      toast.info('Code envoyé', `Un code à 6 chiffres a été envoyé au ${phone}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Envoi impossible');
    } finally {
      setLoading(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(phone, token);
      toast.success('Connexion réussie');
      router.push('/explorer');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Code invalide');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">
          {step === 'request' ? 'Connexion par SMS' : 'Vérifiez votre code'}
        </h1>
        <p className="mt-1 text-sm text-kaza-muted">
          {step === 'request'
            ? 'Recevez un code à 6 chiffres sur votre téléphone.'
            : `Code envoyé au ${phone}.`}
        </p>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-kaza border border-kaza-danger/30 bg-kaza-danger/10 px-4 py-2.5 text-sm text-kaza-danger">
          {error}
        </p>
      )}

      {step === 'request' ? (
        <form onSubmit={requestCode} className="space-y-5">
          <Input
            label="Numéro de téléphone"
            type="tel"
            required
            placeholder="+229 97 00 00 00"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button type="submit" loading={loading} className="w-full" size="lg">
            Envoyer le code
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-5">
          <Input
            label="Code à 6 chiffres"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            placeholder="000000"
            value={token}
            onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
            hint="Consultez les SMS sur votre téléphone."
          />
          <Button type="submit" loading={loading} className="w-full" size="lg">
            Valider et me connecter
          </Button>
          <button
            type="button"
            onClick={() => setStep('request')}
            className="w-full text-center text-sm text-kaza-muted transition-colors hover:text-kaza-text"
          >
            Changer de numéro
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-kaza-muted">
        <Link href="/login" className="font-medium text-kaza-brand hover:opacity-80">
          ← Retour à la connexion
        </Link>
      </p>
    </div>
  );
}