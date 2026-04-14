/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        warmWhite: '#FFFBF5',
        warmGray: {
          50: '#FAF7F2',
          100: '#F1EAE0',
          200: '#E5D9CA',
          300: '#D1BFA8',
          400: '#A89178',
          500: '#7A6651',
          600: '#5C4D3D',
          700: '#3F3429',
          800: '#2A221A',
          900: '#1A140F',
        },
      },
    },
  },
  plugins: [],
};
