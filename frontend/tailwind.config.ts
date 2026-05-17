import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    screens: {
      sm:  '640px',
      md:  '768px',
      lg:  '1024px',
      xl:  '1280px',
      '2xl': '1440px',
    },
    extend: {
      keyframes: {
        'toast-in': {
          '0%':   { transform: 'translateY(8px) scale(0.96)', opacity: '0' },
          '100%': { transform: 'translateY(0)   scale(1)',    opacity: '1' },
        },
        'toast-out': {
          '0%':   { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.94) translateY(4px)' },
        },
        'heart-pop': {
          '0%':   { transform: 'scale(1)' },
          '35%':  { transform: 'scale(1.35)' },
          '65%':  { transform: 'scale(0.88)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'toast-in':  'toast-in  0.22s cubic-bezier(0.34,1.56,0.64,1) forwards',
        'toast-out': 'toast-out 0.18s ease-in forwards',
        'heart-pop': 'heart-pop 0.38s ease-out',
      },
      colors: {
        primary: {
          DEFAULT: '#0093FF',
          50: '#F0F8FF',
          100: '#E0F1FF',
          500: '#0093FF',
          600: '#0080E0',
          700: '#006BBF',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs:   ['13px', { lineHeight: '1.5' }],
        sm:   ['16px', { lineHeight: '1.6' }],
        base: ['18px', { lineHeight: '1.65' }],
        lg:   ['20px', { lineHeight: '1.6' }],
        xl:   ['23px', { lineHeight: '1.5' }],
        '2xl': ['27px', { lineHeight: '1.4' }],
        '3xl': ['34px', { lineHeight: '1.3' }],
        '4xl': ['42px', { lineHeight: '1.2' }],
        '5xl': ['54px', { lineHeight: '1.1' }],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}

export default config
