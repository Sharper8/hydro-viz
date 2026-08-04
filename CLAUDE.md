# CLAUDE.md — hydro-viz (contexte projet pour agents de code)

## Quoi

Application web statique de **visualisation des bassins versants de France**.
Projet perso de Sylva + Nathan Ard. Zéro backend au stade MVP — tout est pré-calculé
et servi en statique. Le code est écrit par des agents (Claude Code) ; les humains ne
codent pas, ils donnent du feedback utilisateur. Donc : le pipeline doit être
**reproductible en une commande**, le déploiement **automatique via GitHub Actions**.

## MVP (scope strict — rien d'autre)

Voir les bassins versants de l'**hydroécorégion de niveau 1 « Jura – Préalpes Nord »**
(code HER1 = 5) sur une carte web interactive.

- Carte MapLibre GL JS, fond de plan libre sans clé API (IGN Géoplateforme et/ou OSM raster).
- Couche polygones des bassins versants + couche lignes des cours d'eau, servies en
  **PMTiles** (protocole `pmtiles` + `maplibre-gl-js`), pas de serveur de tuiles.
- Sidebar : liste recherchable des entités (bassins / cours d'eau principaux), clic →
  zoom + highlight.
- Clic sur la carte → panneau d'info de l'entité cliquée (attributs Sandre : code, nom,
  surface…).
- UI en français.
- Page légère : budget total tuiles + app < ~100 Mo (limite GitHub Pages 100 Mo/fichier,
  1 Go/site). Si ça dépasse : simplifier les géométries / baisser le zoom max tippecanoe /
  passer aux couches plus grossières (voir Fallbacks).

## Données (sources officielles, licence ouverte)

Catalogue Sandre (JSON GeoNetwork, liste les URLs de téléchargement SHP/GPKG/GeoJSON
par jeu de données) :
https://www.sandre.eaufrance.fr/atlas/srv/api/records/fdff993a-0382-4734-8f0c-03b9f7b4d83e
(BD Topage® Métropole 2025). Jeux utiles :
`BassinVersantTopographique`, `CoursEau`, `PlanEau`, éventuellement
`RegionHydrographique` / `SecteurHydrographique` / `SousSecteurHydrographique` / `ZoneHydrographique`.

Pattern d'URL de téléchargement (exemple connu 2025) :
`https://services.sandre.eaufrance.fr/telechargement/geo/ETH/BDTopage/2025/<Jeu>/<Jeu>_FXX_...zip`

WFS Sandre (alternative au zip national si trop gros — requêtes paginées avec bbox) :
`https://services.sandre.eaufrance.fr/geo/sandre?` (GetCapabilities pour les noms de couches,
ex. `CoursEau_FXX_Topage2024`).

Hydroécorégions (HER niveau 1 et 2) : chercher « hydroecoregion » sur le catalogue Sandre /
geo2france datahub. Rappel : HER1 « Jura – Préalpes Nord » = code 5, composée des HER2
2, 3, 5, 6, 11, 76, 79, 80, 85, 120. **Fallback acceptable pour le MVP** : bbox/découpage sur
les départements 01, 25, 38, 39, 69, 73, 74, 70 (couche départements : geo.api.gouv.fr ou
IGN Admin Express) si la couche HER est introuvable rapidement.

Fond de carte sans clé :
- Orthophoto IGN : WMTS `https://data.geopf.fr/wmts` couche `ORTHOIMAGERY.ORTHOPHOTOS`
- Plan IGN vector tiles : `https://data.geopf.fr/tms/1.0.0/PLAN.IGN/{z}/{x}/{y}.pbf`
- OSM raster en secours.

## Pipeline attendu

`scripts/` (bash + python, reproductible) :
1. `download` — récupère les jeux Sandre (zip national **ou** WFS paginé avec bbox si > ~500 Mo)
   + couche HER (ou fallback départements).
2. `prepare` — clip à la zone d'étude (ogr2ogr / geopandas), reprojette en EPSG:4326,
   nettoie les attributs (garde l'essentiel), exporte GeoJSON(S) intermédiaires
   + un `index.json` léger pour la sidebar (id, nom, type, bbox/centroïde).
3. `tiles` — tippecanoe → `web/public/tiles/*.pmtiles` (flags : `-zg` ou zoom explicite,
   `--drop-densest-as-needed`, `--no-tile-size-limit` si besoin, nommer les couches).
4. Le workflow GitHub Actions fait tout ça puis déploie `web/dist` + les PMTiles sur
   GitHub Pages.

Outils à installer (VM Ubuntu, apt/pip disponibles) : `gdal-bin` (ogr2ogr), `tippecanoe`
(build from source ou binaire), `python3-geopandas` ou pip. Node est déjà là (~/.hermes/node/bin).

## Frontend

- Vite + vanilla TS ou React léger (au choix), `maplibre-gl` + `pmtiles`.
- Les PMTiles sont des assets statiques dans `public/tiles/`, servis par GitHub Pages
  (les Range Requests fonctionnent sur GitHub Pages).
- Déploy via GitHub Actions officielles Pages (`actions/upload-pages-artifact` +
  `actions/deploy-pages`). Pages source = « GitHub Actions ».

## Phase 2 (en cours) — France entière + fleuves principaux + dark mode

Le MVP (HER Jura-Préalpes Nord uniquement) est livré et déployé. Phase 2, demandée par Sylva :

1. **Passage à la France métropolitaine entière.** Mêmes jeux Sandre, emprise nationale.
   Attention RAM (3,7 Go) : traiter en streaming (ogr2ogr/SQLite, pyarrow), éviter de charger
   tout CoursEau national en geopandas. Le zip national complet fait 1,75 Go — préférer les
   zips par jeu de données si raisonnables, sinon WFS paginé national.
2. **Fleuves principaux & bassins agrégés** (le cœur de la demande) :
   - Construire le graphe amont/aval à partir des nœuds hydrographiques BD TOPAGE.
   - Pour chaque cours d'eau : longueur, **longueur cumulée amont** (proxy « importance »),
     nombre d'affluents. Les « fleuves principaux » émergent du cumul (pas de seuil en dur :
     les métriques sont cuites en attributs et le filtrage est dynamique côté client).
   - Pour chaque bassin versant topographique : `main_stem_id` = le fleuve principal dans
     lequel il se jette (via le graphe). Permet de colorer « qui va avec quoi » et d'agréger
     le bassin complet d'un fleuve (ex. tout le Rhône).
   - Couche `RegionHydrographique` Sandre (1er ordre = grands bassins : Rhône, Loire,
     Seine…) pour la vue « bassin entier » immédiate.
   - Pré-calculer les polygones dissous (union des BVT) pour les ~30-50 fleuves principaux.
3. **UI** :
   - Slider « importance minimale des rivières » → filtre MapLibre live sur l'attribut cumulé.
   - Liste des fleuves principaux (Rhône, Saône, Doubs, Ain…) ; clic → highlight du bassin
     agrégé + stats (nb affluents, surface, longueur).
   - **Thème sombre** : fond CARTO Dark Matter raster (sans clé,
     `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json` existe aussi en
     vectoriel) ; palette catégorielle distincte par fleuve principal (rivières ET bassins
     teintés selon `main_stem_id`, les non-classés en gris/bleu neutre).
   - Conserver sidebar, recherche, clic→fiche info.
4. **Budget tuiles national** : chaque PMTiles doit rester < ~90 Mo (hébergement GitHub
   Pages, pas d'alternative pour l'instant). Techniques : `tippecanoe` avec
   `{"tippecanoe":{"minzoom":N}}` par feature (bas zoom = seulement les gros fleuves/bassins,
   détail complet à partir de z≈10), `--drop-densest-as-needed`, simplification géométrique
   en fonction du zoom. Mesurer et reporter la taille finale par couche.
5. **Domaine custom** : `hydro.devprocore.com` (CNAME déjà créé côté Cloudflare, DNS-only,
   pointe sur sharper8.github.io). Passer Vite en `base: '/'`, ajouter `public/CNAME` contenant
   `hydro.devprocore.com`. Ne PAS appeler l'API Cloudflare (token DNS-only, hors scope).
   Le README doit référencer https://hydro.devprocore.com comme URL canonique.

Données débit : PAS dans BD TOPAGE (les débits sont côté Hub'Eau/stations — phase ultérieure).
Le classement « rivière principale » se fonde donc sur longueur cumulée amont + nb affluents +
surface de bassin, tous calculables localement.

## Explicitement HORS scope (idées pour plus tard, ne pas implémenter)

Simulation/délimitation à la volée (pysheds, WASM), débits, barrages, jumeau virtuel,
zones inondables, 3D, PostGIS, frise chronologique. Le Gemini deep-research de référence
est archivé dans `docs/deep-research.md` — c'est la feuille de route long terme, pas le MVP.

## Règles

- Commits clairs, en anglais ou français, conventionnels.
- Ne jamais committer de données brutes lourdes (> 50 Mo) : les gros fichiers sont
  régénérés par le pipeline (`.gitignore` adapté) — **exception** : les PMTiles finaux
  peuvent être commités si < 100 Mo pour simplifier le déploiement Pages, sinon
  produits par le workflow.
- README.md : comment lancer le pipeline en local + URL de la démo.
