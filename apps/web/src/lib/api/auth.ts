import { supabase } from '../supabase-client';
import { env } from '../env';
import type { Profile } from '../types';
import { ApiError, normalizeError, callFunction } from '../supabase-api';

/** Valide un numéro de téléphone bénin : +229 suivi de 10 chiffres. */
function assertBeninPhone(phone: string): void {
  const cleaned = phone.replace(/\s+/g, '');
  if (!/^\+229\d{10}$/.test(cleaned)) {
    throw new ApiError(400, 'Numéro invalide — format attendu : +229 01 00 00 00 00');
  }
}

export async function signIn(email: string, password: string, captchaToken: string): Promise<void> {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, captchaToken }),
  });
  const payload = (await res.json().catch(() => null)) as {
    error?: string;
    access_token?: string;
    refresh_token?: string;
    retryAfter?: number;
  } | null;

  if (!res.ok || !payload?.access_token || !payload.refresh_token) {
    if (res.status === 429) {
      throw new ApiError(
        429,
        'Trop de tentatives de connexion. Patientez quelques secondes avant de réessayer.',
      );
    }
    throw new ApiError(res.status, payload?.error ?? `Erreur ${res.status}`);
  }

  const { error } = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  });
  if (error) throw new ApiError(400, error.message);
}

export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw new ApiError(400, error.message);
}

export async function signUp(
  input: {
    email: string;
    password: string;
    full_name: string;
    phone: string;
    role: 'locataire' | 'bailleur';
    consent_apdp: boolean;
  },
  captchaToken: string,
): Promise<{ needsEmailConfirmation: boolean }> {
  assertBeninPhone(input.phone);
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 2000;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        captchaToken,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: input.full_name,
          phone: input.phone,
          role: input.role,
          consent_apdp: input.consent_apdp,
        },
      },
    });

    if (!error) {
      if (!data.user) throw new ApiError(400, 'Inscription impossible');
      return { needsEmailConfirmation: !data.session };
    }

    const msg = (error.message ?? '').toLowerCase();
    const isRateLimit =
      error.status === 429 ||
      msg.includes('rate limit') ||
      msg.includes('too many requests') ||
      msg.includes('email rate') ||
      msg.includes('database error saving new user');

    if (isRateLimit && attempt < MAX_RETRIES - 1) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    if (isRateLimit) {
      throw new ApiError(
        429,
        'Trop de tentatives d\'inscription. Patientez quelques minutes avant de réessayer.',
      );
    }

    throw new ApiError(400, error.message);
  }

  throw new ApiError(400, 'Inscription impossible');
}

export async function requestOtp(phone: string, captchaToken: string): Promise<void> {
  assertBeninPhone(phone);
  const { error } = await supabase.auth.signInWithOtp({ phone, options: { captchaToken } });
  if (error) throw new ApiError(400, error.message);
}

export async function verifyOtp(phone: string, token: string, captchaToken: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
    options: { captchaToken },
  });
  if (error) throw new ApiError(400, error.message);
}

export async function requestPasswordReset(
  email: string,
  captchaToken: string,
  redirectTo?: string,
): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    captchaToken,
    redirectTo: redirectTo ?? '/reset-password',
  });
  if (error) throw new ApiError(400, error.message);
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new ApiError(400, error.message);
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw normalizeError(error, 'Profil introuvable');
  return data;
}

export async function updateProfile(patch: { full_name?: string; phone?: string }): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id);
  if (error) throw normalizeError(error, 'Mise à jour impossible');
}