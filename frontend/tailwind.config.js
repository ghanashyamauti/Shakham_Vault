/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        shakham: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        indigoAcc: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        slateSubtle: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        }
      },
      fontFamily: {
        sans: ['"Chakra Petch"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Fira Code', 'Menlo', 'Consolas', 'monospace'],
        vault: ['Orbitron', 'sans-serif'],
      },
      boxShadow: {
        'premium': '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.03)',
        'premium-lg': '0 12px 32px -4px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.04)',
        'premium-xl': '0 20px 48px -6px rgba(15, 23, 42, 0.12), 0 8px 20px -3px rgba(15, 23, 42, 0.06)',
        'glow-teal': '0 0 24px -4px rgba(20, 184, 166, 0.25)',
      }
    },
  },
  plugins: [],
}
