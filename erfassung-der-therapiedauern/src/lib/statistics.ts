import type { TherapyRecord, TherapyType } from '../types'
import { VENTILATION_TYPE } from './therapyTypes'
import {
  daysInMonth,
  hasEnoughDataForProjection,
  projectionConfidence,
  projectYearEnd,
} from './projections/projections'
import type { MonthlyAggregate, ProjectionModel } from './projections/types'

/**
 * Jahresbezogene Statistik-Helfer (rein, unit-testbar). Alle Berechnungen laufen
 * clientseitig über die im Store vorhandenen Records — der Sync liefert bereits
 * alle Jahre.
 */

/** Kurzform der Monatsnamen (Index 0 = Januar). */
export const MONTH_SHORT = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
]

/** Absolute (nicht-kumulierte) aktive Tage je Monat (Index 1–12) einer Therapieart für ein Jahr. */
export function monthlyTherapyDays(
  records: TherapyRecord[],
  year: number,
  therapyType: TherapyType = VENTILATION_TYPE,
): number[] {
  const perMonth = Array<number>(13).fill(0)
  for (const r of records) {
    if (!r.date.startsWith(`${year}-`)) continue
    if (r.therapyType !== therapyType || !r.hours.some(Boolean)) continue
    perMonth[Number(r.date.slice(5, 7))] += 1
  }
  return perMonth
}

