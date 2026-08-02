import { defineConfig } from "vite";

// Déployé sur https://<user>.github.io/hydro-viz/ : le base path doit correspondre.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/hydro-viz/",
  build: {
    outDir: "dist",
    // les .pmtiles de public/ sont copiés tels quels, jamais inlinés
    assetsInlineLimit: 0,
  },
});
