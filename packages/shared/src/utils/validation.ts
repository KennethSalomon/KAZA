export function isValidBeninPhone(phone: string): boolean {
  const sanitized = phone.replace(/\s+/g, '');
  return /^\+229\d{10}$/.test(sanitized);
}

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

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidAmount(amount: number | string): boolean {
  const numeric = typeof amount === 'number' ? amount : Number(amount);
  return !Number.isNaN(numeric) && numeric > 0;
}
