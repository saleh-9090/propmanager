import type { Config } from 'tailwindcss'

function rgb(varName: string) {
  return `rgb(var(${varName}) / <alpha-value>)`
}

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base:     rgb('--bg-base'),
          surface:  rgb('--bg-surface'),
          elevated: rgb('--bg-elevated'),
        },
        border: {
          DEFAULT: rgb('--border'),
          hover:   rgb('--border-hover'),
        },
        text: {
          primary:   rgb('--text-primary'),
          secondary: rgb('--text-secondary'),
          muted:     rgb('--text-muted'),
        },
        brand: {
          primary:       rgb('--color-primary'),
          'primary-hover': rgb('--color-primary-hover'),
          secondary:     rgb('--color-secondary'),
          accent:        rgb('--color-accent'),
        },
        success: rgb('--success'),
        warning: rgb('--warning'),
        danger:  rgb('--danger'),
      },
      fontFamily: {
        arabic: ['var(--font-ibm-arabic)', 'system-ui', 'sans-serif'],
        mono:   ['var(--font-ibm-mono)', 'monospace'],
      },
      borderRadius: {
        btn:   '8px',
        input: '10px',
        card:  '12px',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out forwards',
      },
    },
  },
  plugins: [],
}

export default config
