import type { TherapyType } from '../../types'
import { VENTILATION_TYPE } from '../therapyTypes'
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
 * Neutraler Fallback (Gleichverteilung) für Therapiearten ohne klinisch
 * begründete Saisonkurve (CRRT, ILA/ECMO) — anders als Beatmung gibt es dafür
 * keine belastbare Winter/Sommer-Annahme. Bis der Chef ggf. eine begründete
 * Kurve vorgibt, bleibt es bei Gleichverteilung.
 */
export const NEUTRAL_FALLBACK_WEIGHTS: readonly number[] = Array<number>(12).fill(1 / 12)

/**
 * Errechnet die Saison-Gewichte (Monatsverteilung) aus den historischen
 * Monatsaggregaten der Vorjahre einer Therapieart. Gepoolt über alle Vorjahre:
 * je Monat die Summe der aktiven Tage geteilt durch die Gesamtsumme. So „lernt"
 * das Modell mit jedem abgeschlossenen Jahr automatisch dazu. Ohne Historie →
 * Fallback (ICU-Kurve für Beatmung, sonst Gleichverteilung).
 */
export function computeSeasonalWeights(
  history: MonthlyAggregate[],
  currentYear: number,
  therapyType: TherapyType = VENTILATION_TYPE,
): SeasonalWeights {
  const pastYears = history.filter((a) => a.year < currentYear && a.therapyType === therapyType)
  const monthTotals = Array<number>(12).fill(0)
  let grandTotal = 0
  const years = new Set<number>()

  for (const a of pastYears) {
    if (a.month < 1 || a.month > 12) continue
    monthTotals[a.month - 1] += a.days
    grandTotal += a.days
    years.add(a.year)
  }

  if (grandTotal <= 0) {
    const fallback = therapyType === VENTILATION_TYPE ? ICU_FALLBACK_WEIGHTS : NEUTRAL_FALLBACK_WEIGHTS
    return { weights: [...fallback], source: 'fallback', yearsUsed: 0 }
  }

  return {
    weights: monthTotals.map((total) => total / grandTotal),
    source: 'historical',
    yearsUsed: years.size,
  }
}
