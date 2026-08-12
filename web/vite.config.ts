import { defineConfig } from "vite";

// Base relative : le site fonctionne aussi bien monté à la racine du domaine
// custom (https://hydro.devprocore.com/) que sous le chemin de projet
// (https://sharper8.github.io/hydro-viz/), sans build séparé. GitHub ne
// redirige pas la page projet vers le domaine custom, les deux URLs doivent
// donc rester servables telles quelles.
export default defineConfig({
  base: process.env.VITE_BASE ?? "./",
  build: {
    outDir: "dist",
    // les .pmtiles de public/ sont copiés tels quels, jamais inlinés
    assetsInlineLimit: 0,
  },
});
