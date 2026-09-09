'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Building2, Landmark, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stepper, type Step } from '@/components/forms/stepper';
import { useToast } from '@/components/ui/toast';
import { apiToast } from '@/lib/api-toast';
import {
  ApiError,
  completeLandlordOnboarding,
  getMyBilling,
  type MomoProvider,
} from '@/lib/supabase-api';
import { cn } from '@/lib/utils/cn';

const STEPS: readonly Step[] = [
  { key: 'legal', label: 'Identité légale' },
  { key: 'momo', label: 'Mobile Money' },
  { key: 'bank', label: 'Compte bancaire' },
] as const;

interface FormState {
  business_name: string;
  tax_id: string;
  momo_provider: MomoProvider | '';
  momo_number: string;
  bank_name: string;
  bank_iban: string;
}

const initialForm: FormState = {
  business_name: '',
  tax_id: '',
  momo_provider: '',
  momo_number: '',
  bank_name: '',
  bank_iban: '',
};

const PROVIDERS: { id: MomoProvider; label: string; color: string }[] = [
  { id: 'mtn', label: 'MTN MoMo', color: 'bg-kaza-amber/15 text-kaza-amber border-kaza-amber/30' },
  { id: 'moov', label: 'Moov Money', color: 'bg-kaza-vert/10 text-kaza-vert border-kaza-vert/25' },
  { id: 'celtiis', label: 'Celtiis Cash', color: 'bg-kaza-red/10 text-kaza-red border-kaza-red/25' },
];

// note : format béninois — +229 suivi de 10 chiffres, même règle que
// assertBeninPhone côté supabase-api.ts pour cohérence UX.
const BENIN_PHONE_RE = /^\+229\d{10}$/;

