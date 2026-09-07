/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        field: {
          bg: "#0F1310",
          panel: "#16211A",
          card: "#1B2A20",
          line: "#2B3D30",
          text: "#EFF3EE",
          muted: "#9AB0A0",
          accent: "#7CB88F",
          warn: "#E0B24B",
          bad: "#D96C5A",
          good: "#5CAE7A"
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
