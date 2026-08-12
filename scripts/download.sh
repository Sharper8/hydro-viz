#!/usr/bin/env bash
# Étape 1 — Téléchargement des données sources nationales (Sandre / BD Topage®).
#
# Phase 2 : emprise France métropolitaine. On télécharge les zips *par jeu de
# données* plutôt que le zip national complet (1,75 Go) — ils sont plus petits,
# reprenables individuellement et permettent de ne dézipper que le nécessaire.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"

log() { printf '\033[36m[download]\033[0m %s\n' "$*" >&2; }

# --- 1. Jeux BD Topage nationaux ----------------------------------------------
for entry in "${TOPAGE_SETS[@]}"; do
  name="${entry%%:*}"
  path="${entry#*:}"
  zip="$NAT_DIR/$(basename "$path")"
  if [[ -s "$zip" ]]; then
    log "$name : déjà présent ($(du -h "$zip" | cut -f1)), saut."
    continue
  fi
  log "$name : téléchargement de $(basename "$path")…"
  curl -sS -f -m 6000 -o "$zip.part" "$TOPAGE_BASE/$path"
  mv "$zip.part" "$zip"
  log "$name -> $zip ($(du -h "$zip" | cut -f1))"
done

# --- 2. Décompression ---------------------------------------------------------
# TronconHydrographique n'est utilisé que pour la topologie (nœuds amont/aval) :
# ses .dbf suffisent, on n'extrait donc pas les 742 Mo de géométries.
unzip_set() {
  local name="$1" zip="$2" dest="$NAT_DIR/$3"
  if [[ -d "$dest" ]]; then
    log "$name : déjà décompressé."
    return
  fi
  log "$name : décompression…"
  unzip -o -q "$zip" -d "$dest"
}

unzip_set bassins "$NAT_DIR/BassinVersantTopographique_FXX-shp.zip" BassinVersantTopographique_FXX
unzip_set cours_eau "$NAT_DIR/CoursEau_FXX-shp.zip" CoursEau_FXX
unzip_set plans_eau "$NAT_DIR/PlanEau_FXX-shp.zip" PlanEau_FXX
unzip_set bassins_hydro "$NAT_DIR/BassinHydrographique_FXX-shp.zip" BassinHydrographique_FXX

# --- 3. Tronçons : uniquement la table attributaire, bassin par bassin ---------
# Le zip contient un shapefile par grand bassin hydrographique. On extrait le
# .dbf d'un bassin, on en tire les 6 colonnes utiles en CSV, puis on le supprime
# avant de passer au suivant : le pic d'occupation disque reste ~700 Mo.
troncon_csv="$NAT_DIR/troncon_csv"
if [[ ! -d "$troncon_csv" ]]; then
  mkdir -p "$troncon_csv.part"
  for b in 01 02 03 04 05 06 12; do
    member="shp_bassins/TronconHydrographique_FXX_bassin_${b}.dbf"
    unzip -l "$NAT_DIR/TronconHydrographique_FXX-shp.zip" "$member" >/dev/null 2>&1 || continue
    unzip -o -q -j "$NAT_DIR/TronconHydrographique_FXX-shp.zip" "$member" -d "$NAT_DIR/tmp_dbf"
    ogr2ogr -f CSV "$troncon_csv.part/$b.csv" \
      "$NAT_DIR/tmp_dbf/TronconHydrographique_FXX_bassin_${b}.dbf" \
      -select CdOH,CdNoeudDeb,CdNoeudFin,CdCoursEau,SensEcoule,TronconFic
    rm -rf "$NAT_DIR/tmp_dbf"
    log "tronçons bassin $b : $(( $(wc -l < "$troncon_csv.part/$b.csv") - 1 )) entités"
  done
  mv "$troncon_csv.part" "$troncon_csv"
fi

# --- 4. Hydroécorégions de niveau 1 (couche de référence, via WFS) -------------
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
  if ! python3 -c "import json; json.load(open('$her1_file.tmp'))" 2>/dev/null; then
    log "ERREUR : réponse WFS invalide pour les HER. Voir $her1_file.tmp"
    exit 1
  fi
  mv "$her1_file.tmp" "$her1_file"
fi
log "HER1 : $(du -h "$her1_file" | cut -f1)"

log "Terminé. Sources dans $NAT_DIR"
