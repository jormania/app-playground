/** @type {import('tailwindcss').Config} */

// Tailwind is scoped to the Sol Odyssey app ONLY. The other apps in this repo are
// design-locked (see LEGACY.md) and own their own CSS — `content` deliberately never
// reaches them, so no utilities or preflight are ever generated against them.
//
// Every colour maps to a Claude Design System semantic token (var(--color-*) defined in
// src/sol-odyssey/styles/tokens.css). Components consume these names, never raw hex —
// rebrand the whole app by editing tokens.css alone.
export default {
  content: [
    './sol-odysseys-react.html',
    './src/sol-odyssey/**/*.{ts,tsx}',
    './daily-stoic.html',
    './src/daily-stoic/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'background-primary': 'var(--color-background-primary)',
        'background-secondary': 'var(--color-background-secondary)',
        'background-tertiary': 'var(--color-background-tertiary)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'border-primary': 'var(--color-border-primary)',
        'border-secondary': 'var(--color-border-secondary)',
        'border-tertiary': 'var(--color-border-tertiary)',
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          contrast: 'var(--color-accent-contrast)',
          soft: 'var(--color-accent-soft)',
        },
        energy: 'var(--color-energy)',
        success: 'var(--color-success)',
        caution: 'var(--color-caution)',
      },
      borderColor: {
        DEFAULT: 'var(--color-border-tertiary)',
        primary: 'var(--color-border-primary)',
        secondary: 'var(--color-border-secondary)',
        tertiary: 'var(--color-border-tertiary)',
      },
      fontFamily: {
        display: ['"Fraunces Variable"', 'Fraunces', 'Georgia', 'serif'],
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        pill: 'var(--radius-pill)',
      },
      transitionDuration: {
        fast: 'var(--motion-fast)',
        base: 'var(--motion-base)',
        slow: 'var(--motion-slow)',
      },
    },
  },
  plugins: [],
}
