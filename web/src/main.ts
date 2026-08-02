import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import { BASEMAPS, type BasemapId } from "./basemaps";
import type { IndexFile, IndexEntry, LayerId } from "./types";

const BASE = import.meta.env.BASE_URL;

/** Le protocole `pmtiles://` permet à MapLibre de lire les archives en Range Requests. */
maplibregl.addProtocol("pmtiles", new Protocol().tile);

const LAYER_LABELS: Record<LayerId, string> = {
  bassins: "Bassin versant",
  cours_eau: "Cours d'eau",
  plans_eau: "Plan d'eau",
};

const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: { fond: BASEMAPS.plan.source },
    layers: [{ id: "fond", type: "raster", source: "fond" }],
  },
  center: [6.1, 46.2],
  zoom: 7,
  maxZoom: 15,
  attributionControl: false,
});

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");
map.addControl(
  new maplibregl.AttributionControl({
    compact: true,
    customAttribution: "BD Topage® 2025 — Sandre / OFB",
  }),
  "bottom-right",
);

// --- État de l'application ----------------------------------------------------
let entries: IndexEntry[] = [];
const bboxById = new Map<string, [number, number, number, number]>();
let activeFilter: LayerId | "tous" = "tous";
let selected: { id: string; couche: LayerId } | null = null;
let hovered: { id: string; couche: LayerId } | null = null;
let currentBasemap: BasemapId = "plan";
let ignFallbackDone = false;

// --- Couches de données -------------------------------------------------------
function addDataLayers() {
  for (const name of ["zone", "bassins", "cours_eau", "plans_eau"]) {
    map.addSource(name, {
      type: "vector",
      url: `pmtiles://${location.origin}${BASE}tiles/${name}.pmtiles`,
      // permet d'utiliser le survol via feature-state sur l'attribut `id`
      promoteId: name === "zone" ? undefined : "id",
    });
  }

  map.addLayer({
    id: "bassins-fill",
    type: "fill",
    source: "bassins",
    "source-layer": "bassins",
    paint: {
      "fill-color": "#0ea5e9",
      "fill-opacity": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        0.34,
        0.12,
      ],
    },
  });

  map.addLayer({
    id: "bassins-line",
    type: "line",
    source: "bassins",
    "source-layer": "bassins",
    paint: {
      "line-color": "#0369a1",
      "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.6, 10, 1.4, 14, 2.2],
      "line-opacity": 0.85,
    },
  });

  // Mise en évidence du bassin sélectionné : sous le réseau hydrographique, pour
  // que rivières et plans d'eau restent lisibles par-dessus l'aplat orangé.
  map.addLayer({
    id: "select-bassin-fill",
    type: "fill",
    source: "bassins",
    "source-layer": "bassins",
    filter: ["==", ["get", "id"], ""],
    paint: { "fill-color": "#f59e0b", "fill-opacity": 0.28 },
  });
  map.addLayer({
    id: "select-bassin-line",
    type: "line",
    source: "bassins",
    "source-layer": "bassins",
    filter: ["==", ["get", "id"], ""],
    paint: { "line-color": "#b45309", "line-width": 3 },
  });

  map.addLayer({
    id: "plans-eau-fill",
    type: "fill",
    source: "plans_eau",
    "source-layer": "plans_eau",
    paint: { "fill-color": "#0284c7", "fill-opacity": 0.75 },
  });
  map.addLayer({
    id: "select-plan-eau",
    type: "fill",
    source: "plans_eau",
    "source-layer": "plans_eau",
    filter: ["==", ["get", "id"], ""],
    paint: { "fill-color": "#f59e0b", "fill-opacity": 0.85 },
  });

  map.addLayer({
    id: "cours-eau-line",
    type: "line",
    source: "cours_eau",
    "source-layer": "cours_eau",
    paint: {
      // les grands cours d'eau sont tracés plus épais que les affluents
      "line-color": "#0369a1",
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        6,
        ["interpolate", ["linear"], ["coalesce", ["get", "longueur_km"], 0], 0, 0.3, 60, 1.6],
        11,
        ["interpolate", ["linear"], ["coalesce", ["get", "longueur_km"], 0], 0, 0.8, 60, 3.4],
        14,
        ["interpolate", ["linear"], ["coalesce", ["get", "longueur_km"], 0], 0, 1.6, 60, 5],
      ],
    },
  });

  // Le cours d'eau sélectionné passe au-dessus du reste du réseau.
  map.addLayer({
    id: "select-cours-eau",
    type: "line",
    source: "cours_eau",
    "source-layer": "cours_eau",
    filter: ["==", ["get", "id"], ""],
    paint: { "line-color": "#f59e0b", "line-width": 4, "line-opacity": 0.95 },
  });

  map.addLayer({
    id: "zone-line",
    type: "line",
    source: "zone",
    "source-layer": "zone",
    paint: {
      "line-color": "#b45309",
      "line-width": 2,
      "line-dasharray": [3, 2],
      "line-opacity": 0.9,
    },
  });
}

