/** Datums-Hilfsfunktionen (deutsche Formatierung, lokale Zeitzone). */

/** Aktuelles Datum als YYYY-MM-DD (lokale Zeitzone). */
export function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Formatiert ein YYYY-MM-DD-Datum als DD.MM.YYYY. */
export function formatDateDE(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  if (!y || !m || !d) return isoDate
  return `${d}.${m}.${y}`
}

/** Formatiert einen ISO-Zeitstempel als deutsches Datum + Uhrzeit. */
export function formatDateTimeDE(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '–'
  return d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
}
