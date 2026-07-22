import type { TherapyRecord, TherapyType } from '../types'
import { THERAPY_TYPES, VENTILATION_TYPE } from './therapyTypes'

/**
 * Reiner Berechnungs-/Aggregations-Service für die klinische Auswertung.
 * Keine Seiteneffekte, keine Store-Abhängigkeit — vollständig unit-testbar.
 */

/** Regel 1: Therapiestunden = Anzahl markierter (true) Stunden im Array. */
export function therapyHours(record: TherapyRecord): number {
  return record.hours.reduce((sum, active) => (active ? sum + 1 : sum), 0)
}

/**
 * Regel 2: Ein „Beatmungstag" liegt vor, wenn die Therapieart Beatmung ist UND
 * an diesem Kalendertag mindestens eine Stunde markiert ist. Ein Record steht
 * für genau (Patient, Datum, Therapieart) — er zählt also als höchstens ein
 * Beatmungstag.
 */
export function isVentilationDay(record: TherapyRecord): boolean {
  return record.therapyType === VENTILATION_TYPE && record.hours.some(Boolean)
}

/** Summe aller Therapiestunden über die übergebenen Records. */
export function totalTherapyHours(records: TherapyRecord[]): number {
  return records.reduce((sum, r) => sum + therapyHours(r), 0)
}

/** Gesamtzahl der Beatmungstage (über alle Patienten/Tage). */
export function totalVentilationDays(records: TherapyRecord[]): number {
  return records.reduce((count, r) => (isVentilationDay(r) ? count + 1 : count), 0)
}

/** Beatmungstage im angegebenen Monat (`year`, `month` 1–12). */
export function ventilationDaysInMonth(
  records: TherapyRecord[],
  year: number,
  month: number,
): number {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`
  return records.reduce(
    (count, r) => (r.date.startsWith(prefix) && isVentilationDay(r) ? count + 1 : count),
    0,
  )
}

/** true, wenn für diese Therapieart mindestens eine Stunde erfasst ist. */
export function hasDataForType(records: TherapyRecord[], type: TherapyType): boolean {
  return records.some((r) => r.therapyType === type && r.hours.some(Boolean))
}

/** Ein Eintrag der Therapiearten-Verteilung. */
export interface TherapyTypeStat {
  type: TherapyType
  label: string
  /** Anzahl Tage mit mindestens einer markierten Stunde. */
  days: number
  /** Summe der Therapiestunden dieser Art. */
  hours: number
}

/**
 * Verteilung über die Therapiearten: je Art die Anzahl aktiver Tage (Records
 * mit ≥1 Stunde) und die Summe der Stunden. Reihenfolge folgt THERAPY_TYPES.
 */
export function therapyTypeDistribution(records: TherapyRecord[]): TherapyTypeStat[] {
  return THERAPY_TYPES.map((meta) => {
    const forType = records.filter((r) => r.therapyType === meta.type)
    return {
      type: meta.type,
      label: meta.label,
      days: forType.reduce((count, r) => (r.hours.some(Boolean) ? count + 1 : count), 0),
      hours: totalTherapyHours(forType),
    }
  })
}
