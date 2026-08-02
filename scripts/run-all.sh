#!/usr/bin/env bash
# Pipeline complet, en une commande : sources Sandre -> PMTiles + index.json.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$here/download.sh"
python3 "$here/prepare.py"
"$here/tiles.sh"

printf '\n\033[32mPipeline terminé.\033[0m Tuiles prêtes dans web/public/tiles/\n'
printf 'Frontend : cd web && npm install && npm run dev\n'
