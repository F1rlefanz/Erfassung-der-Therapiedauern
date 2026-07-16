import type { Patient, TherapyRecord } from '../../types'
import { isVentilationDay, therapyHours } from '../therapyCalculator'

/** Eine aggregierte Report-Zeile pro Patient für ein Jahr. */
export interface PatientYearRow {
  patientId: string
  /** Pseudonym/Anzeigename des Patienten. */
  name: string
  caseNumber: string
  /** Beatmungstage (Beatmungs-Records mit ≥1 Stunde). */
  ventilationDays: number
  /** Therapiestunden gesamt (alle Therapiearten). */
  totalHours: number
  /** Davon CRRT-Stunden. */
  crrtHours: number
  /** Davon iLA/ECMO-Stunden. */
  ilaEcmoHours: number
}

/**
 * Aggregiert je Patient die Kennzahlen für das gewählte Jahr. Nur Patienten mit
 * mindestens einem Record im Jahr werden aufgenommen. Sortiert nach
 * Beatmungstagen (absteigend), dann Name.
 */
export function buildPatientYearRows(
  patients: Patient[],
  records: TherapyRecord[],
  year: number,
): PatientYearRow[] {
  const yearRecords = records.filter((r) => r.date.startsWith(`${year}-`))

  const rows: PatientYearRow[] = []
  for (const patient of patients) {
    const patientRecords = yearRecords.filter((r) => r.patientId === patient.id)
    if (patientRecords.length === 0) continue

    let totalHours = 0
    let crrtHours = 0
    let ilaEcmoHours = 0
    let ventilationDays = 0
    for (const record of patientRecords) {
      const hours = therapyHours(record)
      totalHours += hours
      if (record.therapyType === 'crrt') crrtHours += hours
      else if (record.therapyType === 'ila_ecmo') ilaEcmoHours += hours
      if (isVentilationDay(record)) ventilationDays += 1
    }

    rows.push({
      patientId: patient.id,
      name: patient.name,
      caseNumber: patient.caseNumber,
      ventilationDays,
      totalHours,
      crrtHours,
      ilaEcmoHours,
    })
  }

  rows.sort((a, b) => b.ventilationDays - a.ventilationDays || a.name.localeCompare(b.name))
  return rows
}

/** Summiert alle Zeilen zu einer Gesamtzeile (für Tabellen-Footer/CSV). */
export function sumPatientYearRows(rows: PatientYearRow[]): Omit<PatientYearRow, 'patientId' | 'name' | 'caseNumber'> {
  return rows.reduce(
    (acc, r) => ({
      ventilationDays: acc.ventilationDays + r.ventilationDays,
      totalHours: acc.totalHours + r.totalHours,
      crrtHours: acc.crrtHours + r.crrtHours,
      ilaEcmoHours: acc.ilaEcmoHours + r.ilaEcmoHours,
    }),
    { ventilationDays: 0, totalHours: 0, crrtHours: 0, ilaEcmoHours: 0 },
  )
}
