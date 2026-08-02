#!/usr/bin/env bash
# Étape 3 — Génération des tuiles vectorielles PMTiles (tippecanoe).
#
# Un fichier .pmtiles par couche : chacune a sa propre plage de zoom, et le
# frontend n'ouvre que ce dont il a besoin (les Range Requests font le reste).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"

log() { printf '\033[33m[tiles]\033[0m %s\n' "$*" >&2; }

if ! command -v tippecanoe >/dev/null; then
  echo "tippecanoe introuvable : apt-get install -y tippecanoe" >&2
  exit 1
fi

build() {
  local name="$1" minzoom="$2" maxzoom="$3"; shift 3
  local src="$PREP_DIR/$name.geojson" out="$TILES_DIR/$name.pmtiles"
  if [[ ! -s "$src" ]]; then
    log "source manquante : $src (lancer prepare.py)"
    exit 1
  fi
  log "$name : z$minzoom-z$maxzoom…"
  tippecanoe \
    --force \
    --output="$out" \
    --layer="$name" \
    --minimum-zoom="$minzoom" \
    --maximum-zoom="$maxzoom" \
    --drop-densest-as-needed \
    --extend-zooms-if-still-dropping \
    --no-tile-size-limit \
    "$@" \
    "$src" 2>&1 | tail -3 >&2
  log "$name -> $(du -h "$out" | cut -f1)"
}

# Contour de la zone d'étude : une seule entité, visible à tous les zooms
build zone 0 10 --no-feature-limit

# Bassins versants : polygones, lisibles dès le zoom régional
build bassins 4 12 --coalesce-densest-as-needed --no-feature-limit

# Cours d'eau : lignes, apparaissent à partir du zoom 6
build cours_eau 6 13 --no-feature-limit

# Plans d'eau : petits polygones, seulement en zoom rapproché
build plans_eau 7 13 --no-feature-limit

log "Total tuiles : $(du -sh "$TILES_DIR" | cut -f1)"
ls -lh "$TILES_DIR"
