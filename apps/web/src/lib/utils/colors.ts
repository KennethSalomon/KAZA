// note : Constantes des tokens de couleur KAZA pour usage programmatique (Canvas, charts, styles inline)
export const KAZA_COLORS = {
  vert: '#0E4728', // Vert Kaza officiel
  peche: '#F2B091', // Pêche Kaza officiel
  mint: '#10B981', // Green Mint — succès / loyers payés
  red: '#EF4444', // Red Crimson — impayés / alertes critiques
  amber: '#F59E0B', // Amber — loyers en attente / modération

  // Aliases sémantiques
  brand: '#0E4728',
  brandDark: '#0B3820',
  brandLight: '#166534',
  peach: '#F2B091',
  peachLight: '#FDEEE7',

  // Surfaces et fonds
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  raised: '#F1F5F9',
  border: '#E2E8F0',

  // Typographie
  text: '#0F172A',
  muted: '#475569',
  faint: '#64748B',

  // Statuts
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  neutral: '#6B7280',
} as const;

export type KazaColorKey = keyof typeof KAZA_COLORS;
