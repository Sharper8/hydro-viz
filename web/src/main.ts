import maplibregl, { type ExpressionSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import { BASEMAPS, type BasemapId } from "./basemaps";
import { STEM_COLORS, NEUTRAL, stemColor, stemColorExpression } from "./palette";
import type { Fleuve, IndexFile, IndexEntry, LayerId, Stem } from "./types";

const BASE = import.meta.env.BASE_URL;

/** Le protocole `pmtiles://` permet à MapLibre de lire les archives en Range Requests. */
maplibregl.addProtocol("pmtiles", new Protocol().tile);

const LAYER_LABELS: Record<LayerId, string> = {
  bassins: "Bassin versant",
  cours_eau: "Cours d'eau",
  plans_eau: "Plan d'eau",
};

/**
 * Paliers du curseur d'importance, en km de longueur cumulée amont. L'échelle
 * est logarithmique : entre « toutes les rivières » et « le Rhône seul » il y a
 * quatre ordres de grandeur.
 */
const PALIERS = [0, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 15000];

/** Zoom où les bassins agrégés cèdent la place aux bassins versants de détail. */
const ZOOM_BASCULE = 7;

const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: { fond: BASEMAPS.sombre.source },
    layers: [{ id: "fond", type: "raster", source: "fond" }],
  },
  center: [2.6, 46.6],
  zoom: 5,
  maxZoom: 14,
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
let fleuves: Fleuve[] = [];
let stems: Stem[] = [];
const bboxById = new Map<string, [number, number, number, number]>();
let activeFilter: LayerId | "tous" = "tous";
let selected: { id: string; couche: LayerId } | null = null;
let selectedFleuve: Fleuve | null = null;
let hovered: string | null = null;
let currentBasemap: BasemapId = "sombre";
let ignFallbackDone = false;
let seuilImportance = 0;

const SOURCES = [
  "bassins",
  "cours_eau",
  "plans_eau",
  "bassins_hydro",
  "her1",
  "fleuves_bassins",
] as const;

