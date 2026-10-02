import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        glass: {
          bg: 'rgba(255,255,255,0.05)',
          border: 'rgba(255,255,255,0.1)',
        },
        accent: {
          primary: '#6366f1',
          secondary: '#8b5cf6',
          glow: '#a78bfa',
        },
        surface: {
          1: '#0f0f13',
          2: '#1a1a23',
          3: '#252532',
        },
      },
      borderRadius: {
        glass: '16px',
      },
      backdropBlur: {
        glass: '20px',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(99,102,241,0.4)' },
          '50%': { boxShadow: '0 0 40px rgba(99,102,241,0.6)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      boxShadow: {
        glass:
          '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        glow: '0 0 20px rgba(99,102,241,0.4)',
      },
    },
  },
  plugins: [],
} satisfies Config
