/** Station der Schweregradstatistik. */
export type SeverityUnit = 'ICU' | 'IMC'

/**
 * Manuell erfasste Kennzahlen je (Jahr, Monat, Station): Fallbuch-Fälle und
 * TISS-28-Punkte. Werden im On-Premise-Setup persistiert und synchronisiert
 * (analog zu den TherapyRecords).
 */
export interface SeverityStat {
  /** `${year}__${month}__${unit}` — deterministisch, konfliktfreier Sync-Key. */
  id: string
  year: number
  /** Monat 1–12. */
  month: number
  unit: SeverityUnit
  cases: number
  tissPoints: number
}

/** Deterministische ID für einen (Jahr, Monat, Station)-Eintrag. */
export function severityId(year: number, month: number, unit: SeverityUnit): string {
  return `${year}__${month}__${unit}`
}
