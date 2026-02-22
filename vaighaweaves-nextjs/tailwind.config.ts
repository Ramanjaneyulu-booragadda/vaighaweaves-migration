/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#8B1A1A",
          dark: "#6B1414",
          light: "#A52020",
        },
        gold: {
          DEFAULT: "#D4AF37",
          light: "#E8CC5A",
        },
      },
    },
  },
  plugins: [],
}