export default function LandlordOnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const load = useCallback(async () => {
    try {
      const b = await getMyBilling();
      if (!b) return;
      if (b.onboarding_completed) {
        router.replace('/landlord');
        return;
      }
      setForm((prev) => ({
        business_name: b.business_name ?? prev.business_name,
        tax_id: b.tax_id ?? prev.tax_id,
        momo_provider: (b.momo_provider ?? prev.momo_provider) as MomoProvider | '',
        momo_number: b.momo_number ?? prev.momo_number,
        bank_name: b.bank_name ?? prev.bank_name,
        bank_iban: b.bank_iban ?? prev.bank_iban,
      }));
    } catch (err) {
      apiToast(toast, err, 'Chargement des coordonnées impossible');
    }
  }, [router, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const stepValid = useMemo(() => {
    if (current === 0) return form.business_name.trim().length >= 2;
    if (current === 1)
      return form.momo_provider !== '' && BENIN_PHONE_RE.test(form.momo_number.replace(/\s+/g, ''));
    return true;
  }, [current, form]);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  }

  function next() {
    if (!stepValid) {
      if (current === 0) setErrors({ business_name: 'Nom requis (2 caractères minimum).' });
      if (current === 1) {
        if (!form.momo_provider) setErrors({ momo_provider: 'Choisissez un opérateur.' });
        else setErrors({ momo_number: 'Format attendu : +229 01 00 00 00 00.' });
      }
      return;
    }
    setCurrent((c) => Math.min(STEPS.length - 1, c + 1));
  }

  function prev() {
    setCurrent((c) => Math.max(0, c - 1));
  }

  async function submit() {
    if (form.momo_provider === '') return;
    setSaving(true);
    try {
      await completeLandlordOnboarding({
        business_name: form.business_name.trim(),
        tax_id: form.tax_id.trim() || undefined,
        momo_provider: form.momo_provider,
        momo_number: form.momo_number.replace(/\s+/g, ''),
        bank_name: form.bank_name.trim() || undefined,
        bank_iban: form.bank_iban.replace(/\s+/g, '') || undefined,
      });
      toast.success('Bienvenue sur KAZA ! Espace bailleur prêt.');
      router.replace('/landlord');
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else apiToast(toast, err, 'Onboarding impossible');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-kaza-text">
          Configurez votre espace bailleur
        </h1>
        <p className="mt-1 text-sm text-kaza-muted">
          3 étapes pour encaisser vos loyers en toute sécurité.
        </p>
      </div>

      <Stepper steps={STEPS} current={current} />

      <div className="mt-8 space-y-5">
        {current === 0 && (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm text-kaza-muted">
              <Building2 className="h-4 w-4 text-kaza-vert" aria-hidden />
              Identité légale du bailleur
            </p>
            <Input
              label="Nom ou raison sociale *"
              value={form.business_name}
              onChange={(e) => set('business_name', e.target.value)}
              placeholder="Ex : Kossou Bertin ou SARL Immo Bénin"
              autoComplete="organization"
              error={errors.business_name}
              required
            />
            <Input
              label="IFU (facultatif)"
              value={form.tax_id}
              onChange={(e) => set('tax_id', e.target.value)}
              placeholder="Identifiant Fiscal Unique"
              hint="Nécessaire uniquement pour les personnes morales."
            />
          </div>
        )}

        {current === 1 && (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm text-kaza-muted">
              <Smartphone className="h-4 w-4 text-kaza-vert" aria-hidden />
              Compte mobile money d&apos;encaissement
            </p>
            <fieldset>
              <legend className="kaza-label">Opérateur *</legend>
              <div className="grid grid-cols-3 gap-2">
                {PROVIDERS.map((p) => {
                  const selected = form.momo_provider === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => set('momo_provider', p.id)}
                      aria-pressed={selected}
                      className={cn(
                        'rounded-kaza border px-3 py-3 text-sm font-medium transition-all',
                        selected
                          ? `${p.color} ring-2 ring-kaza-vert/40`
                          : 'border-kaza-border bg-kaza-surface text-kaza-muted hover:border-kaza-vert/40',
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
              {errors.momo_provider && (
                <p role="alert" className="mt-1.5 text-xs text-kaza-danger">
                  {errors.momo_provider}
                </p>
              )}
            </fieldset>
            <Input
              label="Numéro mobile money *"
              value={form.momo_number}
              onChange={(e) => set('momo_number', e.target.value)}
              placeholder="+229 01 00 00 00 00"
              inputMode="tel"
              autoComplete="tel"
              error={errors.momo_number}
              hint="Ce numéro recevra les loyers encaissés via FedaPay."
              required
            />
          </div>
        )}

        {current === 2 && (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm text-kaza-muted">
              <Landmark className="h-4 w-4 text-kaza-vert" aria-hidden />
              Compte bancaire (facultatif)
            </p>
            <p className="rounded-kaza border border-kaza-border bg-kaza-raised/50 px-4 py-3 text-xs text-kaza-muted">
              Renseignez un compte bancaire uniquement si vous acceptez les virements en plus du
              mobile money. Sinon, laissez vide et validez.
            </p>
            <Input
              label="Nom de la banque"
              value={form.bank_name}
              onChange={(e) => set('bank_name', e.target.value)}
              placeholder="Ex : Ecobank Bénin"
              autoComplete="off"
            />
            <Input
              label="IBAN"
              value={form.bank_iban}
              onChange={(e) => set('bank_iban', e.target.value)}
              placeholder="BJ66 XXXX XXXX XXXX XXXX XXXX XXXX"
              autoComplete="off"
              hint="Format IBAN Bénin : BJ66 suivi de 24 chiffres."
            />
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={prev}
          disabled={current === 0 || saving}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Précédent
        </Button>
        {current < STEPS.length - 1 ? (
          <Button type="button" onClick={next} disabled={!stepValid}>
            Suivant
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button type="button" onClick={() => void submit()} loading={saving} variant="primary">
            Terminer l&apos;inscription
          </Button>
        )}
      </div>
    </div>
  );
}
