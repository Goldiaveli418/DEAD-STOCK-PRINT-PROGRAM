/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          900: '#080a0f',
          800: '#0d1017',
          700: '#121520',
          600: '#181c2a',
          500: '#1e2333',
        },
        brand: {
          green: '#22c55e',
          greenLight: '#4ade80',
          greenDim: '#16a34a',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
