import type { ProjectionModel } from './types'

/**
 * Reine Prognose-Mathematik (keine Seiteneffekte, keine Store-Abhängigkeit).
 * Alle Funktionen erhalten das Bezugsdatum explizit als YYYY-MM-DD → vollständig
 * deterministisch und unit-testbar.
 */

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29
  return DAYS_IN_MONTH[month - 1]
}

/** Tag im Jahr (1 = 1. Januar). */
export function dayOfYear(year: number, month: number, day: number): number {
  let total = day
  for (let m = 1; m < month; m++) total += daysInMonth(year, m)
  return total
}

interface RefDate {
  year: number
  month: number
  day: number
}

function parseRef(isoDate: string): RefDate {
  const [year, month, day] = isoDate.split('-').map(Number)
  return { year, month, day }
}

/**
 * Modell A — Lineare Hochrechnung: (Wert_YTD / verstrichene Tage) * Tage im Jahr.
 * Nur als Baseline/Vergleich gedacht.
 */
export function linearProjection(valueYTD: number, refIso: string): number {
  const { year, month, day } = parseRef(refIso)
  const elapsedDays = dayOfYear(year, month, day)
  if (elapsedDays <= 0) return 0
  return (valueYTD / elapsedDays) * daysInYear(year)
}

/**
 * Anteil des Jahres, der laut Saison-Gewichten bis zum Bezugsdatum „verstrichen"
 * ist: volle vergangene Monate plus den aktuellen Monat anteilig (Tag/Monatstage).
 */
export function elapsedSeasonalFraction(weights: number[], refIso: string): number {
  const { year, month, day } = parseRef(refIso)
  let fraction = 0
  for (let m = 1; m < month; m++) fraction += weights[m - 1] ?? 0
  fraction += (weights[month - 1] ?? 0) * (day / daysInMonth(year, month))
  return fraction
}

/**
 * Modell B — Dynamische saisonale Hochrechnung (Standard):
 * Prognose = Wert_YTD / (Summe der Gewichte der verstrichenen Monatsanteile).
 * Über-/unterrepräsentierte Saisons werden korrekt herausgerechnet.
 */
export function seasonalProjection(
  valueYTD: number,
  refIso: string,
  weights: number[],
): number {
  const fraction = elapsedSeasonalFraction(weights, refIso)
  if (fraction <= 0) return 0
  return valueYTD / fraction
}

/**
 * Mindestanzahl verstrichener Monate, bevor überhaupt hochgerechnet wird.
 * Aus wenigen Tagen eine Jahresprognose abzuleiten wäre irreführend — die
 * Legacy-Anwendung hatte dieselbe Schwelle (`minMonths = 3`).
 */
export const MIN_MONTHS_FOR_PROJECTION = 3

/**
 * Ob genügend Datenbasis für eine Hochrechnung vorliegt. Maßgeblich ist der
 * laufende Monat des Bezugsdatums (im März → 3 verstrichene Monate).
 */
export function hasEnoughDataForProjection(
  refIso: string,
  minMonths: number = MIN_MONTHS_FOR_PROJECTION,
): boolean {
  return parseRef(refIso).month >= minMonths
}

/**
 * Konfidenz der Hochrechnung zwischen 0 und 1 (Legacy-Formel): Je mehr Monate
 * vorliegen, desto verlässlicher — gedeckelt bei 0,8 —, multipliziert mit einem
 * modellabhängigen Faktor. Das saisonale Modell rechnet Saisoneffekte heraus und
 * ist daher höher gewichtet als die reine Lineare.
 */
export function projectionConfidence(refIso: string, model: ProjectionModel): number {
  const monthConfidence = Math.min(parseRef(refIso).month / 12, 0.8)
  const modelConfidence = model === 'seasonal' ? 0.8 : 0.7
  return monthConfidence * modelConfidence
}

/** Wählt das Prognose-Modell und liefert die Jahresend-Prognose. */
export function projectYearEnd(
  valueYTD: number,
  refIso: string,
  model: ProjectionModel,
  weights: number[],
): number {
  return model === 'seasonal'
    ? seasonalProjection(valueYTD, refIso, weights)
    : linearProjection(valueYTD, refIso)
}
