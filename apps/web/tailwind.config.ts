import type { Config } from 'tailwindcss';
import type { PluginAPI } from 'tailwindcss/types/config';

// ============================================================
// KAZA Design Tokens — Charte graphique & Design System
// Vert #0E4728 · Pêche #F2B091 · Mint #10B981 · Red #EF4444 · Amber #F59E0B
// Typographies : Sora (Titres) & Geist Sans (Corps & Tableaux)
// ============================================================
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        kaza: {
          // Tokens officiels de la charte KAZA
          vert: '#0E4728', // Vert Kaza officiel — actions primaires, navigation, identité
          peche: '#F2B091', // Pêche Kaza officiel — CTA marketing, accents chaleureux
          mint: '#10B981', // Green Mint — loyers payés, succès, tendances positives
          red: '#EF4444', // Red Crimson — impayés, retards, erreurs critiques
          amber: '#F59E0B', // Amber — loyers en attente, alertes, avertissements

          // Aliases sémantiques et surfaces
          brand: '#0E4728',
          'brand-dark': '#0B3820',
          'brand-light': '#166534',
          peach: '#F2B091',
          'peach-light': '#FDEEE7',
          'peach-dark': '#E09270',

          // Surfaces et fonds
          bg: '#F8FAFC', // slate 50 — fond d'écran principal
          surface: '#FFFFFF', // blanc — cartes et conteneurs
          raised: '#F1F5F9', // slate 100 — survols et zones secondaires
          border: '#E2E8F0', // slate 200 — bordures structurelles

          // Typographie et textes
          text: '#0F172A', // slate 900 — texte principal, titres
          muted: '#475569', // slate 600 — texte secondaire, sous-titres
          faint: '#64748B', // slate 500 — placeholders, légendes

          // Rôles statutaires
          success: '#10B981', // Green Mint
          danger: '#EF4444', // Red Crimson
          warning: '#F59E0B', // Amber
          neutral: '#6B7280', // Gris neutre
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'var(--font-geist)', 'system-ui', 'sans-serif'],
        display: ['var(--font-sora)', 'system-ui', 'sans-serif'],
        sora: ['var(--font-sora)', 'sans-serif'],
        geist: ['var(--font-geist-sans)', 'var(--font-geist)', 'sans-serif'],
      },
      borderRadius: {
        kaza: '12px', // standard KAZA pour inputs, boutons, cartes
        'kaza-sm': '8px',
        'kaza-lg': '18px',
        'kaza-xl': '24px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(15, 23, 42, 0.04), 0 10px 30px -14px rgba(15, 23, 42, 0.12)',
        'card-hover': '0 4px 6px rgba(15, 23, 42, 0.05), 0 20px 44px -18px rgba(15, 23, 42, 0.18)',
        glow: '0 0 0 1px rgba(14, 71, 40, 0.28), 0 8px 32px -8px rgba(14, 71, 40, 0.32)',
        'glow-peach': '0 0 0 1px rgba(242, 176, 145, 0.4), 0 8px 32px -8px rgba(242, 176, 145, 0.35)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.3s ease-out both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [
    // note : utilitaires typographiques et d'interaction pour KAZA
    function ({ addUtilities }: PluginAPI) {
      addUtilities({
        '.tabular-nums': { 'font-variant-numeric': 'tabular-nums' },
        '.text-balance': { 'text-wrap': 'balance' },
        '.brand-ring': {
          'box-shadow': '0 0 0 1px rgba(14, 71, 40, 0.3), 0 0 0 4px rgba(14, 71, 40, 0.12)',
        },
        '.peach-ring': {
          'box-shadow': '0 0 0 1px rgba(242, 176, 145, 0.5), 0 0 0 4px rgba(242, 176, 145, 0.2)',
        },
      });
    },
  ],
};

export default config;