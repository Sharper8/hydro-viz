#!/usr/bin/env bash
# Configuration partagée du pipeline hydro-viz (phase 2 — France métropolitaine).

# Racine du projet (le dossier parent de scripts/)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW_DIR="$ROOT_DIR/data/raw"
NAT_DIR="$RAW_DIR/national"     # zips BD Topage nationaux + extractions
PREP_DIR="$ROOT_DIR/data/prepared"
TILES_DIR="$ROOT_DIR/web/public/tiles"

# Millésime BD Topage®
TOPAGE_YEAR=2025
TOPAGE_BASE="https://services.sandre.eaufrance.fr/telechargement/geo/ETH/BDTopage/${TOPAGE_YEAR}"

# Jeux de données nationaux (métropole = FXX), téléchargés en zips par jeu.
# Le zip « tout-en-un » BD_Topage_FXX_2025-shp.zip pèse 1,75 Go : on prend les
# zips unitaires (16 Mo + 183 Mo + 28 Mo + 1,5 Mo + 742 Mo), plus faciles à
# reprendre et à traiter séparément.
#   nom_local:sous-dossier/nom-de-fichier.zip
TOPAGE_SETS=(
  "bassins:BassinVersantTopographique/BassinVersantTopographique_FXX-shp.zip"
  "cours_eau:CoursEau/CoursEau_FXX-shp.zip"
  "plans_eau:PlanEau/PlanEau_FXX-shp.zip"
  "bassins_hydro:BassinHydrographique/BassinHydrographique_FXX-shp.zip"
  "troncons:TronconHydrographique/TronconHydrographique_FXX-shp.zip"
)

# Service WFS Sandre (aucune clé API nécessaire) — utilisé uniquement pour les
# hydroécorégions, qui ne sont pas publiées en zip sur le serveur BD Topage.
WFS_URL="https://services.sandre.eaufrance.fr/geo/sandre"
WFS_FORMAT="application/json; subtype=geojson"
HER1_LAYER="sa:Hydroecoregion1_FXX"

# Lambert-93 : projection métrique de référence pour longueurs et surfaces
CRS_METRIC="EPSG:2154"

mkdir -p "$RAW_DIR" "$NAT_DIR" "$PREP_DIR" "$TILES_DIR"
