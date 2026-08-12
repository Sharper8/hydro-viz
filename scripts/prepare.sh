#!/usr/bin/env bash
# Étape 2c — Assemblage des couches cartographiques nationales.
#
# Tout passe par ogr2ogr / SQLite : les 134 739 cours d'eau (458 Mo de
# géométries) ne sont jamais chargés en mémoire Python. Une base GeoPackage de
# travail sert de point de jointure entre les géométries (Lambert-93) et les
# métriques calculées par graph.py / aggregate.py, et l'export final reprojette
# en EPSG:4326 pour tippecanoe.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"

log() { printf '\033[35m[prepare]\033[0m %s\n' "$*" >&2; }

WORK="$PREP_DIR/work.gpkg"

for f in metrics_cours_eau.csv metrics_bassins.csv stems.csv; do
  [[ -s "$PREP_DIR/$f" ]] || { echo "manquant : $PREP_DIR/$f (lancer graph.py puis aggregate.py)" >&2; exit 1; }
done

# --- 1. Base de travail --------------------------------------------------------
log "construction de $(basename "$WORK")…"
rm -f "$WORK"
ogr2ogr -f GPKG "$WORK" "$NAT_DIR/BassinVersantTopographique_FXX/BassinVersantTopographique_FXX.shp" \
  -nln bvt -nlt MULTIPOLYGON -lco SPATIAL_INDEX=NO
ogr2ogr -f GPKG -update "$WORK" "$NAT_DIR/CoursEau_FXX/CoursEau_FXX.shp" \
  -nln ce -nlt MULTILINESTRING -lco SPATIAL_INDEX=NO
ogr2ogr -f GPKG -update "$WORK" "$NAT_DIR/PlanEau_FXX/PlanEau_FXX.shp" \
  -nln pe -nlt MULTIPOLYGON -lco SPATIAL_INDEX=NO
ogr2ogr -f GPKG -update "$WORK" "$NAT_DIR/BassinHydrographique_FXX/BassinHydrographique_FXX.shp" \
  -nln bh -nlt MULTIPOLYGON -lco SPATIAL_INDEX=NO

for csv in metrics_cours_eau metrics_bassins stems; do
  ogr2ogr -f GPKG -update "$WORK" "$PREP_DIR/$csv.csv" -nln "$csv"
done

log "index de jointure…"
ogrinfo -q "$WORK" -sql "CREATE INDEX idx_mce ON metrics_cours_eau(id)"
ogrinfo -q "$WORK" -sql "CREATE INDEX idx_mbv ON metrics_bassins(id)"
ogrinfo -q "$WORK" -sql "CREATE INDEX idx_stems ON stems(id)"

# --- 2. Export des couches -----------------------------------------------------
# 5 décimales ≈ 1 m : très au-delà de ce que rendent les tuiles, et deux fois
# plus léger que la précision par défaut.
export_layer() {
  local name="$1" sql="$2"
  rm -f "$PREP_DIR/$name.geojson"   # le pilote GeoJSON n'écrase pas
  ogr2ogr -f GeoJSON -t_srs EPSG:4326 -nln "$name" \
    -lco RFC7946=YES -lco COORDINATE_PRECISION=5 \
    "$PREP_DIR/$name.geojson" "$WORK" -dialect SQLITE -sql "$sql"
  log "-> $name.geojson : $(du -h "$PREP_DIR/$name.geojson" | cut -f1)"
}

# `stem` est le rang de palette (0 = fleuve non teinté) : un petit entier plutôt
# qu'un code Sandre de 19 caractères répété sur 134 739 entités.
export_layer cours_eau "
  SELECT c.geom,
         c.CdOH                              AS id,
         NULLIF(TRIM(c.TopoOH), '')          AS nom,
         CAST(m.longueur_km AS REAL)         AS longueur_km,
         CAST(m.cum_amont_km AS REAL)        AS cum_amont_km,
         CAST(m.nb_affluents AS INTEGER)     AS nb_affluents,
         CAST(m.nb_amont_total AS INTEGER)   AS nb_amont,
         NULLIF(m.main_stem_nom, '')         AS fleuve,
         COALESCE(CAST(s.rang AS INTEGER), 0) AS stem
    FROM ce c
    LEFT JOIN metrics_cours_eau m ON m.id = c.CdOH
    LEFT JOIN stems s ON s.id = m.main_stem_id"

export_layer bassins "
  SELECT b.geom,
         b.CdOH                               AS id,
         NULLIF(TRIM(b.TopoOH), '')           AS nom,
         b.CdBH                               AS cd_bh,
         ROUND(ST_Area(b.geom) / 1e6, 2)      AS surface_km2,
         NULLIF(m.main_stem_nom, '')          AS fleuve,
         COALESCE(CAST(s.rang AS INTEGER), 0) AS stem
    FROM bvt b
    LEFT JOIN metrics_bassins m ON m.id = b.CdOH
    LEFT JOIN stems s ON s.id = m.main_stem_id"

export_layer plans_eau "
  SELECT p.geom,
         p.CdOH                          AS id,
         NULLIF(TRIM(p.TopoOH), '')      AS nom,
         NULLIF(p.NaturePE, '')          AS nature,
         ROUND(ST_Area(p.geom) / 1e4, 2) AS surface_ha
    FROM pe p"

export_layer bassins_hydro "
  SELECT h.geom,
         h.CdBH                          AS id,
         h.LbBH                          AS nom,
         ROUND(ST_Area(h.geom) / 1e6, 1) AS surface_km2
    FROM bh h"

# Hydroécorégions : couche de référence, déjà en EPSG:4326 (WFS)
rm -f "$PREP_DIR/her1.geojson"
ogr2ogr -f GeoJSON -lco RFC7946=YES -lco COORDINATE_PRECISION=5 \
  "$PREP_DIR/her1.geojson" "$RAW_DIR/her1.geojson" -dialect SQLITE \
  -sql "SELECT geometry, CAST(CdHER1 AS INTEGER) AS id, NomHER1 AS nom FROM Hydroecoregion1_FXX" -nln her1
log "-> her1.geojson : $(du -h "$PREP_DIR/her1.geojson" | cut -f1)"

rm -f "$WORK"
log "Couches prêtes dans $PREP_DIR"
