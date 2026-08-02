import type { RasterSourceSpecification } from "maplibre-gl";

export type BasemapId = "plan" | "ortho" | "osm";

/** Fonds de plan libres, sans clé API : Géoplateforme IGN + OpenStreetMap. */
const IGN_WMTS = "https://data.geopf.fr/wmts";

function ignWmts(layer: string, format: string): string {
  const params = new URLSearchParams({
    SERVICE: "WMTS",
    REQUEST: "GetTile",
    VERSION: "1.0.0",
    LAYER: layer,
    STYLE: "normal",
    TILEMATRIXSET: "PM",
    FORMAT: format,
    TILEMATRIX: "{z}",
    TILEROW: "{y}",
    TILECOL: "{x}",
  });
  // les accolades des gabarits d'URL ne doivent pas rester encodées
  return `${IGN_WMTS}?${params.toString().replace(/%7B/g, "{").replace(/%7D/g, "}")}`;
}

export const BASEMAPS: Record<BasemapId, { label: string; source: RasterSourceSpecification }> = {
  plan: {
    label: "Plan IGN",
    source: {
      type: "raster",
      tiles: [ignWmts("GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2", "image/png")],
      tileSize: 256,
      maxzoom: 18,
      attribution: "&copy; IGN — Géoplateforme",
    },
  },
  ortho: {
    label: "Photo aérienne",
    source: {
      type: "raster",
      tiles: [ignWmts("ORTHOIMAGERY.ORTHOPHOTOS", "image/jpeg")],
      tileSize: 256,
      maxzoom: 19,
      attribution: "&copy; IGN — Géoplateforme",
    },
  },
  osm: {
    label: "OpenStreetMap",
    source: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "&copy; OpenStreetMap",
    },
  },
};
