import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
    dedupe: ["react", "react-dom"],
  },
  build: { outDir: "dist", emptyOutDir: true },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.WEB_PORT ?? 3000),
    strictPort: true,
    // Pass the exact sandbox/development host; never allow arbitrary hosts.
    allowedHosts: process.env.DEV_ALLOWED_HOST ? [process.env.DEV_ALLOWED_HOST] : [],
    proxy: { "/api": `http://127.0.0.1:${process.env.PORT ?? 3001}` },
  },
});
