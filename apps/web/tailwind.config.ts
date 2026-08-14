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
          bg: '#F8FAFC', // slate 50 — fond des pages
          surface: '#FFFFFF', // blanc — cartes de contenu
          raised: '#F1F5F9', // slate 100 — hover / zones légères
          border: '#E2E8F0', // slate 200 — bordures
          brand: '#0E4728', // vert Kaza — actions, liens, accents
          'brand-dark': '#0B3820', // hover primaire
          peach: '#F2B091', // pêche / sable — badges, CTA chaleureux
          text: '#0F172A', // slate 900 — titres, données
          muted: '#475569', // slate 600 — texte secondaire
          faint: '#64748B', // slate 500 — placeholders
          success: '#10B981', // vert mint — validé
          danger: '#EF4444', // crimson — impayé / erreur
          warning: '#F59E0B', // ambre — en attente
          neutral: '#6B7280',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist)', 'system-ui', 'sans-serif'],
        display: ['var(--font-sora)', 'var(--font-geist)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        kaza: '12px', // boutons, inputs, cartes
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