// --- Couches de données -------------------------------------------------------
function addDataLayers() {
  for (const name of SOURCES) {
    map.addSource(name, {
      type: "vector",
      url: `pmtiles://${location.origin}${BASE}tiles/${name}.pmtiles`,
      // permet d'utiliser le survol via feature-state sur l'attribut `id`
      promoteId: "id",
    });
  }

  // Bassins versants : aplat teinté par fleuve récepteur — c'est la lecture
  // « qui va avec quoi » demandée.
  map.addLayer({
    id: "bassins-fill",
    type: "fill",
    source: "bassins",
    "source-layer": "bassins",
    minzoom: ZOOM_BASCULE,
    paint: {
      "fill-color": stemColorExpression(),
      "fill-opacity": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        0.55,
        0.22,
      ],
    },
  });

  map.addLayer({
    id: "bassins-line",
    type: "line",
    source: "bassins",
    "source-layer": "bassins",
    minzoom: ZOOM_BASCULE,
    paint: {
      "line-color": stemColorExpression("#7a8c99"),
      "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.3, 10, 0.8, 14, 1.4],
      "line-opacity": 0.5,
    },
  });

  // À l'échelle nationale, les 6 190 bassins versants (89 km² en moyenne) sont
  // illisibles : ce sont les bassins agrégés des fleuves qui portent la lecture
  // « qui va avec quoi », puis les BVT prennent le relais à partir de z7. Les
  // douze bassins teintés sont emboîtés dans aucun autre, ils ne se recouvrent
  // donc pas.
  map.addLayer({
    id: "fleuves-bassins-teinte",
    type: "fill",
    source: "fleuves_bassins",
    "source-layer": "fleuves_bassins",
    maxzoom: ZOOM_BASCULE,
    filter: [">", ["coalesce", ["get", "stem"], 0], 0],
    paint: { "fill-color": stemColorExpression(), "fill-opacity": 0.35 },
  });
  map.addLayer({
    id: "fleuves-bassins-contour",
    type: "line",
    source: "fleuves_bassins",
    "source-layer": "fleuves_bassins",
    maxzoom: ZOOM_BASCULE,
    filter: [">", ["coalesce", ["get", "stem"], 0], 0],
    paint: { "line-color": stemColorExpression(), "line-width": 1, "line-opacity": 0.8 },
  });

  // Bassin agrégé du fleuve sélectionné (union pré-calculée des BVT).
  map.addLayer({
    id: "fleuve-bassin-fill",
    type: "fill",
    source: "fleuves_bassins",
    "source-layer": "fleuves_bassins",
    filter: ["==", ["get", "id"], ""],
    paint: { "fill-color": "#f8fafc", "fill-opacity": 0.1 },
  });
  map.addLayer({
    id: "fleuve-bassin-line",
    type: "line",
    source: "fleuves_bassins",
    "source-layer": "fleuves_bassins",
    filter: ["==", ["get", "id"], ""],
    paint: { "line-color": "#f8fafc", "line-width": 2.5, "line-opacity": 0.95 },
  });

  map.addLayer({
    id: "select-bassin-fill",
    type: "fill",
    source: "bassins",
    "source-layer": "bassins",
    filter: ["==", ["get", "id"], ""],
    paint: { "fill-color": "#fbbf24", "fill-opacity": 0.3 },
  });
  map.addLayer({
    id: "select-bassin-line",
    type: "line",
    source: "bassins",
    "source-layer": "bassins",
    filter: ["==", ["get", "id"], ""],
    paint: { "line-color": "#fbbf24", "line-width": 2.5 },
  });

  map.addLayer({
    id: "plans-eau-fill",
    type: "fill",
    source: "plans_eau",
    "source-layer": "plans_eau",
    paint: { "fill-color": "#38bdf8", "fill-opacity": 0.7 },
  });
  map.addLayer({
    id: "select-plan-eau",
    type: "fill",
    source: "plans_eau",
    "source-layer": "plans_eau",
    filter: ["==", ["get", "id"], ""],
    paint: { "fill-color": "#fbbf24", "fill-opacity": 0.9 },
  });

  // Réseau hydrographique : couleur = fleuve récepteur, épaisseur = importance.
  map.addLayer({
    id: "cours-eau-line",
    type: "line",
    source: "cours_eau",
    "source-layer": "cours_eau",
    paint: {
      "line-color": stemColorExpression(),
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        4,
        largeurSelonImportance(0.4, 1.8),
        8,
        largeurSelonImportance(0.5, 3.2),
        12,
        largeurSelonImportance(1.0, 6),
      ],
      "line-opacity": 0.9,
    },
  });

  map.addLayer({
    id: "select-cours-eau",
    type: "line",
    source: "cours_eau",
    "source-layer": "cours_eau",
    filter: ["==", ["get", "id"], ""],
    paint: { "line-color": "#fbbf24", "line-width": 4, "line-opacity": 0.95 },
  });

  // Contours de référence : 7 grands bassins hydrographiques, 22 HER.
  map.addLayer({
    id: "bassins-hydro-line",
    type: "line",
    source: "bassins_hydro",
    "source-layer": "bassins_hydro",
    paint: {
      "line-color": "#e2e8f0",
      "line-width": 1.6,
      "line-opacity": 0.55,
      "line-dasharray": [4, 2],
    },
  });
  map.addLayer({
    id: "her1-line",
    type: "line",
    source: "her1",
    "source-layer": "her1",
    layout: { visibility: "none" },
    paint: {
      "line-color": "#c4b5fd",
      "line-width": 1,
      "line-opacity": 0.6,
      "line-dasharray": [2, 2],
    },
  });
}

/** Épaisseur d'un cours d'eau interpolée sur sa longueur cumulée amont (log). */
function largeurSelonImportance(min: number, max: number): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["log10", ["max", ["coalesce", ["get", "cum_amont_km"], 1], 1]],
    0,
    min,
    5,
    max,
  ] as unknown as ExpressionSpecification;
}

// --- Curseur d'importance ------------------------------------------------------
const slider = document.getElementById("importance") as HTMLInputElement;
const sliderValeur = document.getElementById("importance-valeur") as HTMLOutputElement;

function appliquerSeuil() {
  seuilImportance = PALIERS[Number(slider.value)];
  sliderValeur.textContent =
    seuilImportance === 0 ? "toutes" : `≥ ${formatNumber(seuilImportance)} km cumulés`;
  if (!map.getLayer("cours-eau-line")) return;
  const filtre: maplibregl.FilterSpecification | null =
    seuilImportance === 0
      ? null
      : [">=", ["coalesce", ["get", "cum_amont_km"], 0], seuilImportance];
  map.setFilter("cours-eau-line", filtre);
}

