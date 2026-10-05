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
          yellow: '#FFE135', // Banana Yellow
          yellowHover: '#F7D02C', // Banana Yellow Hover
          navy: '#000080', // Deep Navy Blue
          navyLight: '#1A1A99', // Navy Blue Accent
          forest: '#000080',
          forestLight: '#1A1A99',
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
