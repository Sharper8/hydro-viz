import { defineConfig } from "vite";

// Servi à la racine du domaine custom https://hydro.devprocore.com/.
// VITE_BASE permet de rebasculer sur /hydro-viz/ pour l'URL github.io.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  build: {
    outDir: "dist",
    // les .pmtiles de public/ sont copiés tels quels, jamais inlinés
    assetsInlineLimit: 0,
  },
});
