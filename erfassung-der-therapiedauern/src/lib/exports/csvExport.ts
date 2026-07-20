import type { PatientYearRow } from './reportRows'
import { sumPatientYearRows } from './reportRows'
import type { EpisodeRow } from './episodeRows'

/** Trennzeichen für deutsche Excel-Kompatibilität. */
const SEPARATOR = ';'

/** UTF-8-Byte-Order-Mark, damit deutsches Excel Umlaute korrekt liest. */
const UTF8_BOM = String.fromCharCode(0xfeff)

const HEADERS = [
  'Patient',
  'Fallnummer',
  'Beatmungstage',
  'Therapiestunden',
  'davon CRRT (h)',
  'davon iLA/ECMO (h)',
]

/** Escaped ein CSV-Feld (Anführungszeichen bei Sonderzeichen). */
function escapeField(value: string | number): string {
  const s = String(value)
  if (s.includes(SEPARATOR) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * Wandelt die Report-Zeilen in einen standardisierten CSV-String um
 * (`;`-getrennt, CRLF-Zeilenenden, inkl. Summenzeile). Rein/deterministisch.
 */
export function buildCsv(rows: PatientYearRow[]): string {
  const lines = [HEADERS.join(SEPARATOR)]

  for (const row of rows) {
    lines.push(
      [row.name, row.caseNumber, row.ventilationDays, row.totalHours, row.crrtHours, row.ilaEcmoHours]
        .map(escapeField)
        .join(SEPARATOR),
    )
  }

  const totals = sumPatientYearRows(rows)
  lines.push(
    ['Summe', '', totals.ventilationDays, totals.totalHours, totals.crrtHours, totals.ilaEcmoHours]
      .map(escapeField)
      .join(SEPARATOR),
  )

  return lines.join('\r\n')
}

/**
 * Baut das CSV und löst einen Datei-Download aus. Das UTF-8-BOM sorgt dafür,
 * dass deutsches Excel Umlaute korrekt darstellt.
 */
export function downloadCsv(rows: PatientYearRow[], year: number): void {
  triggerCsvDownload(buildCsv(rows), `beatmungstage_${year}.csv`)
}

// ---- Rohdaten-Export je Episode (mit „Von/Bis") --------------------------

const EPISODE_HEADERS = [
  'Fallnummer',
  'Name',
  'Therapieart',
  'Beginn (Datum)',
  'Von',
  'Ende (Datum)',
  'Bis',
  'Stunden',
]

/**
 * CSV der einzelnen Therapie-Läufe (eine Zeile je zusammenhängender Episode) mit
 * „Von"/„Bis". Rein/deterministisch.
 */
export function buildEpisodeCsv(rows: EpisodeRow[]): string {
  const lines = [EPISODE_HEADERS.join(SEPARATOR)]
  for (const r of rows) {
    lines.push(
      [r.caseNumber, r.name, r.therapyLabel, r.startDate, r.from, r.endDate, r.to, r.hours]
        .map(escapeField)
        .join(SEPARATOR),
    )
  }
  return lines.join('\r\n')
}

export function downloadEpisodeCsv(rows: EpisodeRow[], year: number): void {
  triggerCsvDownload(buildEpisodeCsv(rows), `therapie_rohdaten_vonbis_${year}.csv`)
}

/** Gemeinsamer Datei-Download (UTF-8-BOM für deutsches Excel). */
function triggerCsvDownload(csv: string, filename: string): void {
  const blob = new Blob([UTF8_BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
