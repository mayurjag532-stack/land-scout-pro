/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        field: {
          bg: "#0A0C0F",
          panel: "#14171C",
          card: "#15181D",
          raised: "#1C2028",
          line: "#262B33",
          lineStrong: "#3A4048",
          text: "#F1F3F5",
          muted: "#8B929C",
          accent: "#5EA8FF",
          warn: "#E0A937",
          bad: "#E5695E",
          good: "#3FBD82"
        }
      },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"] },
      borderRadius: { xl: "14px", lg: "10px" }
    }
  },
  plugins: []
};