/** @deprecated Wrapper für Rückwärtskompatibilität — nutzt intern {@link monthlyTherapyDays}. */
export function monthlyVentilation(records: TherapyRecord[], year: number): number[] {
  return monthlyTherapyDays(records, year, VENTILATION_TYPE)
}

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
  /**
   * true, wenn eine Hochrechnung erfolgt — also laufendes Jahr UND genügend
   * Datenbasis (siehe {@link hasEnoughDataForProjection}).
   */
  isProjected: boolean
  /**
   * Konfidenz 0–1; 0, wenn nicht hochgerechnet wird. Nur als Verlässlichkeits-
   * hinweis gedacht, kein statistisches Konfidenzintervall.
   */
  confidence: number
  /**
   * true, wenn im laufenden Jahr allein die Datenbasis zu dünn ist (< 3 Monate).
   * Erlaubt der UI, das zu erklären statt kommentarlos nichts anzuzeigen.
   */
  insufficientData: boolean
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
  therapyType: TherapyType = VENTILATION_TYPE,
): YearProjection {
  const endMonth = isCurrentYear ? Number(todayIso.slice(5, 7)) : 12

  const perMonth = Array<number>(13).fill(0)
  for (const r of records) {
    if (!r.date.startsWith(`${year}-`)) continue
    if (isCurrentYear && r.date > todayIso) continue
    if (r.therapyType !== therapyType || !r.hours.some(Boolean)) continue
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
      confidence: 0,
      insufficientData: false,
      chart: Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        ist: cumulative[i + 1],
        prognose: null,
      })),
    }
  }

  // Laufendes Jahr, aber zu dünne Datenbasis: Ist-Kurve zeigen, NICHT hochrechnen.
  if (!hasEnoughDataForProjection(todayIso)) {
    return {
      ytd,
      yearEnd: ytd,
      isProjected: false,
      confidence: 0,
      insufficientData: true,
      chart: Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        ist: i + 1 <= endMonth ? cumulative[i + 1] : null,
        prognose: null,
      })),
    }
  }

  // Laufendes Jahr, aber (noch) keine einzige Ist-Beatmung: KEINE Prognose
  // zeichnen. Sonst erschiene eine gestrichelte 0-Linie über die Restmonate,
  // obwohl der Chart faktisch leer ist.
  if (ytd === 0) {
    return {
      ytd: 0,
      yearEnd: 0,
      isProjected: false,
      confidence: 0,
      insufficientData: false,
      chart: Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        ist: i + 1 <= endMonth ? cumulative[i + 1] : null,
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

  return {
    ytd,
    yearEnd,
    isProjected: true,
    confidence: projectionConfidence(todayIso, model),
    insufficientData: false,
    chart,
  }
}

/** Suffix für den Prognose-Key eines Jahres (z. B. "2026_Prognose"). */
export const FORECAST_SUFFIX = '_Prognose'

/** Ein Monatsobjekt für den YoY-Vergleich (flache Keys pro Jahr + Prognose). */
export type MonthlyComparisonPoint = Record<string, number | string | null>

/**
 * Baut 12 Monatsobjekte (Jan–Dez) mit den **nicht-kumulierten** absoluten
 * Beatmungstagen des gewählten Jahres UND aller Vorjahre als flache Keys
 * (z. B. `{ month: 'Jan', '2026': 17, '2025': 19, '2024': 29 }`).
 *
 * Ist `selectedYear` das laufende Jahr **und liegen bereits Ist-Beatmungen vor**,
 * werden für die **zukünftigen** Monate die isolierten prognostizierten
 * Monatswerte unter dem Key `"<jahr>_Prognose"` ergänzt (Restmenge bis zur
 * Jahresend-Prognose, verteilt nach den Monatsgewichten des gewählten Modells).
 * Ohne Ist-Daten wird KEIN Prognose-Key gesetzt (sonst erschiene eine flache
 * 0-Linie). Monate des laufenden Jahres ohne Ist-Daten bleiben `null`, damit
 * Overlay-Linien nicht auf 0 abfallen.
 */
export function buildMonthlyComparison(
  records: TherapyRecord[],
  selectedYear: number,
  years: number[],
  currentYear: number,
  todayIso: string,
  model: ProjectionModel,
  weights: number[],
  therapyType: TherapyType = VENTILATION_TYPE,
): MonthlyComparisonPoint[] {
  const currentMonth = Number(todayIso.slice(5, 7))
  const perYear = new Map<number, number[]>()
  for (const y of years) perYear.set(y, monthlyTherapyDays(records, y, therapyType))

  // Ohne ausreichende Datenbasis wird auch hier nicht hochgerechnet — sonst
  // erschiene im Chart eine Prognoselinie, die die Jahres-KPI gar nicht ausweist.
  const isCurrentSelected = selectedYear === currentYear && hasEnoughDataForProjection(todayIso)

  // Isolierte Monats-Prognose (nur laufendes, gewähltes Jahr, Zukunftsmonate).
  const forecast = Array<number | null>(13).fill(null)
  let hasForecast = false
  if (isCurrentSelected) {
    const actual = perYear.get(selectedYear) ?? Array<number>(13).fill(0)
    let ytd = 0
    for (let m = 1; m <= currentMonth; m++) ytd += actual[m]
    // Ohne bisherige Ist-Beatmung keine Prognoselinie zeichnen (bliebe sonst
    // flach auf 0 über die Restmonate).
    if (ytd > 0) {
      hasForecast = true
      const yearEnd = projectYearEnd(ytd, todayIso, model, weights)
      const remaining = Math.max(0, yearEnd - ytd)
      const monthWeight = (m: number) =>
        model === 'seasonal' ? weights[m - 1] : daysInMonth(selectedYear, m)
      let remainingSum = 0
      for (let m = currentMonth + 1; m <= 12; m++) remainingSum += monthWeight(m)
      for (let m = currentMonth + 1; m <= 12; m++) {
        forecast[m] = remainingSum > 0 ? Math.round((remaining * monthWeight(m)) / remainingSum) : 0
      }
    }
  }

  const result: MonthlyComparisonPoint[] = []
  for (let m = 1; m <= 12; m++) {
    const point: MonthlyComparisonPoint = { month: MONTH_SHORT[m - 1], monthIndex: m }
    for (const y of years) {
      // Zukunftsmonate des laufenden Jahres haben (noch) keine Ist-Daten → null.
      const isFutureOfCurrent = y === currentYear && m > currentMonth
      point[String(y)] = isFutureOfCurrent ? null : (perYear.get(y)?.[m] ?? 0)
    }
    if (hasForecast) point[`${selectedYear}${FORECAST_SUFFIX}`] = forecast[m]
    result.push(point)
  }
  return result
}
