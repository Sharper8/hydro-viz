#!/usr/bin/env bash
# Étape 1 — Téléchargement des données sources (Sandre / BD Topage®).
#
# Le zip national BD Topage 2025 pèse ~1,75 Go : on passe donc par le WFS Sandre
# paginé, filtré sur la bbox de la zone d'étude (cf. CLAUDE.md).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"

log() { printf '\033[36m[download]\033[0m %s\n' "$*" >&2; }

# --- 1. Couche des hydroécorégions de niveau 1 ---------------------------------
her1_file="$RAW_DIR/her1.geojson"
if [[ ! -s "$her1_file" ]]; then
  log "HER niveau 1 ($HER1_LAYER)…"
  curl -sS -m 300 -G "$WFS_URL" \
    --data-urlencode "SERVICE=WFS" \
    --data-urlencode "VERSION=2.0.0" \
    --data-urlencode "REQUEST=GetFeature" \
    --data-urlencode "TYPENAMES=$HER1_LAYER" \
    --data-urlencode "OUTPUTFORMAT=$WFS_FORMAT" \
    --data-urlencode "SRSNAME=EPSG:4326" \
    -o "$her1_file.tmp"
  if ! python3 -c "import json,sys; json.load(open('$her1_file.tmp'))" 2>/dev/null; then
    log "ERREUR : réponse WFS invalide pour les HER. Voir $her1_file.tmp"
    exit 1
  fi
  mv "$her1_file.tmp" "$her1_file"
fi
log "HER1 : $(du -h "$her1_file" | cut -f1)"

# --- 2. Zone d'étude : HER1 code 5, et sa bbox --------------------------------
zone_file="$RAW_DIR/zone.geojson"
python3 "$ROOT_DIR/scripts/extract_zone.py" "$her1_file" "$HER1_CODE" "$zone_file"
# bbox au format lat_min,lon_min,lat_max,lon_max (ordre WFS 2.0 / urn EPSG::4326)
bbox="$(python3 "$ROOT_DIR/scripts/extract_zone.py" --bbox "$zone_file")"
log "bbox zone d'étude (lat,lon) : $bbox"

# --- 3. Couches BD Topage, paginées sur la bbox -------------------------------
fetch_layer() {
  local layer="$1" out="$2"
  if [[ -s "$out" ]]; then
    log "$layer : déjà présent ($(du -h "$out" | cut -f1)), saut."
    return
  fi
  local total start=0 page_dir
  total="$(curl -sS -m 300 -G "$WFS_URL" \
    --data-urlencode "SERVICE=WFS" --data-urlencode "VERSION=2.0.0" \
    --data-urlencode "REQUEST=GetFeature" --data-urlencode "TYPENAMES=$layer" \
    --data-urlencode "RESULTTYPE=hits" \
    --data-urlencode "BBOX=$bbox,$WFS_BBOX_CRS" \
    | grep -oE 'numberMatched="[0-9]+"' | grep -oE '[0-9]+')"
  log "$layer : $total entités dans la bbox"

  page_dir="$RAW_DIR/pages_$(basename "$out" .geojson)"
  rm -rf "$page_dir"; mkdir -p "$page_dir"
  while [[ $start -lt $total ]]; do
    log "  page $((start / WFS_PAGE_SIZE + 1)) (startIndex=$start)"
    curl -sS -m 600 -G "$WFS_URL" \
      --data-urlencode "SERVICE=WFS" --data-urlencode "VERSION=2.0.0" \
      --data-urlencode "REQUEST=GetFeature" --data-urlencode "TYPENAMES=$layer" \
      --data-urlencode "OUTPUTFORMAT=$WFS_FORMAT" \
      --data-urlencode "SRSNAME=EPSG:4326" \
      --data-urlencode "COUNT=$WFS_PAGE_SIZE" --data-urlencode "STARTINDEX=$start" \
      --data-urlencode "BBOX=$bbox,$WFS_BBOX_CRS" \
      -o "$page_dir/$(printf '%06d' "$start").geojson"
    start=$((start + WFS_PAGE_SIZE))
  done
  python3 "$ROOT_DIR/scripts/merge_pages.py" "$page_dir" "$out"
  rm -rf "$page_dir"
  log "$layer -> $out ($(du -h "$out" | cut -f1))"
}

fetch_layer "$BV_LAYER" "$RAW_DIR/bassins.geojson"
fetch_layer "$CE_LAYER" "$RAW_DIR/cours_eau.geojson"
fetch_layer "$PE_LAYER" "$RAW_DIR/plans_eau.geojson"

log "Terminé. Sources dans $RAW_DIR"
