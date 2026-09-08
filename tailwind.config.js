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
          dark: '#090d16',
          steel: '#0f172a',
          titanium: '#1e293b',
          slate: '#334155',
          chrome: '#cbd5e1',
          silver: '#e2e8f0',
          gold: '#d4af37',
          goldHover: '#b8860b',
          amber: '#f59e0b',
        },
        brand: {
          yellow: '#d4af37', // Metallic Gold Accent
          yellowHover: '#b8860b',
          navy: '#0f172a', // Gunmetal Dark
          navyLight: '#1e293b', // Titanium Slate
          charcoal: '#0f172a',
          charcoalLight: '#1e293b',
          forest: '#0f172a',
          forestLight: '#1e293b',
          offwhite: '#0f172a',
          softgray: '#1e293b',
          cardbg: '#1e293b',
          bordergray: '#334155'
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif']
      }
    },
  },
  plugins: [],
}
