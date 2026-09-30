/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Fraunces Variable"', 'Georgia', 'serif'],
        body: ['"DM Sans Variable"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
