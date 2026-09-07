import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        kaza: {
          vert: '#0E4728',
          'vert-light': '#166534',
          'vert-dark': '#0B3820',
          peche: '#F2B091',
          'peche-light': '#FDEEE7',
          mint: '#10B981',
          red: '#EF4444',
          amber: '#F59E0B',
          'amber-light': '#FEF3C7',
          orange: '#F97316',
        },
        brand: '#0E4728',
      },
      fontFamily: {
        sora: ['Sora'],
        geist: ['GeistSans'],
      },
      borderRadius: {
        kaza: '12px',
        'kaza-lg': '16px',
        'kaza-xl': '20px',
        'kaza-2xl': '24px',
      },
    },
  },
  plugins: [],
} satisfies Config;
