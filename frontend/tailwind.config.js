/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Maritime Navy Palette
        navy: {
          950: '#020B18',
          900: '#040F1F',
          800: '#071628',
          700: '#0A1F3A',
          600: '#0E2847',
          500: '#122F52',
          400: '#1A3F6B',
          300: '#234F84',
          200: '#2B5F9D',
          100: '#3C7AB8',
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
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'maritime-gradient': 'linear-gradient(135deg, #020B18 0%, #040F1F 30%, #071628 60%, #0A1F3A 100%)',
        'ocean-gradient': 'linear-gradient(135deg, #032B41 0%, #054060 50%, #075F8C 100%)',
        'glow-teal': 'radial-gradient(circle at center, rgba(20, 184, 166, 0.15) 0%, transparent 70%)',
        'glow-ocean': 'radial-gradient(circle at center, rgba(14, 165, 233, 0.15) 0%, transparent 70%)',
        'card-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
      },
      boxShadow: {
        'glow-teal': '0 0 30px rgba(20, 184, 166, 0.3)',
        'glow-ocean': '0 0 30px rgba(14, 165, 233, 0.3)',
        'glow-danger': '0 0 20px rgba(239, 68, 68, 0.4)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 8px 40px rgba(0, 0, 0, 0.6)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'spin-slow': 'spin 8s linear infinite',
        'wave': 'wave 3s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
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
          '0%': { opacity: '0', transform: 'translateY(20px)' },
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
