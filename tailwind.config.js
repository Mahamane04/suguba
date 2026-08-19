/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        sans:  ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        suguba: {
          /* Vert Mali — identique au landing sugubaml.com */
          50:      '#f0fdf4',
          100:     '#dcfce7',
          200:     '#bbf7d0',
          300:     '#86efac',
          400:     '#4ade80',
          500:     '#22c55e',
          600:     '#16a34a',
          700:     '#15803d',
          800:     '#166534',
          900:     '#14532d',
          brand:   '#09b500',   /* ✅ Couleur officielle sugubaml.com */
          'brand-dark': '#078000',
          'brand-light': '#e6fee6',
          dark:    '#0f172a',
          orange:  '#f97316',
          gold:    '#f59e0b',
        }
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'brand-sm': '0 2px 8px rgb(9 181 0 / 0.15)',
        'brand-md': '0 4px 16px rgb(9 181 0 / 0.20)',
        'brand-lg': '0 8px 32px rgb(9 181 0 / 0.25)',
        'card': '0 1px 4px rgb(0 0 0 / 0.06), 0 2px 12px rgb(0 0 0 / 0.04)',
        'card-hover': '0 4px 20px rgb(0 0 0 / 0.10)',
        'float': '0 16px 48px rgb(0 0 0 / 0.12)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #09b500 0%, #16a34a 50%, #065f46 100%)',
        'hero-gradient': 'linear-gradient(160deg, #064e3b 0%, #065f46 30%, #0f172a 100%)',
        'card-gradient': 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
        'gold-gradient': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      },
      animation: {
        'fade-up':    'fadeUp 0.4s ease forwards',
        'fade-in':    'fadeIn 0.3s ease forwards',
        'slide-down': 'slideDown 0.2s ease',
        'bounce-soft': 'bounceSoft 1s ease infinite',
        'pulse-green': 'pulseGreen 2s infinite',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-4px)' },
        },
        pulseGreen: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(9 181 0 / 0.35)' },
          '50%':      { boxShadow: '0 0 0 8px rgb(9 181 0 / 0)' },
        },
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
      },
    },
  },
  plugins: [],
}
