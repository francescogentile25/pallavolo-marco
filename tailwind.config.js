/** @type {import('tailwindcss').Config} */
import PrimeUI from 'tailwindcss-primeui';
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        'ocean': 'var(--color-ocean)',
        'brand': 'var(--color-brand)',
        'tournament': 'var(--color-tournament)'
      }
    },
  },
  plugins: [
    PrimeUI
  ],
}

