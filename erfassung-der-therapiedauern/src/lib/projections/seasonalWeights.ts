import type { MonthlyAggregate, SeasonalWeights } from './types'

/**
 * ICU-spezifisches Fallback für die Monatsgewichte, wenn (noch) keine
 * historischen Daten vorliegen: Beatmungstage sind im Winter höher (Atemwegs-
 * infekte, RSV/Influenza) und im Sommer niedriger. Anteile am Jahr, Summe = 1.
 */
export const ICU_FALLBACK_WEIGHTS: readonly number[] = [
  0.11, // Jan
  0.1, // Feb
  0.09, // Mär
  0.08, // Apr
  0.07, // Mai
  0.06, // Jun
  0.06, // Jul
  0.06, // Aug
  0.07, // Sep
  0.09, // Okt
  0.1, // Nov
  0.11, // Dez
]

/**
 * Errechnet die Saison-Gewichte (Monatsverteilung) aus den historischen
 * Monatsaggregaten der Vorjahre. Gepoolt über alle Vorjahre: je Monat die Summe
 * der Beatmungstage geteilt durch die Gesamtsumme. So „lernt" das Modell mit
 * jedem abgeschlossenen Jahr automatisch dazu. Ohne Historie → ICU-Fallback.
 */
export function computeSeasonalWeights(
  history: MonthlyAggregate[],
  currentYear: number,
): SeasonalWeights {
  const pastYears = history.filter((a) => a.year < currentYear)
  const monthTotals = Array<number>(12).fill(0)
  let grandTotal = 0
  const years = new Set<number>()

  for (const a of pastYears) {
    if (a.month < 1 || a.month > 12) continue
    monthTotals[a.month - 1] += a.ventilationDays
    grandTotal += a.ventilationDays
    years.add(a.year)
  }

  if (grandTotal <= 0) {
    return { weights: [...ICU_FALLBACK_WEIGHTS], source: 'fallback', yearsUsed: 0 }
  }

  return {
    weights: monthTotals.map((total) => total / grandTotal),
    source: 'historical',
    yearsUsed: years.size,
  }
}
