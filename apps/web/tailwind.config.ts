import type { Config } from 'tailwindcss';
import type { PluginAPI } from 'tailwindcss/types/config';

// ============================================================
// KAZA Design Tokens — charte graphique v1 (fond clair)
// Primaire #0E4728 · Pêche #F2B091 · fonds blancs / slate clair
// ============================================================
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        kaza: {
          bg: '#F8FAFC',
          surface: '#FFFFFF',
          raised: '#F1F5F9',
          border: '#E2E8F0',
          brand: '#0E4728',
          'brand-dark': '#0B3820',
          peach: '#F2B091',
          text: '#0F172A',
          muted: '#475569',
          faint: '#64748B',
          success: '#047857',
          danger: '#B91C1C',
          warning: '#B45309',
          neutral: '#6B7280',
        },
        primary: '#003527',
        'on-primary': '#ffffff',
        'primary-container': '#064e3b',
        'on-primary-container': '#80bea6',
        'primary-fixed': '#b0f0d6',
        'primary-fixed-dim': '#95d3ba',
        'on-primary-fixed': '#002117',
        'on-primary-fixed-variant': '#0b513d',
        'inverse-primary': '#95d3ba',
        secondary: '#855300',
        'on-secondary': '#ffffff',
        'secondary-container': '#fea619',
        'on-secondary-container': '#684000',
        'secondary-fixed': '#ffddb8',
        'secondary-fixed-dim': '#ffb95f',
        'on-secondary-fixed': '#2a1700',
        'on-secondary-fixed-variant': '#653e00',
        tertiary: '#003430',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#004d47',
        'on-tertiary-container': '#6ac0b6',
        'tertiary-fixed': '#9cf2e8',
        'tertiary-fixed-dim': '#80d5cb',
        'on-tertiary-fixed': '#00201d',
        'on-tertiary-fixed-variant': '#00504a',
        surface: '#f8f9fa',
        'surface-dim': '#d9dadb',
        'surface-bright': '#f8f9fa',
        'surface-variant': '#e1e3e4',
        'surface-tint': '#2b6954',
        'surface-container': '#edeeef',
        'surface-container-low': '#f3f4f5',
        'surface-container-high': '#e7e8e9',
        'surface-container-highest': '#e1e3e4',
        'surface-container-lowest': '#ffffff',
        'inverse-surface': '#2e3132',
        'inverse-on-surface': '#f0f1f2',
        background: '#f8f9fa',
        'on-background': '#191c1d',
        'on-surface': '#191c1d',
        'on-surface-variant': '#404944',
        outline: '#707974',
        'outline-variant': '#bfc9c3',
        error: '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',
      },
      spacing: {
        'stack-sm': '4px',
        'stack-md': '12px',
        'stack-lg': '24px',
        'margin-mobile': '16px',
        'margin-desktop': '24px',
        gutter: '16px',
        base: '8px',
      },
      fontFamily: {
        sans: ['var(--font-geist)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-sora)', 'Inter', 'system-ui', 'sans-serif'],
        'headline-lg': ['Inter', 'sans-serif'],
        'display-lg': ['Inter', 'sans-serif'],
        'body-lg': ['Inter', 'sans-serif'],
        'label-md': ['Inter', 'sans-serif'],
        'label-lg': ['Inter', 'sans-serif'],
        'headline-lg-mobile': ['Inter', 'sans-serif'],
        'body-md': ['Inter', 'sans-serif'],
        'title-lg': ['Inter', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['57px', { lineHeight: '64px', letterSpacing: '-0.25px', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '40px', fontWeight: '600' }],
        'headline-lg-mobile': ['28px', { lineHeight: '36px', fontWeight: '600' }],
        'title-lg': ['22px', { lineHeight: '28px', fontWeight: '500' }],
        'body-lg': ['16px', { lineHeight: '24px', letterSpacing: '0.5px', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '20px', letterSpacing: '0.25px', fontWeight: '400' }],
        'label-lg': ['14px', { lineHeight: '20px', letterSpacing: '0.1px', fontWeight: '500' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.5px', fontWeight: '500' }],
      },
      borderRadius: {
        kaza: '12px',
        'kaza-lg': '18px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 10px 30px -14px rgba(15, 23, 42, 0.14)',
        'card-hover': '0 2px 4px rgba(15, 23, 42, 0.05), 0 20px 44px -18px rgba(15, 23, 42, 0.2)',
        glow: '0 0 0 1px rgba(14, 71, 40, 0.28), 0 8px 32px -8px rgba(14, 71, 40, 0.32)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [
    // note : utilitaires custom pour le design system Kaza
    function ({ addUtilities }: PluginAPI) {
      addUtilities({
        '.tabular-nums': { 'font-variant-numeric': 'tabular-nums' },
        '.text-balance': { 'text-wrap': 'balance' },
        '.brand-ring': {
          'box-shadow': '0 0 0 1px rgba(14, 71, 40, 0.3), 0 0 0 4px rgba(14, 71, 40, 0.12)',
        },
      });
    },
  ],
};

export default config;