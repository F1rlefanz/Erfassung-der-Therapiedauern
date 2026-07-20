import { describe, expect, it } from 'vitest'
import type { Patient, TherapyRecord, TherapyType } from '../../types'
import { buildEpisodeRows } from './episodeRows'
import { buildEpisodeCsv } from './csvExport'

function rec(patientId: string, date: string, tt: TherapyType, hoursActive: number[]): TherapyRecord {
  const hours = Array<boolean>(24).fill(false)
  for (const h of hoursActive) hours[h] = true
  return { id: `${patientId}__${date}__${tt}`, patientId, date, therapyType: tt, hours, lastUpdatedAt: `${date}T12:00:00.000Z` }
}

const patients: Patient[] = [
  { id: 'p1', name: 'Mustermann, Max', caseNumber: '100234' },
  { id: 'p2', name: 'Musterfrau, Erika', caseNumber: '100235' },
]

const NOW = '2026-07-20T23'

describe('buildEpisodeRows', () => {
  it('bildet eine zusammenhängende Episode mit Von/Bis', () => {
    const rows = buildEpisodeRows(patients, [rec('p1', '2026-07-16', 'beatmung', [8, 9, 10, 11])], NOW)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      caseNumber: '100234',
      name: 'Mustermann, Max',
      therapyLabel: 'Beatmung',
      startDate: '2026-07-16',
      from: '08:00',
      endDate: '2026-07-16',
      to: '11:59', // letzte aktive Stunde inklusiv
      hours: 4,
    })
  })

  it('verschmilzt über Mitternacht zu EINER Zeile mit Datums-Wechsel', () => {
    const rows = buildEpisodeRows(
      patients,
      [rec('p1', '2026-07-16', 'beatmung', [22, 23]), rec('p1', '2026-07-17', 'beatmung', [0, 1])],
      NOW,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      startDate: '2026-07-16',
      from: '22:00',
      endDate: '2026-07-17',
      to: '01:59',
      hours: 4,
    })
  })

  it('trennt Lücken in mehrere Zeilen und sortiert nach Beginn', () => {
    const rows = buildEpisodeRows(patients, [rec('p1', '2026-07-16', 'beatmung', [1, 2, 20, 21])], NOW)
    expect(rows).toHaveLength(2)
    expect(rows[0].from).toBe('01:00')
    expect(rows[1].from).toBe('20:00')
  })

  it('verknüpft Name/Fallnummer je Patient und trennt Therapiearten', () => {
    const rows = buildEpisodeRows(
      patients,
      [rec('p1', '2026-07-16', 'beatmung', [8]), rec('p2', '2026-07-16', 'crrt', [9])],
      NOW,
    )
    expect(rows).toHaveLength(2)
    const crrt = rows.find((r) => r.therapyLabel === 'CRRT')!
    expect(crrt.name).toBe('Musterfrau, Erika')
    expect(crrt.caseNumber).toBe('100235')
  })
})

describe('buildEpisodeCsv', () => {
  it('erzeugt Header + Zeilen (;-getrennt, mit Von/Bis)', () => {
    const rows = buildEpisodeRows(patients, [rec('p1', '2026-07-16', 'beatmung', [8, 9])], NOW)
    const csv = buildEpisodeCsv(rows)
    const [header, line] = csv.split('\r\n')
    expect(header).toBe('Fallnummer;Name;Therapieart;Beginn (Datum);Von;Ende (Datum);Bis;Stunden')
    expect(line).toBe('100234;Mustermann, Max;Beatmung;2026-07-16;08:00;2026-07-16;09:59;2')
  })
})
