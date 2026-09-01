import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig({
  plugins: [react(), componentTagger()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "::",
    // 8080 continua o padrão. A variável existe porque a porta às vezes já está
    // ocupada por outro projeto na mesma máquina, e sem isso a única saída era
    // editar este arquivo — que é versionado.
    port: Number(process.env.PORT) || 8080,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          charts: ["recharts"],
          pdf: ["jspdf", "html2canvas", "pdf-lib"],
          xlsx: ["xlsx"],
          leaflet: ["leaflet", "react-leaflet"],
        },
      },
    },
  },
});
