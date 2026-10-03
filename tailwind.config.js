/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        field: {
          bg: "#F7F3EC",      // Canvas / Ivory
          panel: "#EEE9E0",   // Soft Surface
          card: "#FFFFFF",    // White product surfaces
          raised: "#E6DECD",  // Deeper soft surface (tracks, wells)
          line: "#D9D2C7",
          lineStrong: "#C2B89F",
          text: "#171815",    // Ink / Graphite
          muted: "#706E68",   // Stone
          accent: "#263D30",  // Forest — primary actions
          gold: "#B9955A",    // Muted gold — sparing premium accents
          warn: "#8A5F1E",
          bad: "#B4432F",
          good: "#2E7D4F"
        }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["Fraunces", "Georgia", "Times New Roman", "serif"]
      },
      borderRadius: { xl: "16px", lg: "10px" }
    }
  },
  plugins: []
};
