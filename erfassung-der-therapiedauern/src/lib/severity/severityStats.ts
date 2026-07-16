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
  /** Distinkte beatmete Patienten. */
  ventPatients: number
  /** Hämofiltrationstage (CRRT-Records mit ≥1 Stunde). */
  crrtDays: number
  /** ECMO-Tage (ILA/ECMO-Records mit ≥1 Stunde). */
  ecmoDays: number
}

function inMonth(dateStr: string, year: number, month: number): boolean {
  return dateStr.startsWith(`${year}-${String(month).padStart(2, '0')}-`)
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

  return {
    startedVentDays,
    completeVentDays: Math.floor(ventHours / 24),
    ventHours,
    ventPatients: ventPatients.size,
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
