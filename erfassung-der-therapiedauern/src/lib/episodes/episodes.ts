import type { TherapyRecord, TherapyType } from '../../types'
import type { HourStamp, OpenEpisodeLevel, OpenTherapy, TherapyEpisode } from './types'

/**
 * Umrechnung zwischen Episoden (Intervallen) und dem 24-Stunden-Raster.
 *
 * Rein und deterministisch: „jetzt" wird immer explizit übergeben, nie aus der
 * Systemuhr gelesen — sonst wären die Funktionen nicht testbar.
 *
 * Zeitrechnung erfolgt in **Stunden-Slots der Wanduhr**, nicht in real
 * verstrichener Zeit. An Zeitumstellungstagen hat der Tag im Raster weiterhin 24
 * Spalten (wie in der Vorgänger-Anwendung); ein Slot entspricht einer
 * Tabellenspalte, nicht zwingend 60 realen Minuten.
 */

const HOURS_PER_DAY = 24

/** Baut einen Stundenstempel aus Datum (YYYY-MM-DD) und Stunde (0–23). */
export function hourStamp(date: string, hour: number): HourStamp {
  return `${date}T${String(hour).padStart(2, '0')}`
}

/** Zerlegt einen Stundenstempel wieder in Datum und Stunde. */
export function parseHourStamp(stamp: HourStamp): { date: string; hour: number } {
  return { date: stamp.slice(0, 10), hour: Number(stamp.slice(11, 13)) }
}

/**
 * Absoluter Slot-Index einer Stunde (fortlaufend über Tages- und Jahresgrenzen).
 * Erlaubt Differenzbildung und Vergleiche ohne Datums-Arithmetik im Aufrufer.
 */
export function slotIndex(stamp: HourStamp): number {
  const { date, hour } = parseHourStamp(stamp)
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d, hour) / 3_600_000
}

/** Umkehrung von {@link slotIndex}. */
export function stampFromSlot(index: number): HourStamp {
  const dt = new Date(index * 3_600_000)
  const date = dt.toISOString().slice(0, 10)
  return hourStamp(date, dt.getUTCHours())
}

/** Ob die Episode noch läuft. */
export function isOpen(episode: TherapyEpisode): boolean {
  return episode.endAt === null
}

/**
 * Effektives Ende (exklusiv) einer Episode. Eine offene Episode reicht bis
 * einschließlich der aktuellen Stunde — nie in die Zukunft.
 */
export function effectiveEndSlot(episode: TherapyEpisode, now: HourStamp): number {
  if (episode.endAt !== null) return slotIndex(episode.endAt)
  return slotIndex(now) + 1
}

/** Dauer in Stunden (offene Episode: bis einschließlich „jetzt"). */
export function episodeHours(episode: TherapyEpisode, now: HourStamp): number {
  return Math.max(0, effectiveEndSlot(episode, now) - slotIndex(episode.startAt))
}

/** Dauer in vollen Tagen — Grundlage der Warnstufen. */
export function episodeDays(episode: TherapyEpisode, now: HourStamp): number {
  return Math.floor(episodeHours(episode, now) / HOURS_PER_DAY)
}

/** Ab hier gilt eine Beatmung definitionsgemäß als Langzeitbeatmung. */
export const LONG_TERM_DAYS = 14
/** Ab hier soll aktiv geprüft werden, ob das Ende schlicht vergessen wurde. */
export const REVIEW_DAYS = 28

/**
 * Warnstufe einer offenen Episode. Geschlossene Episoden sind immer `none` —
 * bei ihnen gibt es nichts zu prüfen.
 */
export function openEpisodeLevel(episode: TherapyEpisode, now: HourStamp): OpenEpisodeLevel {
  if (!isOpen(episode)) return 'none'
  const days = episodeDays(episode, now)
  if (days >= REVIEW_DAYS) return 'review'
  if (days >= LONG_TERM_DAYS) return 'info'
  return 'none'
}

