/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        metallic: {
          dark: '#071026',
          steel: '#0b2545',
          titanium: '#1e3a8a',
          slate: '#1e293b',
          chrome: '#cbd5e1',
          silver: '#e2e8f0',
          gold: '#eab308',
          goldHover: '#ca8a04',
          amber: '#f59e0b',
        },
        brand: {
          yellow: '#eab308', // Normal Yellow
          yellowHover: '#ca8a04', // Normal Yellow Hover
          navy: '#0b2545', // Classic Deep Navy Blue
          navyLight: '#1e3a8a', // Rich Navy Blue Accent
          charcoal: '#0b2545', // Primary Deep Navy
          charcoalLight: '#1e3a8a', // Navy Accent
          forest: '#0b2545',
          forestLight: '#1e3a8a',
          offwhite: '#ffffff',
          softgray: '#f8fafc',
          cardbg: '#ffffff',
          bordergray: '#e2e8f0'
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif']
      }
    },
  },
  plugins: [],
}
