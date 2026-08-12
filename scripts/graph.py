#!/usr/bin/env python3
"""Étape 2a — Graphe hydrographique national (BD Topage®).

Construit le réseau amont/aval à partir des tronçons hydrographiques, puis en
déduit, pour chaque **cours d'eau** (entité nommée du Sandre) :

- `longueur_km`      : longueur propre (géométrie de la couche CoursEau)
- `cum_amont_km`     : longueur cumulée de tout le chevelu qui s'y déverse,
                       sa propre longueur comprise — le proxy « importance »
- `nb_affluents`     : nombre de cours d'eau se jetant *directement* dedans
- `nb_amont_total`   : nombre total de cours d'eau à l'amont
- `aval_id`          : cours d'eau récepteur immédiat
- `main_stem_id`     : fleuve principal récepteur (le plus long cours d'eau de
                       la chaîne aval — cf. `main_stem` dans le code)

et pour chaque **bassin versant topographique** son `main_stem_id` (via son
exutoire, qui est un code de cours d'eau) ainsi que la chaîne complète des
cours d'eau traversés à l'aval.

Pourquoi passer par les tronçons : la couche `CoursEau` ne porte *aucun*
attribut topologique (seulement code + nom). Seule `TronconHydrographique`
expose `CdNoeudDebut` / `CdNoeudFin` / `CdCoursEau_1`, et donc le graphe.
Environ 47 % des tronçons n'ont pas de cours d'eau rattaché (chevelu anonyme) :
on les traverse comme de simples connecteurs jusqu'au prochain tronçon nommé.

Sorties (data/prepared/) : metrics_cours_eau.csv, metrics_bassins.csv,
fleuves.json.
"""
import array
import csv
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
NAT = ROOT / "data" / "raw" / "national"
PREP = ROOT / "data" / "prepared"

# Nombre de « fleuves principaux » retenus pour la liste et les bassins agrégés
NB_FLEUVES_PRINCIPAUX = 48
# Longueur propre minimale (km) pour prétendre au titre de fleuve principal
LONGUEUR_MIN_FLEUVE = 30.0

csv.field_size_limit(1 << 24)


def log(msg):
    print(f"\033[34m[graph]\033[0m {msg}", file=sys.stderr)


# --- 1. Cours d'eau : code, nom, longueur -------------------------------------
def load_cours_eau():
    """Codes, noms et longueurs (Lambert-93, donc en mètres) des cours d'eau."""
    attrs = NAT / "coursEau_attrs.csv"
    if not attrs.exists():
        shp = NAT / "CoursEau_FXX" / "CoursEau_FXX.shp"
        log("extraction des longueurs de cours d'eau (ogr2ogr)…")
        subprocess.run(
            [
                "ogr2ogr", "-f", "CSV", str(attrs), str(shp),
                "-dialect", "SQLITE",
                "-sql", "SELECT CdOH, TopoOH, ST_Length(geometry) AS len_m FROM CoursEau_FXX",
            ],
            check=True,
        )

    ce_index = {}      # code -> indice
    noms, longueurs = [], []
    with attrs.open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            code = row["CdOH"]
            if not code or code in ce_index:
                continue
            ce_index[code] = len(noms)
            noms.append((row["TopoOH"] or "").strip())
            longueurs.append(float(row["len_m"] or 0) / 1000.0)
    log(f"cours d'eau : {len(noms)}")
    return ce_index, noms, longueurs


