/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#2563EB', foreground: '#FFFFFF' },
        accent: { DEFAULT: '#16A34A', foreground: '#000000' },
        destructive: { DEFAULT: '#DC2626', foreground: '#FFFFFF' },
        background: '#EFF6FF',
        foreground: '#1E40AF',
        card: '#FFFFFF',
        'card-foreground': '#1E40AF',
        muted: '#E9EFF8',
        'muted-foreground': '#475569',
        border: '#BFDBFE',
        ring: '#2563EB',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
      },
      boxShadow: {
        DEFAULT: 'none',
      },
    },
  },
  plugins: [],
};
