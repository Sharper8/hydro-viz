# hydro-viz — Bassins versants du Jura et des Préalpes du Nord

Carte web interactive des bassins versants de l'**hydroécorégion de niveau 1
« Jura – Préalpes du Nord »** (code HER1 = 5), à partir des données ouvertes
**BD Topage® 2025** du Sandre / OFB.

**Démo : https://sharper8.github.io/hydro-viz/**

![Aperçu](docs/apercu.png)

## Architecture (en 5 lignes)

1. `scripts/download.sh` interroge le **WFS Sandre** (paginé, filtré sur la bbox de la zone) —
   le zip national BD Topage pèse 1,75 Go, on ne le télécharge donc pas.
2. `scripts/prepare.py` clippe à l'HER1 n°5, reprojette en EPSG:4326, allège les attributs
   et écrit les GeoJSON intermédiaires + `web/public/index.json` (index de la barre latérale).
3. `scripts/tiles.sh` transforme ces GeoJSON en **PMTiles** via `tippecanoe` (une archive par couche).
4. `web/` est une application **Vite + TypeScript** avec `maplibre-gl` et `pmtiles` — aucun backend,
   aucune clé API : les tuiles sont lues en Range Requests directement depuis GitHub Pages.
5. `.github/workflows/deploy.yml` construit le frontend et déploie sur GitHub Pages à chaque push.

## Données

| Couche | Source | Entités |
| --- | --- | --- |
| Bassins versants topographiques | BD Topage® 2025 (Sandre) | 201 |
| Cours d'eau | BD Topage® 2025 (Sandre) | 3 570 |
| Plans d'eau | BD Topage® 2025 (Sandre) | 900 |
| Contour de l'hydroécorégion | `sa:Hydroecoregion1_FXX` (Sandre) | 1 |

Superficie cumulée des bassins retenus : ~27 044 km². Total des tuiles : **6,7 Mo**
(largement sous la limite de 100 Mo par fichier de GitHub Pages).

Un bassin versant étant une unité naturelle, sa géométrie n'est **pas** découpée sur la
frontière de l'hydroécorégion : sont retenus les bassins dont au moins 25 % de la surface
recouvre la zone. Les cours d'eau et plans d'eau, eux, sont clippés à l'emprise des
bassins retenus.

Fonds de plan (libres, sans clé) : **Plan IGN** et **photo aérienne** via la Géoplateforme
IGN (`data.geopf.fr`), avec bascule automatique sur **OpenStreetMap** si le service IGN
ne répond pas.

## Lancer le pipeline en local

Prérequis (Ubuntu) :

```bash
sudo apt-get install -y gdal-bin tippecanoe
pip install geopandas shapely pyogrio
```

Puis, en une commande :

```bash
./scripts/run-all.sh
```

Les étapes sont aussi exécutables séparément :

```bash
./scripts/download.sh      # WFS Sandre -> data/raw/
python3 scripts/prepare.py # clip + allègement -> data/prepared/ + web/public/index.json
./scripts/tiles.sh         # tippecanoe -> web/public/tiles/*.pmtiles
```

`download.sh` est idempotent : un fichier déjà présent dans `data/raw/` n'est pas
retéléchargé (supprimer le fichier pour forcer). Comptez ~2 min pour l'ensemble.

## Frontend

```bash
cd web
npm install
npm run dev      # http://localhost:5173/hydro-viz/
npm run build    # -> web/dist
```

## Déploiement

Le workflow GitHub Actions se déclenche à chaque push sur `main`. Les PMTiles étant
versionnés (6,7 Mo), le déploiement ne dépend pas de la disponibilité des services Sandre.
Pour régénérer les données depuis la source : onglet **Actions → Déploiement GitHub Pages →
Run workflow**, en cochant `regenerer_donnees`.

## Notes et limites

- La couche HER a bien été trouvée sur le WFS Sandre (`sa:Hydroecoregion1_FXX`) : le
  fallback « départements 01/25/38/39/69/70/73/74 » documenté dans `CLAUDE.md` n'a pas
  servi. Il reste noté dans `scripts/config.sh` (`FALLBACK_DEPTS`).
- Le WFS Sandre attend l'ordre **lat,lon** pour les bbox en `urn:ogc:def:crs:EPSG::4326`,
  et le format GeoJSON s'y nomme exactement `application/json; subtype=geojson`.
- La barre latérale affiche au maximum 300 résultats à la fois (l'index en contient 2 701) ;
  la recherche est insensible aux accents et à la casse.

## Licence des données

BD Topage® — Sandre / OFB / IGN, sous Licence Ouverte Etalab 2.0.
Fonds de carte : © IGN Géoplateforme, © OpenStreetMap contributors.
