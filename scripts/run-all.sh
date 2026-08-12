#!/usr/bin/env bash
# Pipeline complet, en une commande : sources Sandre -> PMTiles + index.json.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$here/download.sh"      # zips BD Topage nationaux + topologie des tronçons
python3 "$here/graph.py"      # graphe amont/aval -> métriques par cours d'eau
python3 "$here/aggregate.py"  # bassins agrégés par fleuve principal
"$here/prepare.sh"       # couches GeoJSON (ogr2ogr, en flux)
python3 "$here/index.py"      # index de la barre latérale
"$here/tiles.sh"         # tippecanoe -> web/public/tiles/*.pmtiles

printf '\n\033[32mPipeline terminé.\033[0m Tuiles prêtes dans web/public/tiles/\n'
printf 'Frontend : cd web && npm install && npm run dev\n'
