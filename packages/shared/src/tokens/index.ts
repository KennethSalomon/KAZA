export const colors = {
  kaza: {
    vert: '#0E4728',
    peche: '#F2B091',
    mint: '#10B981',
    red: '#EF4444',
    amber: '#F59E0B',
  },
  semantic: {
    brand: '#0E4728',
    brandDark: '#0B3820',
    brandLight: '#166534',
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
  },
} as const;

export const fonts = {
  display: 'Sora',
  body: 'GeistSans',
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
} as const;

export const shadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHover: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;
