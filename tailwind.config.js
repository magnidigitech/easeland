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
          dark: '#070d1e',
          steel: '#0b132b',
          titanium: '#1c2541',
          slate: '#2b3a55',
          chrome: '#cbd5e1',
          silver: '#e2e8f0',
          gold: '#eab308',
          goldHover: '#ca8a04',
          amber: '#f59e0b',
        },
        brand: {
          yellow: '#eab308', // Normal Yellow (Not Metallic)
          yellowHover: '#ca8a04', // Normal Yellow Hover
          navy: '#0b132b', // Deep Navy Blue
          navyLight: '#1c2541', // Rich Navy Blue
          charcoal: '#0b132b', // Deep Navy Primary
          charcoalLight: '#1c2541', // Rich Navy Accent
          forest: '#0b132b',
          forestLight: '#1c2541',
          offwhite: '#0b132b',
          softgray: '#1c2541',
          cardbg: '#1c2541',
          bordergray: '#2b3a55'
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif']
      }
    },
  },
  plugins: [],
}
