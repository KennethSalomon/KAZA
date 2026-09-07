'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { requestOtp, verifyOtp, ApiError } from '@/lib/supabase-api';
import { env } from '@/lib/env';
import { useHcaptcha } from '@/components/ui/hcaptcha';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';

const OTP_LENGTH = 6;
// note : valeur stockée sur exactement OTP_LENGTH caractères — espace = case vide.
// Cela préserve les positions quand l'utilisateur clique sur une case non-séquentielle.
const EMPTY_TOKEN = ' '.repeat(OTP_LENGTH);

function PinInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  // Garantit que chars est toujours un tableau de longueur fixe
  const chars = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? ' ');

  function handleChange(idx: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1);
    if (!digit) return;
    const next = [...chars];
    next[idx] = digit;
    onChange(next.join(''));
    if (idx < OTP_LENGTH - 1) refs.current[idx + 1]?.focus();
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      const next = [...chars];
      if (next[idx] !== ' ') {
        next[idx] = ' ';
        onChange(next.join(''));
      } else if (idx > 0) {
        refs.current[idx - 1]?.focus();
        next[idx - 1] = ' ';
        onChange(next.join(''));
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
    const next = Array.from({ length: OTP_LENGTH }, (_, i) => pasted[i] ?? ' ');
    onChange(next.join(''));
    refs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  }

  return (
    <div role="group" aria-label="Code OTP à 6 chiffres" className="flex justify-center gap-2">
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={c === ' ' ? '' : c}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          aria-label={`Chiffre ${i + 1}`}
          className={cn(
            'h-12 w-10 rounded-kaza-sm border border-kaza-border bg-kaza-surface',
            'text-center text-lg font-semibold text-kaza-text',
            'transition-colors focus:border-kaza-brand focus:outline-none focus:ring-2 focus:ring-kaza-brand/20',
          )}
        />
      ))}
    </div>
  );
}

export default function VerifyOtpPage() {
  const [phone, setPhone] = useState('');
  const [token, setToken] = useState(EMPTY_TOKEN);
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();
  const hcaptcha = useHcaptcha();

  async function getCaptchaToken(): Promise<string> {
    return env.hcaptchaSitekey
      ? hcaptcha.execute({ sitekey: env.hcaptchaSitekey })
      : Promise.resolve('');
  }

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestOtp(phone, await getCaptchaToken());
      hcaptcha.reset();
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
    const filled = token.replace(/\s/g, '');
    if (filled.length < OTP_LENGTH) {
      setError('Saisissez le code complet à 6 chiffres.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(phone, filled, await getCaptchaToken());
      hcaptcha.reset();
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
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">
          {step === 'request' ? 'Connexion par SMS' : 'Vérifiez votre code'}
        </h1>
        <p className="text-sm text-kaza-muted">
          {step === 'request'
            ? 'Recevez un code à 6 chiffres sur votre téléphone.'
            : `Code envoyé au ${phone}.`}
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

      {step === 'request' ? (
        <form onSubmit={requestCode} className="space-y-5">
          <Input
            label="Numéro de téléphone"
            type="tel"
            required
            placeholder="+229 01 00 00 00 00"
            pattern="\+229[0-9]{10}"
            maxLength={16}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button type="submit" loading={loading} className="w-full" size="lg">
            Envoyer le code
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-5">
          <div className="space-y-3">
            <p className="text-center text-sm font-medium text-kaza-muted">
              Code de vérification
            </p>
            <PinInput value={token} onChange={setToken} />
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setToken(EMPTY_TOKEN);
                  setStep('request');
                }}
                className="text-xs font-medium text-kaza-brand transition-opacity hover:opacity-80"
              >
                Renvoyer le code
              </button>
            </div>
          </div>
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

      <p className="text-center text-sm text-kaza-muted">
        <Link href="/login" className="font-medium text-kaza-brand hover:opacity-80">
          ← Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
