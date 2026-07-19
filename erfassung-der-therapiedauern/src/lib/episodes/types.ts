import type { TherapyType } from '../../types'

/**
 * Zeitstempel in **Stundenauflösung und lokaler Zeit**: `YYYY-MM-DDTHH`.
 *
 * Bewusst kein UTC-ISO-String: Der klinische Tag ist ein lokaler Kalendertag,
 * und die Erfassung denkt in Wanduhr-Stunden (Spalte 0–23). Als Zeichenkette ist
 * das Format zugleich lexikografisch sortierbar.
 */
export type HourStamp = string

/**
 * Eine zusammenhängende Therapie-Episode.
 *
 * Kernidee gegenüber dem bisherigen Tages-Bitmap: Gespeichert werden nur Start
 * und Ende. Dass Zeit vergeht, erfordert **keinen Schreibvorgang** — eine offene
 * Episode (`endAt === null`) deckt implizit alles von `startAt` bis „jetzt" ab.
 * Ein Server- oder Browser-Ausfall hinterlässt daher keine Lücke, und es gibt
 * nichts nachzuholen.
 */
export interface TherapyEpisode {
  id: string
  patientId: string
  therapyType: TherapyType
  /** Erste Stunde der Therapie (inklusiv). */
  startAt: HourStamp
  /** Erste Stunde NACH der Therapie (exklusiv); `null` = läuft noch. */
  endAt: HourStamp | null
  /** Zeitpunkt der letzten Änderung als ISO-8601-String (für Sync-Merge). */
  lastUpdatedAt: string
}

/**
 * Dringlichkeit einer offenen Episode. Die Schwellen sind klinisch verankert:
 * Der Median der Beatmungsdauer in Deutschland liegt bei 3–4 Tagen, ab 14 Tagen
 * spricht man definitionsgemäß von Langzeitbeatmung.
 *
 * - `none`   – unauffällig (< 14 Tage)
 * - `info`   – Langzeitbeatmung (≥ 14 Tage), rein informativ
 * - `review` – ≥ 28 Tage: bitte prüfen, ob das Ende erfasst wurde
 */
export type OpenEpisodeLevel = 'none' | 'info' | 'review'