// --- Fond de carte ------------------------------------------------------------
function setBasemap(id: BasemapId) {
  currentBasemap = id;
  if (map.getLayer("fond")) map.removeLayer("fond");
  if (map.getSource("fond")) map.removeSource("fond");
  map.addSource("fond", BASEMAPS[id].source);
  const first = map.getStyle().layers?.[0]?.id;
  map.addLayer({ id: "fond", type: "raster", source: "fond" }, first);

  document.querySelectorAll<HTMLButtonElement>("#basemap-switch button").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.fond === id);
  });
}

// Si le service IGN ne répond pas, on bascule une fois sur OSM (aucune clé requise).
map.on("error", (event) => {
  const message = String((event as { error?: Error }).error?.message ?? "");
  if (ignFallbackDone || currentBasemap === "osm") return;
  if (message.includes("data.geopf.fr") || message.includes("geopf")) {
    ignFallbackDone = true;
    console.warn("Fond IGN indisponible, bascule sur OpenStreetMap.");
    setBasemap("osm");
  }
});

// --- Barre latérale -----------------------------------------------------------
const searchInput = document.getElementById("search") as HTMLInputElement;
const resultsList = document.getElementById("results") as HTMLUListElement;
const resultCount = document.getElementById("result-count") as HTMLParagraphElement;

/** Normalise pour une recherche insensible aux accents et à la casse. */
function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatNumber(value: number) {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function currentMatches(): IndexEntry[] {
  const query = normalize(searchInput.value.trim());
  return entries.filter((entry) => {
    if (activeFilter !== "tous" && entry.couche !== activeFilter) return false;
    return !query || normalize(entry.nom).includes(query);
  });
}

const MAX_RENDERED = 300;

function renderResults() {
  const matches = currentMatches();
  const shown = matches.slice(0, MAX_RENDERED);

  resultCount.textContent =
    matches.length === 0
      ? "Aucun résultat"
      : matches.length > shown.length
        ? `${formatNumber(matches.length)} résultats — ${shown.length} affichés`
        : `${formatNumber(matches.length)} résultat${matches.length > 1 ? "s" : ""}`;

  resultsList.replaceChildren(
    ...shown.map((entry) => {
      const li = document.createElement("li");
      li.className = "result";
      li.dataset.id = entry.id;
      li.dataset.couche = entry.couche;
      li.setAttribute("role", "option");
      li.tabIndex = 0;
      if (selected?.id === entry.id) li.classList.add("is-selected");

      const name = document.createElement("span");
      name.className = "result-name";
      name.textContent = entry.nom;

      const meta = document.createElement("span");
      meta.className = `result-meta couche-${entry.couche}`;
      meta.textContent = `${LAYER_LABELS[entry.couche]} · ${formatNumber(entry.valeur)} ${entry.unite}`;

      li.append(name, meta);
      return li;
    }),
  );
}

function onResultActivate(target: HTMLElement) {
  const li = target.closest<HTMLLIElement>("li.result");
  if (!li?.dataset.id) return;
  select(li.dataset.id, li.dataset.couche as LayerId, { zoom: true });
}

resultsList.addEventListener("click", (event) => onResultActivate(event.target as HTMLElement));
resultsList.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onResultActivate(event.target as HTMLElement);
  }
});

searchInput.addEventListener("input", renderResults);

document.getElementById("filters")!.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("button.chip");
  if (!btn) return;
  activeFilter = btn.dataset.couche as LayerId | "tous";
  document
    .querySelectorAll("#filters .chip")
    .forEach((chip) => chip.classList.toggle("is-active", chip === btn));
  renderResults();
});

document.getElementById("basemap-switch")!.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
  if (btn?.dataset.fond) setBasemap(btn.dataset.fond as BasemapId);
});

// --- Sélection et panneau d'info ---------------------------------------------
const infoPanel = document.getElementById("info-panel") as HTMLElement;
const infoKind = document.getElementById("info-kind") as HTMLElement;
const infoName = document.getElementById("info-name") as HTMLElement;
const infoAttrs = document.getElementById("info-attrs") as HTMLDListElement;
const infoZoom = document.getElementById("info-zoom") as HTMLButtonElement;

const ATTR_LABELS: Record<string, string> = {
  id: "Code Sandre",
  type: "Type",
  cd_bh: "Bassin hydrographique",
  exutoire: "Code exutoire",
  surface_km2: "Superficie",
  longueur_km: "Longueur",
  surface_ha: "Superficie",
  nature: "Nature",
  source: "Source",
};

const ATTR_UNITS: Record<string, string> = {
  surface_km2: " km²",
  longueur_km: " km",
  surface_ha: " ha",
};

function fillInfoPanel(couche: LayerId, props: Record<string, unknown>) {
  infoKind.textContent = LAYER_LABELS[couche];
  infoKind.className = `info-kind couche-${couche}`;
  infoName.textContent = (props.nom as string) || "Entité sans nom";

  infoAttrs.replaceChildren();
  for (const [key, label] of Object.entries(ATTR_LABELS)) {
    const value = props[key];
    if (value === undefined || value === null || value === "") continue;
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent =
      typeof value === "number"
        ? formatNumber(value) + (ATTR_UNITS[key] ?? "")
        : String(value);
    infoAttrs.append(dt, dd);
  }
  infoPanel.hidden = false;
}

