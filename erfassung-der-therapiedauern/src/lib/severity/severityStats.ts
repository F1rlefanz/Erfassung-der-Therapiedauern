import type { TherapyRecord } from '../../types'
import { therapyHours } from '../therapyCalculator'

/**
 * Berechnete ICU-Kennzahlen (aus den TherapyRecords = Intensivstation 10).
 * Rein/deterministisch, unit-testbar. Die IMC-Station hat keine berechneten
 * Therapie-Spalten (nur manuelle Fälle/TISS).
 */
export interface IcuCalculated {
  /** Begonnene Beatmungstage = Beatmungs-Records mit ≥1 Stunde im Monat. */
  startedVentDays: number
  /** Ganze Beatmungstage = ⌊Beatmungsstunden / 24⌋. */
  completeVentDays: number
  /** Beatmungsstunden total. */
  ventHours: number
  /**
   * Beatmungspatienten = **im Monat neu begonnene** Fälle. Patienten, die schon
   * im Vormonat beatmet wurden, zählen hier NICHT mit (siehe
   * {@link continuedVentPatients}) — ein Langlieger soll nicht Monat für Monat
   * erneut als Fall erscheinen. Entspricht `uniqueCases` der Legacy-Anwendung.
   */
  ventPatients: number
  /**
   * Aus dem Vormonat fortgeführte Beatmungspatienten (Legacy:
   * `continuedFromPreviousMonth`). Ihre Beatmungstage/-stunden zählen weiterhin
   * voll mit — nur als *Fall* werden sie dem Vormonat zugerechnet.
   */
  continuedVentPatients: number
  /** Hämofiltrationstage (CRRT-Records mit ≥1 Stunde). */
  crrtDays: number
  /** ECMO-Tage (ILA/ECMO-Records mit ≥1 Stunde). */
  ecmoDays: number
}

function inMonth(dateStr: string, year: number, month: number): boolean {
  return dateStr.startsWith(`${year}-${String(month).padStart(2, '0')}-`)
}

/** Vormonat inkl. Jahreswechsel (Januar → Dezember des Vorjahres). */
export function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

/**
 * Patienten, die im angegebenen Monat beatmet wurden (≥1 Stunde). Basis für die
 * Unterscheidung neu/fortgeführt.
 */
function ventilatedPatientsIn(
  records: TherapyRecord[],
  year: number,
  month: number,
): Set<string> {
  const set = new Set<string>()
  for (const r of records) {
    if (r.therapyType !== 'beatmung') continue
    if (!inMonth(r.date, year, month)) continue
    if (!r.hours.some(Boolean)) continue
    set.add(r.patientId)
  }
  return set
}

export function computeIcuMonthly(
  records: TherapyRecord[],
  year: number,
  month: number,
): IcuCalculated {
  let ventHours = 0
  let startedVentDays = 0
  let crrtDays = 0
  let ecmoDays = 0
  const ventPatients = new Set<string>()

  for (const r of records) {
    if (!inMonth(r.date, year, month)) continue
    if (!r.hours.some(Boolean)) continue
    if (r.therapyType === 'beatmung') {
      startedVentDays += 1
      ventHours += therapyHours(r)
      ventPatients.add(r.patientId)
    } else if (r.therapyType === 'crrt') {
      crrtDays += 1
    } else if (r.therapyType === 'ila_ecmo') {
      ecmoDays += 1
    }
  }

  // Fälle, die schon im Vormonat beatmet wurden, gelten als fortgeführt und
  // nicht als neuer Fall dieses Monats (Re-Intubation innerhalb desselben Falls
  // ist kein neuer Fall). Tage und Stunden bleiben davon unberührt.
  const prev = previousMonth(year, month)
  const previouslyVentilated = ventilatedPatientsIn(records, prev.year, prev.month)

  let newCases = 0
  let continued = 0
  for (const patientId of ventPatients) {
    if (previouslyVentilated.has(patientId)) continued += 1
    else newCases += 1
  }

  return {
    startedVentDays,
    completeVentDays: Math.floor(ventHours / 24),
    ventHours,
    ventPatients: newCases,
    continuedVentPatients: continued,
    crrtDays,
    ecmoDays,
  }
}

// ---- Abgeleitete Kennzahlen (berechnet aus Werten + manuellen Eingaben) ----

/** Anteil beatmeter Patienten an den Fällen (%). */
export function ventPercentage(ventPatients: number, cases: number): number {
  return cases > 0 ? (ventPatients / cases) * 100 : 0
}

/** Ø Beatmungsdauer = begonnene Beatmungstage je beatmetem Patienten. */
export function avgVentDuration(startedVentDays: number, ventPatients: number): number {
  return ventPatients > 0 ? startedVentDays / ventPatients : 0
}

/** TISS-28 pro Fall. */
export function tissPerCase(tissPoints: number, cases: number): number {
  return cases > 0 ? tissPoints / cases : 0
}

// ---- Zeilen-Builder (kombiniert berechnete + manuelle Werte) ----

export interface IcuRow extends IcuCalculated {
  month: number
  cases: number
  tissPoints: number
  ventPercentage: number
  avgVentDuration: number
  tissPerCase: number
}

export function buildIcuRow(
  records: TherapyRecord[],
  year: number,
  month: number,
  cases: number,
  tissPoints: number,
): IcuRow {
  const calc = computeIcuMonthly(records, year, month)
  return {
    month,
    ...calc,
    cases,
    tissPoints,
    ventPercentage: ventPercentage(calc.ventPatients, cases),
    avgVentDuration: avgVentDuration(calc.startedVentDays, calc.ventPatients),
    tissPerCase: tissPerCase(tissPoints, cases),
  }
}

export interface ImcRow {
  month: number
  cases: number
  tissPoints: number
  tissPerCase: number
}

export function buildImcRow(month: number, cases: number, tissPoints: number): ImcRow {
  return { month, cases, tissPoints, tissPerCase: tissPerCase(tissPoints, cases) }
}
