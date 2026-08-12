#!/usr/bin/env python3
"""Étape 2b — Bassins agrégés des fleuves principaux.

À partir des métriques du graphe (`scripts/graph.py`) :

- dissout les bassins versants topographiques par fleuve principal traversé
  (un bassin appartient au bassin agrégé de *tous* les fleuves de sa chaîne
  aval : la Saône est donc incluse dans le Rhône, le Doubs dans les deux) ;
- classe les fleuves récepteurs par surface drainée et attribue à chacun un
  rang de palette (`stems.csv`) — les rangs 1..N sont coloriés côté carte, le
  rang 0 correspond aux cours d'eau non rattachés ;
- écrit `web/public/fleuves.json`, la fiche des fleuves principaux affichée
  dans la barre latérale (stats + emprise pour le zoom).

Seule étape du pipeline à charger de la géométrie en mémoire : 6 190 polygones
de bassins versants, ~200 Mo — sans commune mesure avec les 3 M de tronçons,
qui eux ne sont lus qu'en table attributaire.
"""
import json
import pathlib
import sys

import geopandas as gpd
import pandas as pd
from shapely import make_valid
from shapely.geometry import MultiPolygon, Polygon

ROOT = pathlib.Path(__file__).resolve().parent.parent
NAT = ROOT / "data" / "raw" / "national"
PREP = ROOT / "data" / "prepared"
WEB = ROOT / "web" / "public"

CRS_METRIC = "EPSG:2154"
# Nombre de fleuves distingués par une couleur propre sur la carte : c'est
# exactement la taille de la palette validée (web/src/palette.ts). Au-delà, le
# rang vaudrait 0 et l'entité retomberait sur le bleu neutre.
NB_TEINTES = 12
# Simplification (m) avant / après dissolution : la couche agrégée sert aux
# zooms régionaux, sa précision métrique n'a aucun intérêt.
SIMPLIFY_AVANT = 80
SIMPLIFY_APRES = 150
# Simplifier chaque bassin *avant* de les fondre désolidarise leurs frontières
# mitoyennes et laisse des lamelles de quelques ares entre voisins. Elles
# ressortent comme un moucheté de trous sur la carte : on rebouche tout ce qui
# est sous ce seuil (km²). Une enclave réelle est bien plus grande.
TROU_MIN_KM2 = 1.0


def log(msg):
    print(f"\033[32m[aggregate]\033[0m {msg}", file=sys.stderr)


def boucher_lamelles(geom, seuil_m2):
    """Supprime les anneaux intérieurs plus petits que `seuil_m2`."""
    parts = geom.geoms if isinstance(geom, MultiPolygon) else [geom]
    nettoyes = [
        Polygon(
            part.exterior,
            [ring for ring in part.interiors if Polygon(ring).area >= seuil_m2],
        )
        for part in parts
        if isinstance(part, Polygon)
    ]
    return MultiPolygon(nettoyes) if len(nettoyes) > 1 else nettoyes[0]


