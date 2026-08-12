#!/usr/bin/env python3
"""Étape 2d — Index de la barre latérale (`web/public/index.json`).

Le fichier est chargé au démarrage de l'application : il ne contient donc que
ce qu'il faut pour chercher et zoomer (identifiant, nom, mesure, emprise), pas
de géométrie. Les emprises sont extraites des GeoJSON préparés par ogr2ogr,
en flux : aucune couche n'est chargée entièrement en mémoire.
"""
import csv
import json
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
PREP = ROOT / "data" / "prepared"
WEB = ROOT / "web" / "public"

# Plafonds par couche : au-delà, la recherche perd son intérêt et le fichier
# devient lourd à charger. Les entités sont retenues par ordre d'importance.
PLAFONDS = {"bassins": 6500, "cours_eau": 6000, "plans_eau": 1200}


def log(msg):
    print(f"\033[36m[index]\033[0m {msg}", file=sys.stderr)


def nom_couche(src):
    """Nom de la couche telle que nommée dans le fichier (pas toujours celui du fichier)."""
    out = subprocess.run(
        ["ogrinfo", "-q", str(src)], check=True, capture_output=True, text=True
    ).stdout
    return out.splitlines()[0].split(":", 1)[1].split("(")[0].strip()


def extract(layer, mesure, where):
    """Attributs + emprise de chaque entité d'une couche préparée."""
    src = PREP / f"{layer}.geojson"
    table = nom_couche(src)
    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / "index.csv"
        subprocess.run(
            ["ogr2ogr", "-f", "CSV", str(out), str(src), "-dialect", "SQLITE",
             "-sql", f"""SELECT id, nom, {mesure} AS valeur,
                              ST_MinX(geometry) AS x0, ST_MinY(geometry) AS y0,
                              ST_MaxX(geometry) AS x1, ST_MaxY(geometry) AS y1
                         FROM "{table}" WHERE {where}"""],
            check=True, stdout=subprocess.DEVNULL,
        )
        with out.open(encoding="utf-8") as fh:
            return list(csv.DictReader(fh))


def compte(layer):
    """Nombre total d'entités de la couche préparée."""
    src = PREP / f"{layer}.geojson"
    out = subprocess.run(
        ["ogrinfo", "-q", str(src), "-sql",
         f'SELECT COUNT(*) AS n FROM "{nom_couche(src)}"'],
        check=True, capture_output=True, text=True,
    ).stdout
    return int(next(l for l in out.splitlines() if "n (" in l).split("=")[1])


def entries(layer, unite, mesure, where):
    rows = extract(layer, mesure, where)
    rows.sort(key=lambda r: -float(r["valeur"] or 0))
    gardees = rows[: PLAFONDS[layer]]
    log(f"{layer} : {len(rows)} nommées, {len(gardees)} indexées")
    return [
        {
            "id": r["id"],
            "nom": r["nom"],
            "couche": layer,
            "valeur": round(float(r["valeur"] or 0), 2),
            "unite": unite,
            "bbox": [round(float(r[k]), 5) for k in ("x0", "y0", "x1", "y1")],
        }
        for r in gardees
    ]


def main():
    WEB.mkdir(parents=True, exist_ok=True)

    items = []
    items += entries("bassins", "km²", "surface_km2", "1=1")
    items += entries("cours_eau", "km", "cum_amont_km",
                     "nom IS NOT NULL AND nom <> ''")
    items += entries("plans_eau", "ha", "surface_ha",
                     "nom IS NOT NULL AND nom <> ''")

    fleuves = json.loads((WEB / "fleuves.json").read_text(encoding="utf-8"))
    totaux = {layer: compte(layer) for layer in ("bassins", "cours_eau", "plans_eau")}

    index = {
        "zone": {
            "nom": "France métropolitaine",
            "bbox": [-5.2, 41.3, 9.6, 51.1],
        },
        "stats": {
            **totaux,
            "fleuves": len(fleuves),
            "surface_totale_km2": round(
                sum(e["valeur"] for e in items if e["couche"] == "bassins"), 1
            ),
        },
        "entites": items,
    }
    path = WEB / "index.json"
    path.write_text(json.dumps(index, ensure_ascii=False), encoding="utf-8")
    log(f"-> index.json : {len(items)} entrées, {path.stat().st_size / 1e6:.2f} Mo")
    log(f"stats : {index['stats']}")


if __name__ == "__main__":
    main()
