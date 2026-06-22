import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          900: '#0a0a12',
          800: '#10101c',
          700: '#181826',
          600: '#222236',
        },
        accent: {
          DEFAULT: '#7c3aed',
          glow: '#a855f7',
        },
        win: '#22d39a',
        loss: '#ef4444',
        gold: '#f5b50a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 40px -10px rgba(168,85,247,0.55)',
        'glow-win': '0 0 40px -8px rgba(34,211,154,0.6)',
      },
      backgroundImage: {
        'grid-fade': 'radial-gradient(circle at 50% 0%, rgba(124,58,237,0.18), transparent 60%)',
      },
      keyframes: {
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        pulseGlow: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
      },
      animation: {
        floaty: 'floaty 3s ease-in-out infinite',
        pulseGlow: 'pulseGlow 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
