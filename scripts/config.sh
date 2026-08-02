#!/usr/bin/env bash
# Configuration partagée du pipeline hydro-viz.

# Racine du projet (le dossier parent de scripts/)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW_DIR="$ROOT_DIR/data/raw"
PREP_DIR="$ROOT_DIR/data/prepared"
TILES_DIR="$ROOT_DIR/web/public/tiles"

# Service WFS Sandre (aucune clé API nécessaire)
WFS_URL="https://services.sandre.eaufrance.fr/geo/sandre"
WFS_FORMAT="application/json; subtype=geojson"
# MapServer/WFS 2.0 attend l'ordre lat,lon pour urn:ogc:def:crs:EPSG::4326
WFS_BBOX_CRS="urn:ogc:def:crs:EPSG::4326"
WFS_PAGE_SIZE=1000

# Millésime BD Topage®
TOPAGE_YEAR=2025

# Zone d'étude : hydroécorégion de niveau 1 « Jura – Préalpes du Nord »
HER1_LAYER="sa:Hydroecoregion1_FXX"
HER1_CODE=5

# Fallback documenté si la couche HER est indisponible : départements de la zone
FALLBACK_DEPTS="01,25,38,39,69,70,73,74"

# Couches BD Topage à récupérer
BV_LAYER="sa:BassinVersantTopographique_FXX_Topage${TOPAGE_YEAR}"
CE_LAYER="sa:CoursEau_FXX_Topage${TOPAGE_YEAR}"
PE_LAYER="sa:PlanEau_FXX_Topage${TOPAGE_YEAR}"

mkdir -p "$RAW_DIR" "$PREP_DIR" "$TILES_DIR"
