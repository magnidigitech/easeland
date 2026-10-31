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
          yellow: 'var(--brand-yellow, #FFE135)',
          yellowHover: 'var(--brand-yellow-hover, #F7D02C)',
          navy: 'var(--brand-navy, #000080)',
          navyLight: 'var(--brand-navy-light, #1A1A99)',
          forest: 'var(--brand-navy, #000080)',
          forestLight: 'var(--brand-navy-light, #1A1A99)',
          offwhite: '#ffffff',
          softgray: '#f8fafc',
          cardbg: '#ffffff',
          bordergray: '#e2e8f0',
          charcoal: 'var(--brand-charcoal, #0b172a)',
          charcoalLight: 'var(--brand-charcoal-light, #1e293b)'
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif']
      }
    },
  },
  plugins: [],
}
