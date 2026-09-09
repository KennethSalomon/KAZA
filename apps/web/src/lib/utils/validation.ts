// note : Fonctions pures de validation pour les formulaires et saisies KAZA

/**
 * Valide le format officiel d'un numéro de téléphone béninois (+229 suivi de 10 chiffres).
 */
export function isValidBeninPhone(phone: string): boolean {
  const sanitized = phone.replace(/\s+/g, '');
  return /^\+229\d{10}$/.test(sanitized);
}

/**
 * Formate un numéro de téléphone brut en format lisible (+229 01 23 45 67 89).
 */
export function formatBeninPhone(rawPhone: string): string {
  const sanitized = rawPhone.replace(/\s+/g, '');
  if (!sanitized.startsWith('+229') || sanitized.length !== 14) {
    return rawPhone;
  }
  const digits = sanitized.slice(4);
  const parts = [
    digits.slice(0, 2),
    digits.slice(2, 4),
    digits.slice(4, 6),
    digits.slice(6, 8),
    digits.slice(8, 10),
  ];
  return `+229 ${parts.join(' ')}`;
}

/**
 * Validation basique et stricte d'adresse email.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Valide qu'un montant est strictement positif.
 */
export function isValidAmount(amount: number | string): boolean {
  const numeric = typeof amount === 'number' ? amount : Number(amount);
  return !Number.isNaN(numeric) && numeric > 0;
}
