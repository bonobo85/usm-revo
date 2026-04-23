import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // === Palette USM (couleurs du sceau officiel) ===
        // Fonds sombres avec teinte bleue/marine
        fond: '#0B1221',
        'fond-clair': '#101A2E',
        'fond-carte': '#16233D',

        // Bleu marine (cercle intérieur du sceau)
        bleu: '#1B3E7C',
        'bleu-clair': '#2E5AA8',
        'bleu-fonce': '#112A5A',

        // Or / bronze (bordure du sceau)
        or: '#A67C4E',
        'or-clair': '#C9994F',
        'or-fonce': '#7A5A36',

        // Rouge / bordeaux (anneau rouge + blason)
        rouge: '#B32134',
        'rouge-clair': '#D43A4F',
        'rouge-fonce': '#8B1828',

        // Bordures et texte
        'gris-bordure': '#2B3A5C',
        'texte-gris': '#A8B2C8',

        // Blanc cassé du sceau
        'blanc-sceau': '#F5F3EC',

        // === Couleurs des rangs (cohérentes avec la palette USM) ===
        'rang-sheriff': '#C9994F',    // Or (le plus haut)
        'rang-leader': '#B32134',     // Rouge USM
        'rang-coleader': '#D43A4F',   // Rouge clair
        'rang-operateur': '#A67C4E',  // Bronze
        'rang-operateur2': '#8B6A42', // Bronze foncé
        'rang-formateur': '#2E5AA8',  // Bleu USM clair
        'rang-confirme': '#1B3E7C',   // Bleu marine
        'rang-usm': '#6B7B9C',        // Bleu gris
        'rang-bcso': '#4A5670',       // Gris ardoise
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'serif'],
      },
      animation: {
        'pulse-lent': 'pulse 3s ease-in-out infinite',
      },
      boxShadow: {
        'or': '0 0 20px rgba(166, 124, 78, 0.3)',
        'bleu': '0 0 20px rgba(27, 62, 124, 0.3)',
      },
    },
  },
  plugins: [],
};

export default config;
