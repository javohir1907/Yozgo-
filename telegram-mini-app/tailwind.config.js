/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--tg-theme-bg-color, #0f0f0f)",
        foreground: "var(--tg-theme-text-color, #ffffff)",
        primary: "var(--tg-theme-button-color, #f97316)",
        primaryForeground: "var(--tg-theme-button-text-color, #ffffff)",
        hint: "var(--tg-theme-hint-color, #9ca3af)",
        link: "var(--tg-theme-link-color, #3b82f6)",
        secondaryBg: "var(--tg-theme-secondary-bg-color, #1a1a1a)",
      }
    },
  },
  plugins: [],
}
