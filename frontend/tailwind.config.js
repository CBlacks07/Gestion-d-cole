/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#FBF6EC',
          100: '#F5EAD1',
          200: '#EAD3A0',
          300: '#DCB86D',
          400: '#D2A84E',
          500: '#C99A3E',
          600: '#B8862E',
          700: '#8A6A24',
          800: '#6E5419',
          900: '#4A3810',
        },
        forest: {
          50:  '#DCE5DC',
          100: '#8CA091',
          400: '#2C5745',
          500: '#2C4535',
          600: '#24402F',
          700: '#223930',
          800: '#1C3327',
          900: '#14251C',
        },
        cream: {
          50:  '#FAF6EC',
          100: '#F7F2E7',
          200: '#F0EBDC',
          300: '#E6DFC9',
          400: '#D8CFB4',
        },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)',
        'card-hover': '0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [],
}