function applySelectionFilters() {
  const id = selected?.id ?? "";
  const couche = selected?.couche;
  map.setFilter("select-bassin-fill", ["==", ["get", "id"], couche === "bassins" ? id : ""]);
  map.setFilter("select-bassin-line", ["==", ["get", "id"], couche === "bassins" ? id : ""]);
  map.setFilter("select-cours-eau", ["==", ["get", "id"], couche === "cours_eau" ? id : ""]);
  map.setFilter("select-plan-eau", ["==", ["get", "id"], couche === "plans_eau" ? id : ""]);
}

function zoomToSelection() {
  if (!selected) return;
  const bbox = bboxById.get(selected.id);
  if (!bbox) return;
  map.fitBounds(
    [
      [bbox[0], bbox[1]],
      [bbox[2], bbox[3]],
    ],
    { padding: 80, maxZoom: 13, duration: 900 },
  );
}

function select(
  id: string,
  couche: LayerId,
  options: { zoom?: boolean; props?: Record<string, unknown> } = {},
) {
  selected = { id, couche };
  applySelectionFilters();

  const props = options.props ?? entryProps(id, couche);
  if (props) fillInfoPanel(couche, props);
  infoZoom.hidden = !bboxById.has(id);

  if (options.zoom) zoomToSelection();

  resultsList.querySelectorAll("li.result").forEach((li) => {
    li.classList.toggle("is-selected", (li as HTMLLIElement).dataset.id === id);
  });
}

/** Attributs de repli quand la sélection vient de la barre latérale. */
function entryProps(id: string, couche: LayerId): Record<string, unknown> | null {
  const entry = entries.find((item) => item.id === id && item.couche === couche);
  if (!entry) return null;
  const key =
    couche === "bassins" ? "surface_km2" : couche === "cours_eau" ? "longueur_km" : "surface_ha";
  return { id: entry.id, nom: entry.nom, [key]: entry.valeur };
}

function clearSelection() {
  selected = null;
  applySelectionFilters();
  infoPanel.hidden = true;
  resultsList.querySelectorAll("li.result").forEach((li) => li.classList.remove("is-selected"));
}

document.getElementById("info-close")!.addEventListener("click", clearSelection);
infoZoom.addEventListener("click", zoomToSelection);

// --- Interactions carte -------------------------------------------------------
const CLICKABLE = ["cours-eau-line", "plans-eau-fill", "bassins-fill"];
const LAYER_OF: Record<string, LayerId> = {
  "cours-eau-line": "cours_eau",
  "plans-eau-fill": "plans_eau",
  "bassins-fill": "bassins",
};

map.on("click", (event) => {
  const features = map.queryRenderedFeatures(event.point, {
    layers: CLICKABLE.filter((id) => map.getLayer(id)),
  });
  // priorité aux entités les plus fines : rivière > plan d'eau > bassin
  const order = ["cours-eau-line", "plans-eau-fill", "bassins-fill"];
  const hit = order
    .map((layerId) => features.find((f) => f.layer.id === layerId))
    .find(Boolean);
  if (!hit) {
    clearSelection();
    return;
  }
  const couche = LAYER_OF[hit.layer.id];
  select(String(hit.properties.id), couche, {
    props: hit.properties as Record<string, unknown>,
  });
});

map.on("mousemove", "bassins-fill", (event) => {
  const feature = event.features?.[0];
  if (!feature) return;
  const id = String(feature.id ?? feature.properties?.id ?? "");
  if (hovered?.id === id) return;
  if (hovered) {
    map.setFeatureState({ source: "bassins", sourceLayer: "bassins", id: hovered.id }, { hover: false });
  }
  hovered = { id, couche: "bassins" };
  map.setFeatureState({ source: "bassins", sourceLayer: "bassins", id }, { hover: true });
  map.getCanvas().style.cursor = "pointer";
});

map.on("mouseleave", "bassins-fill", () => {
  if (hovered) {
    map.setFeatureState({ source: "bassins", sourceLayer: "bassins", id: hovered.id }, { hover: false });
  }
  hovered = null;
  map.getCanvas().style.cursor = "";
});

// --- Démarrage ----------------------------------------------------------------
async function start() {
  const response = await fetch(`${BASE}index.json`);
  const index: IndexFile = await response.json();
  entries = index.entites;
  for (const entry of entries) bboxById.set(entry.id, entry.bbox);

  document.getElementById("zone-stats")!.textContent =
    `${formatNumber(index.stats.bassins)} bassins · ` +
    `${formatNumber(index.stats.cours_eau)} cours d'eau · ` +
    `${formatNumber(index.stats.plans_eau)} plans d'eau`;

  renderResults();

  const [minx, miny, maxx, maxy] = index.zone.bbox;
  map.fitBounds(
    [
      [minx, miny],
      [maxx, maxy],
    ],
    { padding: 24, duration: 0 },
  );
}

map.on("load", () => {
  addDataLayers();
  start().catch((error) => {
    console.error(error);
    document.getElementById("zone-stats")!.textContent = "Erreur de chargement des données.";
  });
});
