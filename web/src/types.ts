export type LayerId = "bassins" | "cours_eau" | "plans_eau";

export interface IndexEntry {
  id: string;
  nom: string;
  couche: LayerId;
  /** Superficie (km²/ha) ou longueur (km) selon la couche. */
  valeur: number;
  unite: string;
  bbox: [number, number, number, number];
}

export interface IndexFile {
  zone: {
    nom: string;
    code_her1: number;
    bbox: [number, number, number, number];
  };
  stats: {
    bassins: number;
    cours_eau: number;
    plans_eau: number;
    surface_totale_km2: number;
  };
  entites: IndexEntry[];
}
