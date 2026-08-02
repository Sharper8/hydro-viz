#!/usr/bin/env python3
"""Étape 2 — Préparation des données pour la carte.

- clip à l'hydroécorégion « Jura – Préalpes du Nord » (HER1 = 5)
- reprojection en EPSG:4326 (les données WFS le sont déjà, on vérifie)
- allègement des attributs (on ne garde que l'essentiel Sandre)
- écriture des GeoJSON intermédiaires + de l'index de la sidebar

Un bassin versant est une unité naturelle : on ne découpe pas sa géométrie sur la
frontière de l'HER, on retient les bassins dont une part suffisante recouvre la zone.
Les cours d'eau et plans d'eau, eux, sont clippés à l'emprise des bassins retenus.
"""
import json
import pathlib
import sys

import geopandas as gpd
from shapely import make_valid

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
PREP = ROOT / "data" / "prepared"

# Part minimale d'un bassin devant recouvrir la zone pour être retenu
MIN_OVERLAP = 0.25
# Lambert-93, pour les calculs métriques (surfaces, longueurs)
CRS_METRIC = "EPSG:2154"
# Plafonds de l'index de la sidebar (fichier chargé au démarrage de l'app)
MAX_COURS_EAU_INDEX = 2000
MAX_PLANS_EAU_INDEX = 500


def log(msg):
    print(f"\033[35m[prepare]\033[0m {msg}", file=sys.stderr)


def load(name):
    path = RAW / name
    gdf = gpd.read_file(path)
    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:4326")
    gdf = gdf.to_crs("EPSG:4326")
    gdf["geometry"] = gdf.geometry.apply(make_valid)
    gdf = gdf[~gdf.geometry.is_empty & gdf.geometry.notna()]
    log(f"{name}: {len(gdf)} entités")
    return gdf


def clean_text(value):
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def write_geojson(gdf, name):
    path = PREP / f"{name}.geojson"
    gdf.to_file(path, driver="GeoJSON", coordinate_precision=6)
    size_mb = path.stat().st_size / 1e6
    log(f"-> {path.name} : {len(gdf)} entités, {size_mb:.1f} Mo")
    return path


def bbox_of(geom):
    minx, miny, maxx, maxy = geom.bounds
    return [round(v, 5) for v in (minx, miny, maxx, maxy)]


