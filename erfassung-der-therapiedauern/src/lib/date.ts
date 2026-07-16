/** Datums-Hilfsfunktionen (deutsche Formatierung, lokale Zeitzone). */

/** Aktuelles Datum als YYYY-MM-DD (lokale Zeitzone). */
export function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Liefert den Vortag eines YYYY-MM-DD-Datums (lokal, ohne Zeitzonen-Drift). */
export function previousDay(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() - 1)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
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
