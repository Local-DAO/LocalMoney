/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Main background color (dark - nearly black)
        background: '#181818',
        // Text color (white/light)
        foreground: '#FFFFFF',
        // Primary accent color (orange/coral from logo)
        primary: '#FF6B2C',
        // Secondary colors
        secondary: '#242424',
        // Button colors
        button: {
          primary: '#FF6B2C',
          secondary: '#242424',
        },
      },
    },
  },
  plugins: [],
} 