def main():
    PREP.mkdir(parents=True, exist_ok=True)
    WEB.mkdir(parents=True, exist_ok=True)

    fleuves = json.loads((PREP / "fleuves.json").read_text(encoding="utf-8"))
    metrics = pd.read_csv(
        PREP / "metrics_bassins.csv", dtype=str, keep_default_na=False
    ).set_index("id")

    shp = NAT / "BassinVersantTopographique_FXX" / "BassinVersantTopographique_FXX.shp"
    bv = gpd.read_file(shp)
    bv = bv.set_crs(CRS_METRIC, allow_override=True)
    bv["geometry"] = bv.geometry.apply(make_valid)
    bv = bv[~bv.geometry.is_empty & bv.geometry.notna()]
    bv["surface_km2"] = bv.geometry.area / 1e6
    log(f"bassins versants : {len(bv)} — {bv['surface_km2'].sum():,.0f} km²")

    bv = bv.join(metrics, on="CdOH")
    bv["main_stem_id"] = bv["main_stem_id"].fillna("")
    bv["fleuves_amont"] = bv["fleuves_amont"].fillna("")

    # --- Rangs de palette : les plus grands bassins récepteurs ----------------
    par_stem = (
        bv[bv["main_stem_id"] != ""]
        .groupby(["main_stem_id", "main_stem_nom"])["surface_km2"]
        .sum()
        .sort_values(ascending=False)
    )
    stems = par_stem.head(NB_TEINTES).reset_index()
    stems["rang"] = range(1, len(stems) + 1)
    stems.to_csv(
        PREP / "stems.csv", index=False,
        columns=["main_stem_id", "main_stem_nom", "rang", "surface_km2"],
        header=["id", "nom", "rang", "surface_km2"],
    )
    # La légende de la carte se construit sur cette liste, et non sur celle des
    # fleuves principaux : un fleuve peut porter une teinte sans figurer au
    # top 48 du cumul amont (la Somme Canalisée, par exemple).
    (WEB / "stems.json").write_text(
        json.dumps(
            [
                {"id": r["main_stem_id"], "nom": r["main_stem_nom"], "stem": int(r["rang"])}
                for _, r in stems.iterrows()
            ],
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    log(f"-> stems.csv + stems.json : {len(stems)} fleuves teintés")
    for _, row in stems.head(10).iterrows():
        log(f"   {row['rang']:2d}. {row['main_stem_nom']:<22} {row['surface_km2']:>9,.0f} km²")

    # --- Dissolution par fleuve principal -------------------------------------
    # Deux sélections cohabitent : les fleuves principaux (top 48 du cumul amont,
    # calculés par graph.py) et les fleuves teintés (les 12 plus grands bassins
    # récepteurs). Elles ne coïncident pas — la Somme Canalisée draine un grand
    # bassin sans figurer au classement du cumul. On dissout leur *union*, sinon
    # une couleur de la légende n'aurait aucun polygone à bas zoom.
    rang_par_id = dict(zip(stems["main_stem_id"], stems["rang"]))
    connus = {f["id"] for f in fleuves}
    manquants = [r for _, r in stems.iterrows() if r["main_stem_id"] not in connus]
    if manquants:
        mesures = pd.read_csv(PREP / "metrics_cours_eau.csv").set_index("id")
        for row in manquants:
            m = mesures.loc[row["main_stem_id"]]
            fleuves.append(
                {
                    "id": row["main_stem_id"],
                    "nom": row["main_stem_nom"],
                    "longueur_km": float(m["longueur_km"]),
                    "cum_amont_km": float(m["cum_amont_km"]),
                    "nb_affluents": int(m["nb_affluents"]),
                    "nb_amont_total": int(m["nb_amont_total"]),
                }
            )
        log(f"fleuves teintés ajoutés à la dissolution : "
            f"{', '.join(r['main_stem_nom'] for r in manquants)}")

    log("dissolution des bassins agrégés…")
    simple = bv.geometry.simplify(SIMPLIFY_AVANT, preserve_topology=True)
    appartenance = bv["fleuves_amont"].str.split(";")

    # Deux fleuves qui se suivent sans confluence notable drainent exactement le
    # même bassin (« la Loire » et son estuaire « Fleuve la Loire »). On ne garde
    # alors que le plus long des deux : un seul polygone, un seul nom.
    # Un fleuve teinté l'emporte toujours comme représentant : sinon sa couleur
    # existerait dans la légende sans polygone sur la carte (la Somme Canalisée
    # partage son bassin avec la Somme). À défaut, le plus long des deux gagne.
    empreintes = {}
    for fleuve in sorted(
        fleuves, key=lambda f: (f["id"] not in rang_par_id, -f["longueur_km"])
    ):
        cle = tuple(sorted(bv.index[appartenance.apply(lambda c: fleuve["id"] in c)]))
        if cle and cle not in empreintes:
            empreintes[cle] = fleuve["id"]
    retenus = set(empreintes.values())
    ignores = [f["nom"] for f in fleuves if f["id"] not in retenus]
    if ignores:
        log(f"doublons de bassin écartés : {', '.join(ignores)}")

    records = []
    for fleuve in fleuves:
        if fleuve["id"] not in retenus:
            continue
        masque = appartenance.apply(lambda chaine: fleuve["id"] in chaine)
        subset = simple[masque]
        if subset.empty:
            log(f"   {fleuve['nom']} : aucun bassin rattaché, ignoré")
            continue
        geom = boucher_lamelles(
            subset.union_all(), TROU_MIN_KM2 * 1e6
        ).simplify(SIMPLIFY_APRES, preserve_topology=True)
        surface = float(bv.loc[masque, "surface_km2"].sum())
        records.append(
            {
                "id": fleuve["id"],
                "nom": fleuve["nom"],
                "longueur_km": fleuve["longueur_km"],
                "cum_amont_km": fleuve["cum_amont_km"],
                "nb_affluents": fleuve["nb_affluents"],
                "nb_amont_total": fleuve["nb_amont_total"],
                "nb_bassins": int(masque.sum()),
                "surface_km2": round(surface, 1),
                "stem": int(rang_par_id.get(fleuve["id"], 0)),
                "geometry": geom,
            }
        )
        log(f"   {fleuve['nom']:<24} {surface:>9,.0f} km² ({int(masque.sum())} bassins)")

    agr = gpd.GeoDataFrame(records, crs=CRS_METRIC).to_crs("EPSG:4326")
    agr = agr.sort_values("surface_km2", ascending=False).reset_index(drop=True)
    out = PREP / "fleuves_bassins.geojson"
    agr.to_file(out, driver="GeoJSON", coordinate_precision=5)
    log(f"-> {out.name} : {len(agr)} bassins agrégés, {out.stat().st_size / 1e6:.1f} Mo")

    # --- Fiche web des fleuves principaux -------------------------------------
    # La liste de la barre latérale est classée par longueur cumulée amont —
    # c'est le critère « importance » de la phase 2, pas la surface drainée.
    fiche = []
    for _, row in agr.sort_values("cum_amont_km", ascending=False).iterrows():
        minx, miny, maxx, maxy = row.geometry.bounds
        fiche.append(
            {
                "id": row["id"],
                "nom": row["nom"],
                "longueur_km": row["longueur_km"],
                "cum_amont_km": row["cum_amont_km"],
                "nb_affluents": int(row["nb_affluents"]),
                "nb_amont_total": int(row["nb_amont_total"]),
                "nb_bassins": int(row["nb_bassins"]),
                "surface_km2": row["surface_km2"],
                "stem": int(rang_par_id.get(row["id"], 0)),
                "bbox": [round(v, 5) for v in (minx, miny, maxx, maxy)],
            }
        )
    (WEB / "fleuves.json").write_text(
        json.dumps(fiche, ensure_ascii=False), encoding="utf-8"
    )
    log(f"-> web/public/fleuves.json : {len(fiche)} entrées")


if __name__ == "__main__":
    main()
