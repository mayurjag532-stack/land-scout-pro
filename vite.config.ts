import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Land Scout Pro must be served over HTTPS for browser Geolocation
// to work reliably on real devices (localhost is exempt for dev).
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173
  },
  build: {
    target: "es2018",
    sourcemap: false
  }
});
