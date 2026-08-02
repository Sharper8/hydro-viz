#!/usr/bin/env python3
"""Fusionne les pages GeoJSON d'un GetFeature WFS paginé en une FeatureCollection."""
import json
import pathlib
import sys


def main(page_dir, out_path):
    features = []
    for page in sorted(pathlib.Path(page_dir).glob("*.geojson")):
        try:
            data = json.loads(page.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            print(f"[merge] page illisible (réponse WFS non-JSON) : {page}", file=sys.stderr)
            return 1
        features.extend(data.get("features", []))
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump({"type": "FeatureCollection", "features": features}, fh)
    print(f"[merge] {len(features)} entités -> {out_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
