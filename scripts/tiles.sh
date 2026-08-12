#!/usr/bin/env bash
# Étape 3 — Génération des tuiles vectorielles PMTiles (tippecanoe).
#
# Emprise nationale : la contrainte n'est plus la disponibilité mais le poids.
# GitHub Pages plafonne à 100 Mo par fichier, on vise < 90 Mo par archive.
# Le levier principal est le *minzoom par entité* : à z4 seuls les grands
# fleuves et les grands bassins sont tuilés, le chevelu complet n'apparaît qu'à
# partir de z11. Les seuils portent sur les attributs cuits par graph.py
# (`cum_amont_km`) et sur les surfaces.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"

log() { printf '\033[33m[tiles]\033[0m %s\n' "$*" >&2; }

if ! command -v tippecanoe >/dev/null; then
  echo "tippecanoe introuvable : apt-get install -y tippecanoe" >&2
  exit 1
fi

FILTER_DIR="$PREP_DIR/filters"
mkdir -p "$FILTER_DIR"

# Génère un filtre tippecanoe « seuil décroissant par zoom » : à chaque zoom
# listé, l'entité n'est tuilée que si `attribut >= seuil` ; au-delà du dernier
# zoom listé, tout passe.
write_filter() {
  local layer="$1" attr="$2"
  local out="$FILTER_DIR/$layer.json"
  shift 2
  python3 - "$layer" "$attr" "$out" "$@" <<'PY'
import json, sys
layer, attr, out, *pairs = sys.argv[1:]
seuils = [(int(z), float(v)) for z, v in (p.split(":") for p in pairs)]
clauses = [[">=", "$zoom", max(z for z, _ in seuils) + 1]]
clauses += [["all", ["==", "$zoom", z], [">=", attr, v]] for z, v in seuils]
json.dump({layer: ["any", *clauses]}, open(out, "w"))
PY
  echo "$out"
}

build() {
  local name="$1" minzoom="$2" maxzoom="$3"; shift 3
  local src="$PREP_DIR/$name.geojson" out="$TILES_DIR/$name.pmtiles"
  if [[ ! -s "$src" ]]; then
    log "source manquante : $src (lancer prepare.sh)"
    exit 1
  fi
  log "$name : z$minzoom-z$maxzoom…"
  tippecanoe \
    --force --quiet \
    --output="$out" \
    --layer="$name" \
    --minimum-zoom="$minzoom" \
    --maximum-zoom="$maxzoom" \
    --drop-densest-as-needed \
    --hilbert \
    "$@" \
    "$src" >&2
  log "$name -> $(du -h "$out" | cut -f1)"
}

# --- Couches de contexte, légères et visibles dès le zoom mondial -------------
build bassins_hydro 0 9 --no-feature-limit --no-tile-size-limit
build her1 0 9 --no-feature-limit --no-tile-size-limit
build fleuves_bassins 0 9 --no-feature-limit --no-tile-size-limit

# --- Bassins versants topographiques (6 190 polygones) -----------------------
# Les plus grands dès z4, tous à partir de z7.
build bassins 4 12 \
  --coalesce-densest-as-needed --no-feature-limit \
  -J "$(write_filter bassins surface_km2 4:1500 5:600 6:200)"

# --- Cours d'eau (134 739 lignes) — la couche critique -----------------------
# Seuils sur la longueur cumulée amont : à z4 il ne reste que les grands
# fleuves, à z12 tout le chevelu.
build cours_eau 4 12 \
  --no-feature-limit \
  -J "$(write_filter cours_eau cum_amont_km \
        4:15000 5:6000 6:2500 7:800 8:250 9:80 10:25 11:5)"

# --- Plans d'eau (34 511 polygones) ------------------------------------------
build plans_eau 6 12 \
  --no-feature-limit \
  -J "$(write_filter plans_eau surface_ha 6:2000 7:800 8:200 9:50 10:10 11:2)"

log "Tailles finales :"
ls -lh "$TILES_DIR"/*.pmtiles | awk '{printf "  %-28s %s\n", $9, $5}'
log "Total : $(du -sh "$TILES_DIR" | cut -f1)"

# Garde-fou : GitHub Pages refuse les fichiers > 100 Mo
depasse=0
for f in "$TILES_DIR"/*.pmtiles; do
  size=$(stat -c %s "$f")
  if (( size > 90 * 1000 * 1000 )); then
    log "DÉPASSEMENT : $(basename "$f") = $((size / 1000 / 1000)) Mo (> 90 Mo)"
    depasse=1
  fi
done
(( depasse == 0 )) || { log "Budget tuiles dépassé — relever les seuils de minzoom."; exit 1; }
