export const KAZA_COLORS = {
  vert: '#0E4728',
  peche: '#F2B091',
  mint: '#10B981',
  red: '#EF4444',
  amber: '#F59E0B',

  brand: '#0E4728',
  brandDark: '#0B3820',
  brandLight: '#166534',
  peach: '#F2B091',
  peachLight: '#FDEEE7',

  bg: '#F8FAFC',
  surface: '#FFFFFF',
  raised: '#F1F5F9',
  border: '#E2E8F0',

  text: '#0F172A',
  muted: '#475569',
  faint: '#64748B',

  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  neutral: '#6B7280',
} as const;

export type KazaColorKey = keyof typeof KAZA_COLORS;
