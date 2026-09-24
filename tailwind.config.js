/**
 * ═══════════════════════════════════════════════════════════════════════
 *  RÈGLES DE DESIGN SUGUBA — à respecter dans tout nouvel écran
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Ces jetons existaient déjà mais n'étaient presque pas utilisés : audit du
 *  2026-09-09 — 15 usages de `suguba-brand` contre ~160 boutons peints en
 *  `emerald-500/600/700` ou en `#09b500` écrit en dur, deux échelles de gris
 *  mélangées (slate 1477× / gray 397×), 7 rayons et 12 tailles de texte.
 *  D'où ces règles, et surtout le composant qui les applique.
 *
 *  1. PALETTE VERTE (refonte du 2026-09-23, audit UI « un seul vert, bien
 *     utilisé ») — chaque vert a UN rôle :
 *       suguba-profond  #0B3B2C  en-têtes, menu du bas, bouton principal
 *                                (texte blanc, 12,5:1), textes forts
 *       suguba-brand    #09B500  marque, icônes, succès. JAMAIS de texte
 *                                blanc dessus : 2,76:1, illisible au soleil.
 *                                Texte posé dessus : suguba-profond.
 *       suguba-wa       #25D366  uniquement les boutons qui ouvrent WhatsApp
 *       suguba-citron   #C7F464  ce qui compte : gains, solde, onglet actif,
 *                                action sur fond profond (texte profond)
 *       suguba-menthe / suguba-sauge   fonds clairs
 *     Texte vert sur fond blanc : `suguba-brand-dark` (5,1:1), pas `brand`.
 *     Rouge : erreurs et annulations seulement.
 *
 *  2. NEUTRES — une seule échelle : `slate`. Ne pas introduire `gray`.
 *
 *  3. RAYONS — boutons en pilule (`rounded-full`, via <Button>) ;
 *       rounded-xl   champs, petites pastilles
 *       rounded-2xl  cartes internes
 *       rounded-3xl  cartes de page
 *
 *  4. TEXTE — `text-xs` vaut 13 px (surchargé plus bas) : c'est le minimum.
 *     Pas de `text-[11px]`, `text-[10px]`… Graisse maximale : `font-bold`
 *     (pas de `font-black`) — quand tout est extra-gras, rien ne ressort.
 *
 *  5. BOUTONS — passer par <Button> (src/components/ui/Button.tsx), pas par
 *     des classes à la main. C'est lui qui tient les règles ci-dessus.
 *
 *  Adoption : tout nouvel écran suit ces règles ; un écran modifié pour
 *  autre chose est converti au passage. Pas de refonte en bloc — 75 pages
 *  converties d'un coup, c'est du risque visuel pour zéro gain fonctionnel.
 * ═══════════════════════════════════════════════════════════════════════
 */

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
          /* Palette verte du 2026-09-23 (voir règle 1 en tête de fichier). */
          profond:   '#0B3B2C',
          'profond-2': '#145A43',
          citron:    '#C7F464',
          wa:        '#25D366',
          menthe:    '#E9F5E6',
          sauge:     '#F3F7F1',
          dark:    '#0f172a',
          orange:  '#f97316',
          gold:    '#f59e0b',
        }
      },
      // `text-xs` passe de 12 à 13 px : c'est désormais le plus petit texte
      // de l'app (les text-[9..11px] ont été ramenés à text-xs).
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.15rem' }],
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
