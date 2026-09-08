/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: '#F4C542',
          yellowHover: '#E5B42E',
          navy: '#0B2545', // Deep Rich Navy Blue (#0B2545)
          navyLight: '#134074', // Lighter Navy Blue accent
          charcoal: '#0B2545', // Mapped to Navy Blue
          charcoalLight: '#134074',
          forest: '#0B2545',
          forestLight: '#134074',
          offwhite: '#FAF9F5',
          softgray: '#E9E8E3',
          cardbg: '#FFFFFF',
          bordergray: '#E2E0D8'
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif']
      }
    },
  },
  plugins: [],
}
