/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
      },
      colors: {
        primary: '#7c5cbf',
        'primary-light': '#a78bfa',
        'primary-dark': '#5b3d9e',
        warm: {
          50: '#faf8f5',
          75: '#f7f3ee',
          100: '#f0ebe4',
          200: '#e4dbd0',
          300: '#d4c7b8',
          400: '#c0ae99',
          500: '#ab947b',
          600: '#947a61',
          700: '#7b644f',
          800: '#655040',
          900: '#4f3e32',
        },
        accent: '#e07a5f',
        'accent-light': '#f4a98d',
        sage: '#81b29a',
        'sage-light': '#a8d5ba',
        cream: '#fff8f0',
        dark: '#2d2323',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'warm': '0 4px 20px rgba(124, 92, 191, 0.15)',
        'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.04)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'fade-in-down': 'fadeInDown 0.4s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideIn 0.3s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.3s ease-out forwards',
        'slide-in-right': 'slideInRight 0.3s ease-out forwards',
        'zoom-in': 'zoomIn 0.3s ease-out',
        'bounce-in': 'bounceIn 0.5s ease-out',
        'match-found': 'matchFound 1.2s ease-out forwards',
        'match-peep-left': 'matchPeepLeft 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'match-peep-right': 'matchPeepRight 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'match-pulse': 'matchPulse 0.8s ease-in-out infinite',
        'bounce-soft': 'bounceSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        zoomIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        bounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideIn: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        matchFound: {
          '0%': { opacity: '0' },
          '20%': { opacity: '1' },
          '80%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'scale(0.95)' },
        },
        matchPeepLeft: {
          '0%': { opacity: '0', transform: 'translateX(-40px) scale(0.7)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
        matchPeepRight: {
          '0%': { opacity: '0', transform: 'translateX(40px) scale(0.7)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
        matchPulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.15)', opacity: '0.7' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
    },
  },
  plugins: [],
}
