export type LayerId = "bassins" | "cours_eau" | "plans_eau";

export interface IndexEntry {
  id: string;
  nom: string;
  couche: LayerId;
  /** Superficie (km²/ha), ou longueur cumulée amont (km) pour les cours d'eau. */
  valeur: number;
  unite: string;
  bbox: [number, number, number, number];
}

export interface IndexFile {
  zone: {
    nom: string;
    bbox: [number, number, number, number];
  };
  stats: {
    bassins: number;
    cours_eau: number;
    plans_eau: number;
    fleuves: number;
    surface_totale_km2: number;
  };
  entites: IndexEntry[];
}

/** Fleuve principal : métriques du graphe + bassin agrégé. */
export interface Fleuve {
  id: string;
  nom: string;
  longueur_km: number;
  cum_amont_km: number;
  nb_affluents: number;
  nb_amont_total: number;
  nb_bassins: number;
  surface_km2: number;
  /** Rang de palette, 0 si le fleuve n'a pas de teinte propre. */
  stem: number;
  bbox: [number, number, number, number];
}

/** Fleuve récepteur portant une teinte propre sur la carte. */
export interface Stem {
  id: string;
  nom: string;
  /** Rang de palette, 1 à 12. */
  stem: number;
}
