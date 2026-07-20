import type { Patient, TherapyRecord } from '../../types'
import { therapyLabel } from '../therapyTypes'
import {
  effectiveEndSlot,
  parseHourStamp,
  recordsToEpisodes,
  slotIndex,
  stampFromSlot,
} from '../episodes/episodes'
import type { HourStamp } from '../episodes/types'

/**
 * Eine Rohdaten-/Episoden-Zeile für den Export: eine zusammenhängende Therapie
 * mit „Von" (erste Stunde) und „Bis" (letzte Stunde). Ersetzt die tabellarische
 * Aggregation, wenn der Empfänger die einzelnen Läufe braucht (MDK/Controlling).
 */
export interface EpisodeRow {
  caseNumber: string
  name: string
  therapyLabel: string
  /** Beginn-Datum (YYYY-MM-DD). */
  startDate: string
  /** „Von" als Uhrzeit `HH:00` (erste aktive Stunde). */
  from: string
  /** Ende-Datum (YYYY-MM-DD). */
  endDate: string
  /** „Bis" als Uhrzeit `HH:59` (letzte aktive Stunde, inklusiv). */
  to: string
  /** Dauer in Stunden. */
  hours: number
}

function hhmm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/**
 * Baut Episoden-Zeilen für ein Jahr: fasst die erfassten Stunden je (Patient,
 * Therapieart) zu zusammenhängenden Läufen zusammen (auch über Mitternacht) und
 * verknüpft sie mit Name/Fallnummer. `records` sollte bereits auf das Jahr
 * gefiltert sein — ein Lauf über die Jahresgrenze erscheint dann mit dem im Jahr
 * liegenden Anteil. Sortiert nach Beginn, dann Name.
 *
 * Laufende Therapien (offene Episoden) werden über `now` bis zur aktuellen Stunde
 * berücksichtigt, sofern sie in den (effektiven) Records enthalten sind.
 */
export function buildEpisodeRows(
  patients: Patient[],
  records: TherapyRecord[],
  now: HourStamp,
): EpisodeRow[] {
  const byId = new Map(patients.map((p) => [p.id, p]))
  const episodes = recordsToEpisodes(records)

  const rows: EpisodeRow[] = []
  for (const ep of episodes) {
    const patient = byId.get(ep.patientId)
    const startSlot = slotIndex(ep.startAt)
    const endSlot = effectiveEndSlot(ep, now) // exklusiv
    const lastSlot = endSlot - 1 // letzte aktive Stunde, inklusiv
    const start = parseHourStamp(ep.startAt)
    const last = parseHourStamp(stampFromSlot(lastSlot))

    rows.push({
      caseNumber: patient?.caseNumber ?? '—',
      name: patient?.name ?? '—',
      therapyLabel: therapyLabel(ep.therapyType),
      startDate: start.date,
      from: hhmm(start.hour, 0),
      endDate: last.date,
      to: hhmm(last.hour, 59),
      hours: endSlot - startSlot,
    })
  }

  rows.sort(
    (a, b) =>
      (a.startDate === b.startDate ? a.from.localeCompare(b.from) : a.startDate.localeCompare(b.startDate)) ||
      a.name.localeCompare(b.name),
  )
  return rows
}