slider.addEventListener("input", appliquerSeuil);

// --- Fond de carte ------------------------------------------------------------
function setBasemap(id: BasemapId) {
  currentBasemap = id;
  if (map.getLayer("fond")) map.removeLayer("fond");
  if (map.getSource("fond")) map.removeSource("fond");
  map.addSource("fond", BASEMAPS[id].source);
  const first = map.getStyle().layers?.[0]?.id;
  map.addLayer({ id: "fond", type: "raster", source: "fond" }, first);

  // Sur un fond clair, les mêmes teintes doivent porter davantage.
  const clair = !BASEMAPS[id].sombre;
  if (map.getLayer("bassins-fill")) {
    map.setPaintProperty("bassins-fill", "fill-opacity", [
      "case",
      ["boolean", ["feature-state", "hover"], false],
      clair ? 0.45 : 0.55,
      clair ? 0.3 : 0.22,
    ]);
    map.setPaintProperty("bassins-line", "line-opacity", clair ? 0.75 : 0.5);
    map.setPaintProperty("bassins-hydro-line", "line-color", clair ? "#1e293b" : "#e2e8f0");
    map.setPaintProperty("fleuve-bassin-fill", "fill-color", clair ? "#0f172a" : "#f8fafc");
    map.setPaintProperty("fleuve-bassin-line", "line-color", clair ? "#0f172a" : "#f8fafc");
  }

  document.querySelectorAll<HTMLButtonElement>("#basemap-switch button").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.fond === id);
  });
}

// Si le service IGN ne répond pas, on bascule une fois sur OSM (aucune clé requise).
map.on("error", (event) => {
  const message = String((event as { error?: Error }).error?.message ?? "");
  if (ignFallbackDone || currentBasemap !== "plan") return;
  if (message.includes("data.geopf.fr") || message.includes("geopf")) {
    ignFallbackDone = true;
    console.warn("Fond IGN indisponible, bascule sur OpenStreetMap.");
    setBasemap("osm");
  }
});

// --- Onglets de la barre latérale ---------------------------------------------
document.getElementById("tabs")!.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("button.tab");
  if (!btn) return;
  const cible = btn.dataset.onglet;
  document
    .querySelectorAll("#tabs .tab")
    .forEach((tab) => tab.classList.toggle("is-active", tab === btn));
  document.getElementById("panneau-fleuves")!.hidden = cible !== "fleuves";
  document.getElementById("panneau-recherche")!.hidden = cible !== "recherche";
});

// --- Bascule des couches -------------------------------------------------------
const COUCHE_LAYERS: Record<string, string[]> = {
  bassins: ["fleuves-bassins-teinte", "fleuves-bassins-contour", "bassins-fill", "bassins-line"],
  plans_eau: ["plans-eau-fill"],
  bassins_hydro: ["bassins-hydro-line"],
  her1: ["her1-line"],
};

document.getElementById("couches")!.addEventListener("change", (event) => {
  const input = event.target as HTMLInputElement;
  const layers = COUCHE_LAYERS[input.dataset.couche ?? ""];
  if (!layers) return;
  for (const id of layers) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", input.checked ? "visible" : "none");
    }
  }
});

// --- Barre latérale : recherche -----------------------------------------------
const searchInput = document.getElementById("search") as HTMLInputElement;
const resultsList = document.getElementById("results") as HTMLUListElement;
const resultCount = document.getElementById("result-count") as HTMLParagraphElement;

/** Normalise pour une recherche insensible aux accents et à la casse. */
function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
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

// --- Liste des fleuves principaux ---------------------------------------------
const fleuvesList = document.getElementById("fleuves") as HTMLUListElement;

function renderFleuves() {
  fleuvesList.replaceChildren(
    ...fleuves.map((fleuve) => {
      const li = document.createElement("li");
      li.className = "fleuve";
      li.dataset.id = fleuve.id;
      li.setAttribute("role", "option");
      li.tabIndex = 0;
      if (selectedFleuve?.id === fleuve.id) li.classList.add("is-selected");

      const puce = document.createElement("span");
      puce.className = "puce";
      puce.style.background = stemColor(fleuve.stem);

      const name = document.createElement("span");
      name.className = "fleuve-nom";
      name.textContent = fleuve.nom;

      const meta = document.createElement("span");
      meta.className = "fleuve-meta";
      meta.textContent =
        `${formatNumber(Math.round(fleuve.cum_amont_km))} km cumulés · ` +
        `${formatNumber(Math.round(fleuve.surface_km2))} km²`;

      li.append(puce, name, meta);
      return li;
    }),
  );
}

