import type { RasterSourceSpecification } from "maplibre-gl";

export type BasemapId = "sombre" | "plan" | "ortho" | "osm";

/** Fonds de plan libres, sans clé API : CARTO, Géoplateforme IGN, OpenStreetMap. */
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

export const BASEMAPS: Record<
  BasemapId,
  { label: string; sombre: boolean; source: RasterSourceSpecification }
> = {
  sombre: {
    label: "Sombre",
    sombre: true,
    source: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      maxzoom: 18,
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    },
  },
  plan: {
    label: "Plan IGN",
    sombre: false,
    source: {
      type: "raster",
      tiles: [ignWmts("GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2", "image/png")],
      tileSize: 256,
      maxzoom: 18,
      attribution: "&copy; IGN — Géoplateforme",
    },
  },
  ortho: {
    label: "Photo",
    sombre: true,
    source: {
      type: "raster",
      tiles: [ignWmts("ORTHOIMAGERY.ORTHOPHOTOS", "image/jpeg")],
      tileSize: 256,
      maxzoom: 19,
      attribution: "&copy; IGN — Géoplateforme",
    },
  },
  osm: {
    label: "OSM",
    sombre: false,
    source: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "&copy; OpenStreetMap",
    },
  },
};