# --- 2. Tronçons : graphe des nœuds hydrographiques ---------------------------
def load_troncons(ce_index):
    """Arêtes (nœud amont -> nœud aval) et cours d'eau porté par chacune.

    Les tronçons sont numérisés dans le sens de l'écoulement (`SensEcoulement`
    vaut « dans direction tronçon » ou « dans les deux directions » — aucun
    tronçon inversé dans le millésime 2025), donc début = amont, fin = aval.
    """
    node_index = {}
    src, dst, edge_ce = array.array("i"), array.array("i"), array.array("i")

    def node_id(code):
        idx = node_index.get(code)
        if idx is None:
            idx = len(node_index)
            node_index[code] = idx
        return idx

    files = sorted((NAT / "troncon_csv").glob("*.csv"))
    if not files:
        sys.exit("troncon_csv/ absent : lancer scripts/download.sh")
    for path in files:
        with path.open(encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                a, b = row["CdNoeudDeb"], row["CdNoeudFin"]
                if not a or not b:
                    continue
                src.append(node_id(a))
                dst.append(node_id(b))
                code = row["CdCoursEau"]
                edge_ce.append(ce_index.get(code, -1) if code else -1)
        log(f"  {path.name} : {len(src)} tronçons cumulés")

    n_nodes = len(node_index)
    node_index.clear()  # les codes de nœuds ne resservent plus
    log(f"graphe : {len(src)} tronçons, {n_nodes} nœuds")
    return n_nodes, src, dst, edge_ce


def build_csr(n_nodes, keys, n_edges):
    """Adjacence compacte (CSR) : start[i]..start[i+1] indexe les arêtes de i."""
    start = array.array("i", bytes(4 * (n_nodes + 1)))
    for k in keys:
        start[k + 1] += 1
    for i in range(n_nodes):
        start[i + 1] += start[i]
    cursor = array.array("i", start[:n_nodes])
    order = array.array("i", bytes(4 * n_edges))
    for e in range(n_edges):
        k = keys[e]
        order[cursor[k]] = e
        cursor[k] += 1
    return start, order


# --- 3. Cours d'eau récepteur -------------------------------------------------
def resolve_downstream(n_nodes, dst, edge_ce, out_start, out_order, longueurs):
    """Pour chaque nœud, le cours d'eau qui emporte l'eau vers l'aval.

    Si aucun tronçon sortant n'est rattaché à un cours d'eau, on poursuit à
    travers le chevelu anonyme jusqu'au premier tronçon nommé (mémoïsé).
    -1 = aucun aval (exutoire, mer) ou boucle non résolue.
    """
    NEUF, EN_COURS = -2, -3
    resolved = array.array("i", [NEUF]) * n_nodes

    for root in range(n_nodes):
        if resolved[root] != NEUF:
            continue
        stack = [root]
        while stack:
            node = stack[-1]
            state = resolved[node]

            if state == NEUF:
                # 1re visite : un tronçon sortant nommé tranche immédiatement
                direct, best_len = -1, -1.0
                for i in range(out_start[node], out_start[node + 1]):
                    ce = edge_ce[out_order[i]]
                    if ce >= 0 and longueurs[ce] > best_len:
                        best_len, direct = longueurs[ce], ce
                if direct >= 0:
                    resolved[node] = direct
                    stack.pop()
                    continue
                # sinon on descend le chevelu anonyme
                resolved[node] = EN_COURS
                for i in range(out_start[node], out_start[node + 1]):
                    child = dst[out_order[i]]
                    if child != node and resolved[child] == NEUF:
                        stack.append(child)
                continue

            if state == EN_COURS:
                # enfants résolus : on hérite du plus long cours d'eau trouvé
                answer, best_len = -1, -1.0
                for i in range(out_start[node], out_start[node + 1]):
                    ce = resolved[dst[out_order[i]]]
                    if ce >= 0 and longueurs[ce] > best_len:
                        best_len, answer = longueurs[ce], ce
                resolved[node] = answer  # -1 si exutoire ou boucle non résolue

            stack.pop()

    return resolved


def main():
    PREP.mkdir(parents=True, exist_ok=True)
    ce_index, noms, longueurs = load_cours_eau()
    n_ce = len(noms)

    n_nodes, src, dst, edge_ce = load_troncons(ce_index)
    n_edges = len(src)

    log("adjacence sortante…")
    out_start, out_order = build_csr(n_nodes, src, n_edges)

    log("résolution du cours d'eau récepteur par nœud…")
    node_ce = resolve_downstream(
        n_nodes, dst, edge_ce, out_start, out_order, longueurs
    )

    # --- Exutoires de chaque cours d'eau --------------------------------------
    # Nœud terminal = fin d'un tronçon du cours d'eau, jamais début d'un autre.
    log("exutoires par cours d'eau…")
    starts_of = [None] * n_ce   # ensembles de nœuds « début » par cours d'eau
    ends_of = [None] * n_ce
    for e in range(n_edges):
        ce = edge_ce[e]
        if ce < 0:
            continue
        if starts_of[ce] is None:
            starts_of[ce], ends_of[ce] = set(), set()
        starts_of[ce].add(src[e])
        ends_of[ce].add(dst[e])

    aval = array.array("i", [-1]) * n_ce
    for ce in range(n_ce):
        if ends_of[ce] is None:
            continue
        outlets = ends_of[ce] - starts_of[ce]
        best, best_len = -1, -1.0
        for node in outlets or ends_of[ce]:
            recv = node_ce[node]
            if recv >= 0 and recv != ce and longueurs[recv] > best_len:
                best_len, best = longueurs[recv], recv
        aval[ce] = best
    starts_of = ends_of = None

    lies = sum(1 for ce in range(n_ce) if aval[ce] >= 0)
    log(f"cours d'eau rattachés à un récepteur : {lies} / {n_ce} ({lies / n_ce:.1%})")

    # --- Cumul amont (tri topologique de Kahn, cycles cassés en fin) ----------
    log("longueur cumulée amont…")
    indeg = array.array("i", bytes(4 * n_ce))
    for ce in range(n_ce):
        if aval[ce] >= 0:
            indeg[aval[ce]] += 1

    cum = list(longueurs)
    count_amont = array.array("i", bytes(4 * n_ce))
    remaining = array.array("i", indeg)
    fait = bytearray(n_ce)
    queue = [ce for ce in range(n_ce) if remaining[ce] == 0]
    processed, forcages = 0, 0

    # Le réseau n'est pas tout à fait acyclique : bras de delta, canaux
    # réversibles et boucles d'estuaire créent des circuits qui bloqueraient
    # Kahn (l'estuaire de la Loire en fait partie). Quand la file se vide sans
    # avoir tout traité, on force le sommet restant au plus petit cumul — le
    # « plus amont » du circuit — et on repart.
    while True:
        while queue:
            ce = queue.pop()
            fait[ce] = 1
            processed += 1
            down = aval[ce]
            if down >= 0 and not fait[down]:
                cum[down] += cum[ce]
                count_amont[down] += count_amont[ce] + 1
                remaining[down] -= 1
                if remaining[down] == 0:
                    queue.append(down)
        if processed >= n_ce:
            break
        reste = [ce for ce in range(n_ce) if not fait[ce]]
        if not reste:
            break
        forced = min(reste, key=lambda c: cum[c])
        remaining[forced] = 0
        queue.append(forced)
        forcages += 1
    if forcages:
        log(f"  {forcages} circuits ouverts de force (deltas, canaux réversibles)")

    # --- Fleuve principal récepteur -------------------------------------------
    # Le *terminal* de la chaîne est presque toujours un moignon d'estuaire
    # (« Passe de Saintonge » pour la Gironde, « Fleuve la Loire » pour
    # l'estuaire ligérien, « Bras de la Charente »…). On retient donc, parmi la
    # chaîne aval, le cours d'eau le plus long : la Garonne plutôt que la passe,
    # la Loire plutôt que son estuaire, le Rhône plutôt que la Saône.
    log("chaînes aval et fleuves principaux récepteurs…")
    main_stem = array.array("i", [-1]) * n_ce

    def chain_of(ce):
        """Suite des cours d'eau à l'aval de `ce`, `ce` compris."""
        seen, out = set(), []
        cur = ce
        while cur >= 0 and cur not in seen:
            seen.add(cur)
            out.append(cur)
            cur = aval[cur]
        return out

    for ce in range(n_ce):
        main_stem[ce] = max(chain_of(ce), key=lambda c: longueurs[c])

    # --- Fleuves principaux ---------------------------------------------------
    # Nommés et d'au moins LONGUEUR_MIN_FLEUVE km propres : sans ce garde-fou,
    # les moignons d'estuaire truquent le classement (« Passe de Saintonge »,
    # 7 km propres mais 83 000 km cumulés, sortirait 2e). Les canaux sont
    # écartés du titre de « fleuve » — ils relient artificiellement des bassins
    # et gonflent leur cumul de tout ce qu'ils traversent — mais conservent
    # leurs métriques dans metrics_cours_eau.csv.
    def eligible(ce):
        return (
            noms[ce]
            and longueurs[ce] >= LONGUEUR_MIN_FLEUVE
            and not noms[ce].lower().startswith("canal")
        )

    ranked = sorted((ce for ce in range(n_ce) if eligible(ce)), key=lambda c: -cum[c])
    principaux = ranked[:NB_FLEUVES_PRINCIPAUX]
    log("top 15 par longueur cumulée amont :")
    for rank, ce in enumerate(ranked[:15], 1):
        log(
            f"  {rank:2d}. {noms[ce]:<28} {cum[ce]:9.0f} km cumulés "
            f"({longueurs[ce]:.0f} km propres, {count_amont[ce]} cours d'eau amont)"
        )

    # --- Écriture des métriques cours d'eau -----------------------------------
    codes = [None] * n_ce
    for code, idx in ce_index.items():
        codes[idx] = code

    with (PREP / "metrics_cours_eau.csv").open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(
            ["id", "longueur_km", "cum_amont_km", "nb_affluents",
             "nb_amont_total", "aval_id", "main_stem_id", "main_stem_nom"]
        )
        nb_aff = array.array("i", bytes(4 * n_ce))
        for ce in range(n_ce):
            if aval[ce] >= 0:
                nb_aff[aval[ce]] += 1
        for ce in range(n_ce):
            writer.writerow([
                codes[ce],
                round(longueurs[ce], 2),
                round(cum[ce], 1),
                nb_aff[ce],
                count_amont[ce],
                codes[aval[ce]] if aval[ce] >= 0 else "",
                codes[main_stem[ce]] if main_stem[ce] >= 0 else "",
                noms[main_stem[ce]] if main_stem[ce] >= 0 else "",
            ])
    log(f"-> metrics_cours_eau.csv ({n_ce} lignes)")

    # --- Bassins versants : exutoire -> chaîne aval ---------------------------
    log("rattachement des bassins versants…")
    bv_csv = NAT / "bvt_attrs.csv"
    if not bv_csv.exists():
        subprocess.run(
            ["ogr2ogr", "-f", "CSV", str(bv_csv),
             str(NAT / "BassinVersantTopographique_FXX" / "BassinVersantTopographique_FXX.shp"),
             "-select", "CdOH,TopoOH,CdExutoire,CdBH"],
            check=True,
        )

    n_bv, rattaches = 0, 0
    with bv_csv.open(encoding="utf-8") as fin, \
         (PREP / "metrics_bassins.csv").open("w", newline="", encoding="utf-8") as fout:
        writer = csv.writer(fout)
        writer.writerow(
            ["id", "exutoire_id", "main_stem_id", "main_stem_nom", "fleuves_amont"])
        for row in csv.DictReader(fin):
            n_bv += 1
            ce = ce_index.get(row["CdExutoire"], -1)
            if ce < 0:
                writer.writerow([row["CdOH"], row["CdExutoire"], "", "", ""])
                continue
            rattaches += 1
            chain = chain_of(ce)
            stem = max(chain, key=lambda c: longueurs[c])
            # Chaîne aval complète, du plus amont au plus aval. On n'y filtre pas
            # les fleuves principaux : aggregate.py doit pouvoir dissoudre le
            # bassin de n'importe quel cours d'eau, y compris ceux qui portent
            # une teinte sans figurer au top du cumul amont.
            writer.writerow([
                row["CdOH"],
                row["CdExutoire"],
                codes[stem],
                noms[stem],
                ";".join(codes[c] for c in chain),
            ])
    log(f"-> metrics_bassins.csv ({n_bv} bassins, {rattaches} rattachés au réseau)")

    # --- Fiche des fleuves principaux -----------------------------------------
    fleuves = [
        {
            "id": codes[ce],
            "nom": noms[ce],
            "longueur_km": round(longueurs[ce], 1),
            "cum_amont_km": round(cum[ce], 0),
            "nb_affluents": int(nb_aff[ce]),
            "nb_amont_total": int(count_amont[ce]),
            "aval_id": codes[aval[ce]] if aval[ce] >= 0 else None,
            "main_stem_id": codes[main_stem[ce]] if main_stem[ce] >= 0 else None,
            "terminal": aval[ce] < 0,
        }
        for ce in principaux
    ]
    (PREP / "fleuves.json").write_text(
        json.dumps(fleuves, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    log(f"-> fleuves.json ({len(fleuves)} fleuves principaux)")


if __name__ == "__main__":
    main()
