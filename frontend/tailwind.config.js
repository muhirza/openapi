/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // ---- Surfaces (3 levels max) ----
        surface: '#FFFFFF',
        canvas: '#F8FAFC',
        'surface-muted': '#F1F5F9',

        // ---- Lines ----
        line: '#E2E8F0',
        'line-strong': '#CBD5E1',

        // ---- Text ladder (use only these 4 weights of ink) ----
        ink: '#0F172A', // headings / primary values
        'ink-2': '#334155', // body
        'ink-3': '#64748B', // secondary / labels
        'ink-4': '#94A3B8', // placeholder / disabled

        // ---- Primary action (blue = action only) ----
        primary: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
          subtle: '#EFF6FF',
          border: '#BFDBFE',
          foreground: '#FFFFFF',
        },

        // ---- Status (hue = meaning only: success/warning/danger/info) ----
        success: {
          DEFAULT: '#16A34A',
          subtle: '#DCFCE7',
          border: '#BBF7D0',
          strong: '#15803D',
        },
        warning: {
          DEFAULT: '#D97706',
          subtle: '#FEF3C7',
          border: '#FDE68A',
          strong: '#B45309',
        },
        danger: {
          DEFAULT: '#DC2626',
          subtle: '#FEE2E2',
          border: '#FECACA',
          strong: '#B91C1C',
        },
        info: {
          DEFAULT: '#0284C7',
          subtle: '#E0F2FE',
          border: '#BAE6FD',
          strong: '#0369A1',
        },

        // ---- Legacy aliases (kept so older markup keeps working) ----
        accent: { DEFAULT: '#16A34A', foreground: '#000000' },
        destructive: { DEFAULT: '#DC2626', foreground: '#FFFFFF' },
        background: '#F8FAFC',
        foreground: '#0F172A',
        card: '#FFFFFF',
        'card-foreground': '#0F172A',
        muted: '#F1F5F9',
        'muted-foreground': '#64748B',
        border: '#E2E8F0',
        ring: '#2563EB',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      fontSize: {
        // One extra step below text-xs instead of arbitrary text-[10px]
        '2xs': ['0.6875rem', { lineHeight: '1rem' }], // 11px
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        // Two radii: controls vs surfaces
        control: '0.375rem', // 6px — inputs, buttons, chips
        surface: '0.5rem', // 8px — cards, panels
      },
      boxShadow: {
        DEFAULT: 'none',
      },
    },
  },
  plugins: [],
};
