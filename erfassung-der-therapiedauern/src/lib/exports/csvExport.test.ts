import { describe, expect, it } from 'vitest'
import type { Patient, TherapyRecord, TherapyType } from '../../types'
import { buildPatientYearRows } from './reportRows'
import { buildCsv } from './csvExport'

function patient(id: string, name: string, caseNumber: string): Patient {
  return { id, name, caseNumber }
}

/** Record mit `count` aktiven Stunden. */
function rec(patientId: string, date: string, therapyType: TherapyType, count: number): TherapyRecord {
  const hours = Array<boolean>(24).fill(false)
  for (let i = 0; i < count; i++) hours[i] = true
  return { id: `${patientId}__${date}__${therapyType}`, patientId, date, therapyType, hours, lastUpdatedAt: `${date}T12:00:00.000Z` }
}

describe('buildPatientYearRows', () => {
  const patients = [patient('p1', 'Patient 1', '900001'), patient('p2', 'Patient 2', '900002')]
  const records = [
    rec('p1', '2026-01-05', 'beatmung', 10),
    rec('p1', '2026-01-06', 'beatmung', 24),
    rec('p1', '2026-02-01', 'crrt', 8),
    rec('p1', '2026-03-01', 'ila_ecmo', 6),
    rec('p2', '2026-01-10', 'beatmung', 5),
    rec('p1', '2025-01-01', 'beatmung', 12), // anderes Jahr -> ignoriert
  ]

  it('aggregiert Beatmungstage und Stundenanteile je Patient fürs Jahr', () => {
    const rows = buildPatientYearRows(patients, records, 2026)
    const p1 = rows.find((r) => r.patientId === 'p1')!
    expect(p1.ventilationDays).toBe(2) // zwei Beatmungs-Records mit >=1h
    expect(p1.totalHours).toBe(10 + 24 + 8 + 6) // 48
    expect(p1.crrtHours).toBe(8)
    expect(p1.ilaEcmoHours).toBe(6)
  })

  it('nimmt nur Patienten mit Records im Jahr auf und sortiert nach Beatmungstagen', () => {
    const rows = buildPatientYearRows(patients, records, 2026)
    expect(rows).toHaveLength(2)
    expect(rows[0].patientId).toBe('p1') // 2 Beatmungstage > 1
  })
})

describe('buildCsv', () => {
  const patients = [patient('p1', 'Patient 1', '900001')]
  const records = [rec('p1', '2026-01-05', 'beatmung', 10), rec('p1', '2026-02-01', 'crrt', 8)]

  it('erzeugt Header und Datenzeilen ;-getrennt inkl. Summenzeile', () => {
    const rows = buildPatientYearRows(patients, records, 2026)
    const csv = buildCsv(rows)
    const lines = csv.split('\r\n')

    expect(lines[0]).toBe('Patient;Fallnummer;Beatmungstage;Therapiestunden;davon CRRT (h);davon iLA/ECMO (h)')
    expect(lines[1]).toBe('Patient 1;900001;1;18;8;0')
    expect(lines[2]).toBe('Summe;;1;18;8;0')
  })

  it('escaped Felder mit Trennzeichen korrekt', () => {
    const rows = buildPatientYearRows([patient('p1', 'Mü;ller, Anna', '900001')], records, 2026)
    const csv = buildCsv(rows)
    expect(csv).toContain('"Mü;ller, Anna";900001')
  })
})
