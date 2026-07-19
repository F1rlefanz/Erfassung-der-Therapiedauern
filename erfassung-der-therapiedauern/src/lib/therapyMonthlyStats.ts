import type { TherapyRecord, TherapyType } from '../types'
import { therapyHours } from './therapyCalculator'

/**
 * Monatsstatistik je Therapieart — Nachbau der Legacy-Tabelle
 * („Stunden | Begonnene Tage | Ganze Tage | Einzigartige Fälle | Tage pro Fall").
 *
 * Die Fall-Zählung folgt derselben Regel wie die Schweregradstatistik: Ein Fall,
 * der bereits im Vormonat mit dieser Therapieart erfasst war, gilt als
 * fortgeführt und nicht als neuer Fall des Monats.
 */

export interface TherapyMonthRow {
  /** Monat 1–12. */
  month: number
  /** Summe der erfassten Stunden. */
  hours: number
  /** Tage mit ≥1 erfasster Stunde. */
  startedDays: number
  /** Ganze Tage = ⌊Stunden / 24⌋. */
  completeDays: number
  /** Im Monat NEU begonnene Fälle. */
  newCases: number
  /** Aus dem Vormonat fortgeführte Fälle. */
  continuedCases: number
  /** Begonnene Tage je neuem Fall (Legacy: startedDays / uniqueCases). */
  daysPerCase: number
}

function inMonth(dateStr: string, year: number, month: number): boolean {
  return dateStr.startsWith(`${year}-${String(month).padStart(2, '0')}-`)
}

function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

/** Patienten mit ≥1 Stunde dieser Therapieart im Monat. */
function patientsIn(
  records: TherapyRecord[],
  therapyType: TherapyType,
  year: number,
  month: number,
): Set<string> {
  const set = new Set<string>()
  for (const r of records) {
    if (r.therapyType !== therapyType) continue
    if (!inMonth(r.date, year, month)) continue
    if (!r.hours.some(Boolean)) continue
    set.add(r.patientId)
  }
  return set
}

export function buildTherapyMonthRow(
  records: TherapyRecord[],
  therapyType: TherapyType,
  year: number,
  month: number,
): TherapyMonthRow {
  let hours = 0
  let startedDays = 0

  for (const r of records) {
    if (r.therapyType !== therapyType) continue
    if (!inMonth(r.date, year, month)) continue
    if (!r.hours.some(Boolean)) continue
    startedDays += 1
    hours += therapyHours(r)
  }

  const current = patientsIn(records, therapyType, year, month)
  const prev = previousMonth(year, month)
  const previously = patientsIn(records, therapyType, prev.year, prev.month)

  let newCases = 0
  let continuedCases = 0
  for (const patientId of current) {
    if (previously.has(patientId)) continuedCases += 1
    else newCases += 1
  }

  return {
    month,
    hours,
    startedDays,
    completeDays: Math.floor(hours / 24),
    newCases,
    continuedCases,
    daysPerCase: newCases > 0 ? startedDays / newCases : 0,
  }
}

/** Alle zwölf Monatszeilen eines Jahres für eine Therapieart. */
export function buildTherapyYear(
  records: TherapyRecord[],
  therapyType: TherapyType,
  year: number,
): TherapyMonthRow[] {
  return Array.from({ length: 12 }, (_, i) => buildTherapyMonthRow(records, therapyType, year, i + 1))
}

/**
 * Fußzeilen der Tabelle. Die beiden `daysPerCase`-Werte rechnen bewusst
 * UNTERSCHIEDLICH — so war es in der Legacy-Anwendung, und die Unterscheidung
 * ist fachlich gewollt:
 *
 * - `total.daysPerCase`  = begonnene Tage ÷ **neue** Fälle
 * - `yearDaysPerCase`    = begonnene Tage ÷ (**neue + fortgeführte**) Fälle
 *
 * Beide werden in der Tabelle getrennt beschriftet, damit die Differenz sichtbar
 * und nicht als Fehler missverstanden wird.
 */
export interface TherapyYearTotals {
  hours: number
  startedDays: number
  completeDays: number
  newCases: number
  continuedCases: number
  /** Begonnene Tage ÷ neue Fälle (Legacy-Gesamtzeile). */
  daysPerCase: number
  /** Begonnene Tage ÷ (neue + fortgeführte) Fälle (Legacy-Durchschnittszeile). */
  daysPerCaseAllCases: number
}

export function sumTherapyYear(rows: TherapyMonthRow[]): TherapyYearTotals {
  const t = rows.reduce(
    (a, r) => ({
      hours: a.hours + r.hours,
      startedDays: a.startedDays + r.startedDays,
      completeDays: a.completeDays + r.completeDays,
      newCases: a.newCases + r.newCases,
      continuedCases: a.continuedCases + r.continuedCases,
    }),
    { hours: 0, startedDays: 0, completeDays: 0, newCases: 0, continuedCases: 0 },
  )

  const allCases = t.newCases + t.continuedCases
  return {
    ...t,
    daysPerCase: t.newCases > 0 ? t.startedDays / t.newCases : 0,
    daysPerCaseAllCases: allCases > 0 ? t.startedDays / allCases : 0,
  }
}

/**
 * Monatsdurchschnitt. `divisor` ist bewusst explizit: Die Legacy-Anwendung teilt
 * immer durch 12 — auch mitten im Jahr, was den laufenden Jahresschnitt zu
 * niedrig ausweist. Die Tabelle zeigt darum im laufenden Jahr zusätzlich den
 * Schnitt über die verstrichenen Monate.
 */
export function averagePerMonth(totals: TherapyYearTotals, divisor: number) {
  const d = divisor > 0 ? divisor : 1
  return {
    hours: totals.hours / d,
    startedDays: totals.startedDays / d,
    completeDays: totals.completeDays / d,
    newCases: totals.newCases / d,
    continuedCases: totals.continuedCases / d,
  }
}
