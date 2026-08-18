import { defineConfig } from "vitest/config";
import path from "path";

// Config dedicada de testes: não reaproveita vite.config.ts de propósito,
// para que os plugins de dev (lovable-tagger, dev-server-bridge, hmr-gate)
// não sejam carregados durante a execução dos testes.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // Os testes atuais são unitários puros. O único que precisa de DOM
    // declara `// @vitest-environment jsdom` no topo do arquivo.
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    clearMocks: true,
    coverage: {
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/components/ui/**",
        "src/integrations/supabase/types.ts",
      ],
    },
  },
});
