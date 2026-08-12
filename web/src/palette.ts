/**
 * Palette catégorielle des fleuves principaux, calée sur le fond sombre.
 *
 * Les douze plus grands bassins récepteurs (rang `stem` 1 à 12, calculé par
 * `scripts/aggregate.py`) reçoivent une teinte propre ; tout le reste reste
 * dans un bleu neutre. L'ordre des teintes n'est pas cosmétique : il a été
 * retenu parmi des permutations validées avec le validateur de palette
 * (bande de clarté, plancher de chroma, séparation daltonisme, contraste sur
 * le fond `#1a1a19`). La pire paire adjacente reste dans la bande
 * d'avertissement daltonisme (ΔE 6,5) : la couleur n'est donc jamais le seul
 * canal d'identité — pastille + nom dans la liste, surbrillance au survol et
 * fiche nommée au clic.
 */
import type { ExpressionSpecification } from "maplibre-gl";

export const STEM_COLORS = [
  "#e66767", // 1  rouge
  "#199e70", // 2  aqua
  "#d95926", // 3  orange
  "#2aa3b0", // 4  cyan
  "#008300", // 5  vert
  "#c46ad6", // 6  pourpre
  "#c98500", // 7  jaune
  "#9085e9", // 8  violet
  "#7d9b28", // 9  lime
  "#d55181", // 10 magenta
  "#3987e5", // 11 bleu
  "#b5723a", // 12 brun
] as const;

/** Cours d'eau et bassins hors des douze premiers fleuves. */
export const NEUTRAL = "#5b7f9e";

/** Expression MapLibre : couleur d'une entité d'après son rang `stem`. */
export function stemColorExpression(fallback: string = NEUTRAL) {
  return [
    "match",
    ["coalesce", ["get", "stem"], 0],
    ...STEM_COLORS.flatMap((color, i) => [i + 1, color]),
    fallback,
  ] as unknown as ExpressionSpecification;
}

/** Couleur CSS d'une pastille de légende. */
export function stemColor(stem: number): string {
  return stem >= 1 && stem <= STEM_COLORS.length ? STEM_COLORS[stem - 1] : NEUTRAL;
}
