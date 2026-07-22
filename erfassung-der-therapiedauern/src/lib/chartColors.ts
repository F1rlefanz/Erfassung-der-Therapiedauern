/** Farbe + optionales Strichmuster für eine Vergleichsjahr-Linie im Chart. */
export interface ChartYearColor {
  stroke: string
  dash?: string
}

/**
 * Kategoriale Farbserie für Vergleichsjahre in Jahresvergleichs-Charts. Farbe
 * UND Strichmuster unterscheiden sich je Eintrag (Redundanz für
 * Farbfehlsichtige) — anders als die frühere Grau/Opacity-Abstufung, bei der
 * ab dem dritten Vorjahr kaum noch zu unterscheiden war.
 */
export const CHART_YEAR_COLORS: readonly ChartYearColor[] = [
  { stroke: 'var(--ui-chart-1)' },
  { stroke: 'var(--ui-chart-2)', dash: '5 3' },
  { stroke: 'var(--ui-chart-3)', dash: '2 2' },
  { stroke: 'var(--ui-chart-4)', dash: '7 3 2 3' },
]

/** Zyklische Zuordnung Index → Farbe/Stil (wrap bei mehr als 4 Vorjahren). */
export function overlayYearColor(index: number): ChartYearColor {
  return CHART_YEAR_COLORS[index % CHART_YEAR_COLORS.length]
}
