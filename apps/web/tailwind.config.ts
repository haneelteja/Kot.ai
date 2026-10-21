import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // shadcn-style aliases — kept for every inherited dashboard page
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
        primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        secondary: { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-foreground)' },
        muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
        accent: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-foreground)' },
        destructive: { DEFAULT: 'var(--destructive)', foreground: 'var(--destructive-foreground)' },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',

        // KOT.ai named tokens (docs/DESIGN.md §3) — prefer these in new code
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        sunken: 'var(--surface-sunken)',
        text: 'var(--text)',
        line: 'var(--line)',
        brand: { DEFAULT: 'var(--brand)', strong: 'var(--brand-strong)', wash: 'var(--brand-wash)' },
        waiting: { DEFAULT: 'var(--waiting)', bg: 'var(--waiting-bg)' },
        progress: { DEFAULT: 'var(--progress)', bg: 'var(--progress-bg)' },
        ready: { DEFAULT: 'var(--ready)', bg: 'var(--ready-bg)' },
        done: { DEFAULT: 'var(--done)', bg: 'var(--done-bg)' },
        problem: { DEFAULT: 'var(--problem)', bg: 'var(--problem-bg)' },
        neutral: { DEFAULT: 'var(--neutral)', bg: 'var(--neutral-bg)' },
        ticket: 'var(--ticket)',
        rail: 'var(--rail)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        ticket: '10px',
      },
      boxShadow: {
        float: '0 8px 24px rgba(22,24,29,.12)',
      },
    },
  },
  plugins: [],
};

export default config;