function selectFleuve(id: string) {
  const fleuve = fleuves.find((f) => f.id === id);
  if (!fleuve) return;
  selectedFleuve = fleuve;
  clearSelection({ garderFleuve: true });

  map.setFilter("fleuve-bassin-fill", ["==", ["get", "id"], id]);
  map.setFilter("fleuve-bassin-line", ["==", ["get", "id"], id]);

  fleuvesList.querySelectorAll("li.fleuve").forEach((li) => {
    li.classList.toggle("is-selected", (li as HTMLLIElement).dataset.id === id);
  });

  infoKind.textContent = "Fleuve principal";
  infoKind.className = "info-kind couche-fleuve";
  infoName.textContent = fleuve.nom;
  fillAttrs([
    ["Longueur", `${formatNumber(fleuve.longueur_km)} km`],
    ["Réseau amont cumulé", `${formatNumber(Math.round(fleuve.cum_amont_km))} km`],
    ["Affluents directs", formatNumber(fleuve.nb_affluents)],
    ["Cours d'eau à l'amont", formatNumber(fleuve.nb_amont_total)],
    ["Bassin agrégé", `${formatNumber(Math.round(fleuve.surface_km2))} km²`],
    ["Bassins versants", formatNumber(fleuve.nb_bassins)],
    ["Code Sandre", fleuve.id],
  ]);
  infoPanel.hidden = false;
  infoZoom.hidden = false;

  map.fitBounds(
    [
      [fleuve.bbox[0], fleuve.bbox[1]],
      [fleuve.bbox[2], fleuve.bbox[3]],
    ],
    { padding: 60, maxZoom: 11, duration: 900 },
  );
}

fleuvesList.addEventListener("click", (event) => {
  const li = (event.target as HTMLElement).closest<HTMLLIElement>("li.fleuve");
  if (li?.dataset.id) selectFleuve(li.dataset.id);
});
fleuvesList.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  const li = (event.target as HTMLElement).closest<HTMLLIElement>("li.fleuve");
  if (li?.dataset.id) selectFleuve(li.dataset.id);
});

// --- Légende -------------------------------------------------------------------
function renderLegend() {
  const items = document.getElementById("legend-items") as HTMLUListElement;
  // `stems.json` recense exactement les teintes présentes sur la carte — s'y
  // fier évite qu'une couleur apparaisse sans entrée de légende.
  const teintes = [...stems].sort((a, b) => a.stem - b.stem).slice(0, STEM_COLORS.length);

  items.replaceChildren(
    ...teintes.map((entree) => {
      const li = document.createElement("li");
      const puce = document.createElement("span");
      puce.className = "puce";
      puce.style.background = stemColor(entree.stem);
      li.append(puce, document.createTextNode(entree.nom));
      return li;
    }),
  );

  const autres = document.createElement("li");
  const puce = document.createElement("span");
  puce.className = "puce";
  puce.style.background = NEUTRAL;
  autres.append(puce, document.createTextNode("Autres bassins"));
  items.append(autres);
}

// --- Sélection et panneau d'info ---------------------------------------------
const infoPanel = document.getElementById("info-panel") as HTMLElement;
const infoKind = document.getElementById("info-kind") as HTMLElement;
const infoName = document.getElementById("info-name") as HTMLElement;
const infoAttrs = document.getElementById("info-attrs") as HTMLDListElement;
const infoZoom = document.getElementById("info-zoom") as HTMLButtonElement;

const ATTR_LABELS: Record<string, string> = {
  id: "Code Sandre",
  cd_bh: "Grand bassin",
  fleuve: "Se jette dans",
  cum_amont_km: "Réseau amont cumulé",
  nb_affluents: "Affluents directs",
  nb_amont: "Cours d'eau à l'amont",
  longueur_km: "Longueur",
  surface_km2: "Superficie",
  surface_ha: "Superficie",
  nature: "Nature",
};

