#!/usr/bin/env python3
"""Extrait la zone d'étude (une HER1) d'un GeoJSON, ou en calcule la bbox WFS.

Usages :
    extract_zone.py <her1.geojson> <code_her1> <zone.geojson>
    extract_zone.py --bbox <zone.geojson>       -> "lat_min,lon_min,lat_max,lon_max"
"""
import json
import sys

# Marge (degrés) autour de la zone : les bassins versants débordent de l'HER,
# on les récupère entièrement quitte à les filtrer ensuite par intersection.
MARGIN = 0.15


def bounds(geom):
    xs, ys = [], []

    def walk(node):
        if node and isinstance(node[0], (int, float)):
            xs.append(node[0])
            ys.append(node[1])
        else:
            for child in node:
                walk(child)

    walk(geom["coordinates"])
    return min(xs), min(ys), max(xs), max(ys)


def main(argv):
    if argv[0] == "--bbox":
        fc = json.load(open(argv[1], encoding="utf-8"))
        minx, miny, maxx, maxy = bounds(fc["features"][0]["geometry"])
        # ordre lat,lon attendu par le WFS 2.0 avec urn:ogc:def:crs:EPSG::4326
        print(
            f"{miny - MARGIN:.6f},{minx - MARGIN:.6f},"
            f"{maxy + MARGIN:.6f},{maxx + MARGIN:.6f}"
        )
        return 0

    src, code, dst = argv[0], int(argv[1]), argv[2]
    fc = json.load(open(src, encoding="utf-8"))
    matches = [f for f in fc["features"] if int(f["properties"].get("CdHER1", -1)) == code]
    if not matches:
        available = sorted(f["properties"].get("CdHER1") for f in fc["features"])
        print(f"HER1 code {code} introuvable. Codes disponibles : {available}", file=sys.stderr)
        return 1
    feature = matches[0]
    name = feature["properties"].get("NomHER1")
    print(f"[zone] HER1 {code} = {name}", file=sys.stderr)
    out = {"type": "FeatureCollection", "features": [feature]}
    with open(dst, "w", encoding="utf-8") as fh:
        json.dump(out, fh)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