/**
 * Leitet das 24-Stunden-Raster eines Tages aus den Episoden ab — die Brücke zum
 * bestehenden UI, das weiterhin mit `boolean[24]` arbeitet.
 */
export function hoursForDay(
  episodes: TherapyEpisode[],
  patientId: string,
  therapyType: TherapyType,
  date: string,
  now: HourStamp,
): boolean[] {
  const hours = Array<boolean>(HOURS_PER_DAY).fill(false)
  const dayStart = slotIndex(hourStamp(date, 0))
  const dayEnd = dayStart + HOURS_PER_DAY

  for (const ep of episodes) {
    if (ep.patientId !== patientId || ep.therapyType !== therapyType) continue

    const from = Math.max(slotIndex(ep.startAt), dayStart)
    const to = Math.min(effectiveEndSlot(ep, now), dayEnd)
    for (let slot = from; slot < to; slot++) hours[slot - dayStart] = true
  }

  return hours
}

// ---------------------------------------------------------------------------
// Migration: Tages-Bitmaps → Episoden
// ---------------------------------------------------------------------------

/**
 * Wandelt die bisherigen {@link TherapyRecord}s in Episoden um. Zusammenhängende
 * Stunden werden zu einem Intervall zusammengefasst — auch über Mitternacht
 * hinweg, sodass eine durchgehende Therapie genau EINE Episode ergibt.
 *
 * Lücken bleiben Lücken: Nicht markierte Stunden trennen zwei Episoden. Alle
 * erzeugten Episoden sind geschlossen; ob eine davon „noch läuft", kann aus
 * Altdaten nicht erschlossen werden und bleibt eine bewusste Entscheidung beim
 * Umstieg.
 */
export function recordsToEpisodes(records: TherapyRecord[]): TherapyEpisode[] {
  const groups = new Map<string, TherapyRecord[]>()
  for (const r of records) {
    const key = `${r.patientId}__${r.therapyType}`
    const list = groups.get(key)
    if (list) list.push(r)
    else groups.set(key, [r])
  }

  const episodes: TherapyEpisode[] = []

  for (const [, list] of groups) {
    // Alle aktiven Stunden als Slot-Indizes sammeln und sortieren.
    const slots: number[] = []
    let lastUpdatedAt = ''
    for (const r of list) {
      if (r.lastUpdatedAt > lastUpdatedAt) lastUpdatedAt = r.lastUpdatedAt
      const base = slotIndex(hourStamp(r.date, 0))
      for (let h = 0; h < HOURS_PER_DAY; h++) {
        if (r.hours[h]) slots.push(base + h)
      }
    }
    if (slots.length === 0) continue
    slots.sort((a, b) => a - b)

    const { patientId, therapyType } = list[0]
    let runStart = slots[0]
    let prev = slots[0]

    const flush = (endExclusive: number) => {
      const startAt = stampFromSlot(runStart)
      episodes.push({
        id: `${patientId}__${therapyType}__${startAt}`,
        patientId,
        therapyType,
        startAt,
        endAt: stampFromSlot(endExclusive),
        lastUpdatedAt,
      })
    }

    for (let i = 1; i < slots.length; i++) {
      if (slots[i] === prev + 1) {
        prev = slots[i]
        continue
      }
      flush(prev + 1) // Lücke → Episode abschließen
      runStart = slots[i]
      prev = slots[i]
    }
    flush(prev + 1)
  }

  return episodes
}

/** Summe der Therapiestunden einer Episodenliste (offene bis „jetzt"). */
export function totalEpisodeHours(episodes: TherapyEpisode[], now: HourStamp): number {
  return episodes.reduce((sum, ep) => sum + episodeHours(ep, now), 0)
}

/**
 * Effektives 24-Stunden-Raster eines Tages: Basis-Stunden plus die Deckung einer
 * eventuell laufenden Therapie bis „jetzt". Ohne laufende Therapie wird
 * `baseHours` **referenzgleich** zurückgegeben — wichtig, damit reaktive
 * Selektoren nicht bei jedem Render ein neues Array sehen (Endlosschleife).
 */