const ATTR_UNITS: Record<string, string> = {
  surface_km2: " km²",
  longueur_km: " km",
  cum_amont_km: " km",
  surface_ha: " ha",
};

function fillAttrs(pairs: [string, string][]) {
  infoAttrs.replaceChildren();
  for (const [label, value] of pairs) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    infoAttrs.append(dt, dd);
  }
}

function fillInfoPanel(couche: LayerId, props: Record<string, unknown>) {
  infoKind.textContent = LAYER_LABELS[couche];
  infoKind.className = `info-kind couche-${couche}`;
  infoName.textContent = (props.nom as string) || "Entité sans nom";

  fillAttrs(
    Object.entries(ATTR_LABELS)
      .filter(([key]) => {
        const value = props[key];
        return value !== undefined && value !== null && value !== "";
      })
      .map(([key, label]) => {
        const value = props[key];
        return [
          label,
          typeof value === "number"
            ? formatNumber(value) + (ATTR_UNITS[key] ?? "")
            : String(value),
        ];
      }),
  );
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
  if (selectedFleuve && !selected) {
    const b = selectedFleuve.bbox;
    map.fitBounds(
      [
        [b[0], b[1]],
        [b[2], b[3]],
      ],
      { padding: 60, maxZoom: 11, duration: 900 },
    );
    return;
  }
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
    couche === "bassins" ? "surface_km2" : couche === "cours_eau" ? "cum_amont_km" : "surface_ha";
  return { id: entry.id, nom: entry.nom, [key]: entry.valeur };
}

function clearSelection(options: { garderFleuve?: boolean } = {}) {
  selected = null;
  applySelectionFilters();
  if (!options.garderFleuve) {
    selectedFleuve = null;
    map.setFilter("fleuve-bassin-fill", ["==", ["get", "id"], ""]);
    map.setFilter("fleuve-bassin-line", ["==", ["get", "id"], ""]);
    fleuvesList.querySelectorAll("li.fleuve").forEach((li) => li.classList.remove("is-selected"));
    infoPanel.hidden = true;
  }
  resultsList.querySelectorAll("li.result").forEach((li) => li.classList.remove("is-selected"));
}

document.getElementById("info-close")!.addEventListener("click", () => clearSelection());
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
  const hit = CLICKABLE.map((layerId) => features.find((f) => f.layer.id === layerId)).find(
    Boolean,
  );
  if (!hit) {
    clearSelection();
    return;
  }
  select(String(hit.properties.id), LAYER_OF[hit.layer.id], {
    props: hit.properties as Record<string, unknown>,
  });
});

map.on("mousemove", "bassins-fill", (event) => {
  const feature = event.features?.[0];
  if (!feature) return;
  const id = String(feature.id ?? feature.properties?.id ?? "");
  if (hovered === id) return;
  if (hovered) {
    map.setFeatureState({ source: "bassins", sourceLayer: "bassins", id: hovered }, { hover: false });
  }
  hovered = id;
  map.setFeatureState({ source: "bassins", sourceLayer: "bassins", id }, { hover: true });
  map.getCanvas().style.cursor = "pointer";
});

map.on("mouseleave", "bassins-fill", () => {
  if (hovered) {
    map.setFeatureState({ source: "bassins", sourceLayer: "bassins", id: hovered }, { hover: false });
  }
  hovered = null;
  map.getCanvas().style.cursor = "";
});

// --- Démarrage ----------------------------------------------------------------
async function start() {
  const [index, fleuvesData, stemsData] = await Promise.all([
    fetch(`${BASE}index.json`).then((r) => r.json() as Promise<IndexFile>),
    fetch(`${BASE}fleuves.json`).then((r) => r.json() as Promise<Fleuve[]>),
    fetch(`${BASE}stems.json`).then((r) => r.json() as Promise<Stem[]>),
  ]);

  entries = index.entites;
  fleuves = fleuvesData;
  stems = stemsData;
  for (const entry of entries) bboxById.set(entry.id, entry.bbox);

  document.getElementById("zone-stats")!.textContent =
    `${formatNumber(index.stats.bassins)} bassins · ` +
    `${formatNumber(index.stats.cours_eau)} cours d'eau · ` +
    `${formatNumber(index.stats.plans_eau)} plans d'eau`;

  renderFleuves();
  renderLegend();
  renderResults();
  appliquerSeuil();

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
