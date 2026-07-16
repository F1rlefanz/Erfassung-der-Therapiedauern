import type { TherapyRecord } from '../types'
import { isVentilationDay } from './therapyCalculator'
import { daysInMonth, projectYearEnd } from './projections/projections'
import type { MonthlyAggregate, ProjectionModel } from './projections/types'

/**
 * Jahresbezogene Statistik-Helfer (rein, unit-testbar). Alle Berechnungen laufen
 * clientseitig über die im Store vorhandenen Records — der Sync liefert bereits
 * alle Jahre.
 */

/**
 * Ermittelt die auswählbaren Jahre: das aktuelle Jahr plus alle Jahre, für die
 * Records oder Aggregate vorliegen. Absteigend sortiert (neuestes zuerst).
 */
export function availableYears(
  records: TherapyRecord[],
  aggregates: MonthlyAggregate[],
  currentYear: number,
): number[] {
  const years = new Set<number>([currentYear])
  for (const r of records) {
    const y = Number(r.date.slice(0, 4))
    if (y) years.add(y)
  }
  for (const a of aggregates) years.add(a.year)
  return [...years].sort((a, b) => b - a)
}

/** Ein Punkt des kumulativen Jahres-Charts (Monat 1–12). */
export interface YearChartPoint {
  month: number
  /** Kumulierter Ist-Wert (null, wenn im laufenden Jahr noch nicht erreicht). */
  ist: number | null
  /** Kumulierte Prognose (null bei Vorjahren — keine Hochrechnung). */
  prognose: number | null
}

export interface YearProjection {
  ytd: number
  yearEnd: number
  /** true, wenn eine Hochrechnung erfolgt (nur laufendes Jahr). */
  isProjected: boolean
  chart: YearChartPoint[]
}

/**
 * Baut den kumulativen Beatmungstage-Verlauf eines Jahres.
 * - Laufendes Jahr: Ist bis zum aktuellen Monat + gestrichelte Prognose bis Dez.
 * - Abgeschlossenes Vorjahr: finaler Ist-Verlauf über alle 12 Monate, KEINE
 *   Prognose (statische Kurve).
 */
export function buildYearProjection(
  records: TherapyRecord[],
  year: number,
  isCurrentYear: boolean,
  todayIso: string,
  model: ProjectionModel,
  weights: number[],
): YearProjection {
  const endMonth = isCurrentYear ? Number(todayIso.slice(5, 7)) : 12

  const perMonth = Array<number>(13).fill(0)
  for (const r of records) {
    if (!r.date.startsWith(`${year}-`)) continue
    if (isCurrentYear && r.date > todayIso) continue
    if (!isVentilationDay(r)) continue
    perMonth[Number(r.date.slice(5, 7))] += 1
  }

  const cumulative = Array<number>(13).fill(0)
  for (let m = 1; m <= 12; m++) cumulative[m] = cumulative[m - 1] + perMonth[m]

  const ytd = cumulative[endMonth]

  // Vorjahr: statische Ist-Kurve, keine Prognose.
  if (!isCurrentYear) {
    return {
      ytd,
      yearEnd: cumulative[12],
      isProjected: false,
      chart: Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        ist: cumulative[i + 1],
        prognose: null,
      })),
    }
  }

  // Laufendes Jahr: Ist bis endMonth, danach gestrichelte Prognose.
  const yearEnd = projectYearEnd(ytd, todayIso, model, weights)
  const monthWeight = (m: number) => (model === 'seasonal' ? weights[m - 1] : daysInMonth(year, m))
  let remainingSum = 0
  for (let m = endMonth + 1; m <= 12; m++) remainingSum += monthWeight(m)

  const chart: YearChartPoint[] = []
  for (let m = 1; m <= 12; m++) {
    let prognose: number | null = null
    if (m === endMonth) {
      prognose = ytd
    } else if (m > endMonth) {
      let accum = 0
      for (let k = endMonth + 1; k <= m; k++) accum += monthWeight(k)
      prognose = remainingSum > 0 ? ytd + (yearEnd - ytd) * (accum / remainingSum) : yearEnd
    }
    chart.push({
      month: m,
      ist: m <= endMonth ? cumulative[m] : null,
      prognose: prognose === null ? null : Math.round(prognose * 10) / 10,
    })
  }

  return { ytd, yearEnd, isProjected: true, chart }
}