export function overlayDayHours(
  baseHours: boolean[],
  open: OpenTherapy | undefined,
  date: string,
  now: HourStamp,
): boolean[] {
  if (!open) return baseHours

  const episode: TherapyEpisode = {
    id: open.id,
    patientId: open.patientId,
    therapyType: open.therapyType,
    startAt: open.startAt,
    endAt: null,
    lastUpdatedAt: open.lastUpdatedAt,
  }
  const overlay = hoursForDay([episode], open.patientId, open.therapyType, date, now)
  if (!overlay.some(Boolean)) return baseHours // Tag außerhalb des Laufs → Basis unverändert

  return baseHours.map((active, i) => active || overlay[i])
}

// ---------------------------------------------------------------------------
// Overlay: laufende Therapien auf die Basis-Records legen
// ---------------------------------------------------------------------------

const RECORD_KEY = (patientId: string, date: string, therapyType: TherapyType) =>
  `${patientId}__${date}__${therapyType}`

/** Datum (YYYY-MM-DD) aus einem absoluten Slot-Index. */
function dateOfSlot(index: number): string {
  return new Date(index * 3_600_000).toISOString().slice(0, 10)
}

/**
 * Legt die laufenden Therapien über die Basis-Records und liefert die
 * **effektive** Recordliste, die alle Verbraucher (Raster, Statistik, Export)
 * lesen. Eine offene Therapie füllt jeden Tag von ihrem Start bis einschließlich
 * der aktuellen Stunde; die belegten Stunden werden mit vorhandenen Basis-Stunden
 * ODER-verknüpft (nichts wird gelöscht, nur ergänzt).
 *
 * Rein und deterministisch — `now` wird immer übergeben. So können abgeleitete
 * Records ohne Persistenz „mit der Uhr wachsen": Zeitvergehen erfordert keinen
 * Schreibvorgang, ein Absturz hinterlässt keine Lücke.
 */
export function overlayOpenTherapies(
  baseRecords: TherapyRecord[],
  open: OpenTherapy[],
  now: HourStamp,
): TherapyRecord[] {
  if (open.length === 0) return baseRecords

  // Records nach Key indizieren (Kopie der Stunden-Arrays, damit die Basis
  // unverändert bleibt).
  const byKey = new Map<string, TherapyRecord>()
  for (const r of baseRecords) {
    byKey.set(RECORD_KEY(r.patientId, r.date, r.therapyType), { ...r, hours: r.hours.slice() })
  }

  const nowSlot = slotIndex(now)

  for (const ot of open) {
    const startSlot = slotIndex(ot.startAt)
    if (nowSlot < startSlot) continue // Start liegt in der Zukunft → nichts

    const startDay = dateOfSlot(slotIndex(hourStamp(parseHourStamp(ot.startAt).date, 0)))
    let dayStart = slotIndex(hourStamp(startDay, 0))

    // Tag für Tag bis zum aktuellen Tag füllen.
    while (dayStart <= nowSlot) {
      const date = dateOfSlot(dayStart)
      const from = Math.max(startSlot, dayStart)
      const to = Math.min(nowSlot + 1, dayStart + HOURS_PER_DAY) // exklusiv, inkl. „jetzt"

      const key = RECORD_KEY(ot.patientId, date, ot.therapyType)
      let rec = byKey.get(key)
      if (!rec) {
        rec = {
          id: key,
          patientId: ot.patientId,
          date,
          therapyType: ot.therapyType,
          hours: Array<boolean>(HOURS_PER_DAY).fill(false),
          lastUpdatedAt: ot.lastUpdatedAt,
        }
        byKey.set(key, rec)
      }
      for (let slot = from; slot < to; slot++) rec.hours[slot - dayStart] = true

      dayStart += HOURS_PER_DAY
    }
  }

  return [...byKey.values()]
}
