/** @type {import('tailwindcss').Config} */
export default {
  // Wrap every hover: variant in @media (hover: hover) so touch screens never get stuck hover states.
  future: { hoverOnlyWhenSupported: true },
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design tokens (see src/index.css). Prefer these in new code.
        base: 'rgb(var(--c-base) / <alpha-value>)',
        surface: {
          1: 'rgb(var(--c-surface-1) / <alpha-value>)',
          2: 'rgb(var(--c-surface-2) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--c-line) / 0.14)',
          strong: 'rgb(var(--c-line) / 0.26)',
        },
        fg: {
          DEFAULT: 'rgb(var(--c-fg) / <alpha-value>)',
          muted: 'rgb(var(--c-fg-muted) / <alpha-value>)',
          subtle: 'rgb(var(--c-fg-subtle) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',
          strong: 'rgb(var(--c-accent-strong) / <alpha-value>)',
        },
        signal: {
          port: 'rgb(var(--c-port) / <alpha-value>)',
          starboard: 'rgb(var(--c-starboard) / <alpha-value>)',
          caution: 'rgb(var(--c-caution) / <alpha-value>)',
          depth: 'rgb(var(--c-depth) / <alpha-value>)',
        },
        // Legacy palette, kept until each page is migrated
        // Maritime Navy Palette (600-950 are surfaces; 100-500 are text tones)
        navy: {
          950: '#020B18',
          900: '#040F1F',
          800: '#071628',
          700: '#0A1F3A',
          600: '#0E2847',
          500: '#6a7f9c',
          400: '#7d92ae',
          300: '#9aacc4',
          200: '#b5c3d7',
          100: '#d0d9e6',
        },
        ocean: {
          900: '#032B41',
          800: '#054060',
          700: '#075F8C',
          600: '#0984B8',
          500: '#0EA5E9',
          400: '#38BDF8',
          300: '#7DD3FC',
          200: '#BAE6FD',
          100: '#E0F2FE',
        },
        teal: {
          900: '#042F2E',
          800: '#065950',
          700: '#0B7A6E',
          600: '#0D9488',
          500: '#14B8A6',
          400: '#2DD4BF',
          300: '#5EEAD4',
          200: '#99F6E4',
          100: '#CCFBF1',
        },
        danger: {
          600: '#DC2626',
          500: '#EF4444',
          400: '#F87171',
          300: '#FCA5A5',
        },
        warning: {
          600: '#D97706',
          500: '#F59E0B',
          400: '#FCD34D',
          300: '#FDE68A',
        },
        success: {
          600: '#059669',
          500: '#10B981',
          400: '#34D399',
          300: '#6EE7B7',
        }
      },
      // Six-step type scale. Body copy is never smaller than 13px; 11-12px is for metadata.
      fontSize: {
        meta: ['11px', { lineHeight: '16px', letterSpacing: '0.04em' }],
        label: ['12px', { lineHeight: '16px' }],
        body: ['13px', { lineHeight: '20px' }],
        lead: ['15px', { lineHeight: '24px' }],
        title: ['20px', { lineHeight: '28px', letterSpacing: '-0.015em' }],
        display: ['28px', { lineHeight: '34px', letterSpacing: '-0.02em' }],
      },
      borderRadius: {
        ctl: 'var(--radius-ctl)',
        panel: 'var(--radius-panel)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out-strong': 'cubic-bezier(0.77, 0, 0.175, 1)',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'Inter', 'system-ui', 'sans-serif'],
        display: ['IBM Plex Sans', 'Inter', 'sans-serif'],
        mono: ['IBM Plex Mono', 'JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'maritime-gradient': 'linear-gradient(135deg, #020B18 0%, #040F1F 30%, #071628 60%, #0A1F3A 100%)',
        'ocean-gradient': 'linear-gradient(135deg, #032B41 0%, #054060 50%, #075F8C 100%)',
        'glow-teal': 'radial-gradient(circle at center, rgba(20, 184, 166, 0.15) 0%, transparent 70%)',
        'glow-ocean': 'radial-gradient(circle at center, rgba(14, 165, 233, 0.15) 0%, transparent 70%)',
        'card-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
      },
      boxShadow: {
        'glow-teal': 'none',
        'glow-ocean': 'none',
        'glow-danger': 'none',
        'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 8px 40px rgba(0, 0, 0, 0.6)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'float': 'none',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'spin-slow': 'spin 8s linear infinite',
        'wave': 'none',
        'slide-up': 'slideUp 0.25s cubic-bezier(0.23, 1, 0.32, 1)',
        'fade-in': 'fadeIn 0.2s cubic-bezier(0.23, 1, 0.32, 1)',
        'glow-pulse': 'none',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        wave: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(20, 184, 166, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(20, 184, 166, 0.6)' },
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