def main():
    PREP.mkdir(parents=True, exist_ok=True)

    zone = load("zone.geojson")
    zone_geom = zone.union_all()
    log(f"zone d'étude : {zone.iloc[0].get('NomHER1')}")

    # --- Bassins versants -----------------------------------------------------
    bv = load("bassins.geojson")
    # Le taux de recouvrement se calcule en projection métrique (Lambert-93)
    bv_proj = bv.to_crs(CRS_METRIC)
    zone_proj = gpd.GeoSeries([zone_geom], crs="EPSG:4326").to_crs(CRS_METRIC).iloc[0]
    ratio = bv_proj.geometry.intersection(zone_proj).area / bv_proj.geometry.area.replace(
        0, float("nan")
    )
    bv = bv[ratio >= MIN_OVERLAP].copy()
    log(f"bassins retenus (recouvrement >= {MIN_OVERLAP:.0%}) : {len(bv)}")

    bv_m = bv.to_crs(CRS_METRIC)
    bassins = gpd.GeoDataFrame(
        {
            "id": bv["CdOH"].map(clean_text),
            "nom": bv["TopoOH"].map(clean_text),
            "type": bv["TypTopoOH"].map(clean_text),
            "cd_bh": bv["CdBH"].map(clean_text),
            "exutoire": bv["CdExutoire_1"].map(clean_text),
            "surface_km2": (bv_m.geometry.area / 1e6).round(2).values,
        },
        geometry=bv.geometry.values,
        crs="EPSG:4326",
    )
    bassins = bassins.sort_values("surface_km2", ascending=False).reset_index(drop=True)

    # Emprise de rendu : l'union des bassins retenus
    footprint = bassins.union_all()

    # --- Cours d'eau ----------------------------------------------------------
    ce = load("cours_eau.geojson")
    ce = gpd.clip(ce, footprint)
    ce = ce[~ce.geometry.is_empty & ce.geometry.notna()]
    log(f"cours d'eau clippés : {len(ce)}")

    ce_m = ce.to_crs(CRS_METRIC)
    cours_eau = gpd.GeoDataFrame(
        {
            "id": ce["CdOH"].map(clean_text),
            "nom": ce["TopoOH"].map(clean_text),
            "source": ce["SourceNomOH"].map(clean_text),
            "longueur_km": (ce_m.geometry.length / 1000).round(2).values,
        },
        geometry=ce.geometry.values,
        crs="EPSG:4326",
    )
    cours_eau = cours_eau.sort_values("longueur_km", ascending=False).reset_index(drop=True)

    # --- Plans d'eau ----------------------------------------------------------
    pe = load("plans_eau.geojson")
    pe = gpd.clip(pe, footprint)
    pe = pe[~pe.geometry.is_empty & pe.geometry.notna()]
    log(f"plans d'eau clippés : {len(pe)}")

    pe_m = pe.to_crs(CRS_METRIC)
    plans_eau = gpd.GeoDataFrame(
        {
            "id": pe["CdOH"].map(clean_text),
            "nom": pe["TopoOH"].map(clean_text),
            "nature": pe["NaturePE"].map(clean_text),
            "surface_ha": (pe_m.geometry.area / 1e4).round(2).values,
        },
        geometry=pe.geometry.values,
        crs="EPSG:4326",
    )
    plans_eau = plans_eau.sort_values("surface_ha", ascending=False).reset_index(drop=True)

    # --- Contour de la zone ---------------------------------------------------
    zone_out = gpd.GeoDataFrame(
        {
            "id": ["HER1-5"],
            "nom": [clean_text(zone.iloc[0].get("NomHER1"))],
            "type": ["hydroécorégion"],
        },
        geometry=[zone_geom],
        crs="EPSG:4326",
    )

    write_geojson(bassins, "bassins")
    write_geojson(cours_eau, "cours_eau")
    write_geojson(plans_eau, "plans_eau")
    write_geojson(zone_out, "zone")

    # --- Index de la sidebar --------------------------------------------------
    entries = []
    for _, row in bassins.iterrows():
        entries.append(
            {
                "id": row["id"],
                "nom": row["nom"] or "Bassin sans nom",
                "couche": "bassins",
                "valeur": row["surface_km2"],
                "unite": "km²",
                "bbox": bbox_of(row.geometry),
            }
        )

    named_ce = cours_eau[cours_eau["nom"].notna()].head(MAX_COURS_EAU_INDEX)
    for _, row in named_ce.iterrows():
        entries.append(
            {
                "id": row["id"],
                "nom": row["nom"],
                "couche": "cours_eau",
                "valeur": row["longueur_km"],
                "unite": "km",
                "bbox": bbox_of(row.geometry),
            }
        )

    named_pe = plans_eau[plans_eau["nom"].notna()].head(MAX_PLANS_EAU_INDEX)
    for _, row in named_pe.iterrows():
        entries.append(
            {
                "id": row["id"],
                "nom": row["nom"],
                "couche": "plans_eau",
                "valeur": row["surface_ha"],
                "unite": "ha",
                "bbox": bbox_of(row.geometry),
            }
        )

    minx, miny, maxx, maxy = footprint.bounds
    index = {
        "zone": {
            "nom": clean_text(zone.iloc[0].get("NomHER1")),
            "code_her1": 5,
            "bbox": [round(v, 5) for v in (minx, miny, maxx, maxy)],
        },
        "stats": {
            "bassins": int(len(bassins)),
            "cours_eau": int(len(cours_eau)),
            "plans_eau": int(len(plans_eau)),
            "surface_totale_km2": round(float(bassins["surface_km2"].sum()), 1),
        },
        "entites": entries,
    }
    index_path = ROOT / "web" / "public" / "index.json"
    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_text(json.dumps(index, ensure_ascii=False), encoding="utf-8")
    log(f"-> index.json : {len(entries)} entrées, {index_path.stat().st_size / 1e6:.2f} Mo")
    log(f"stats : {index['stats']}")


if __name__ == "__main__":
    main()
