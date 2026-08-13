import type { TherapyType } from '../types'

/** Metadaten einer Therapieart (Anzeige-Reihenfolge, Beschriftung). */
export interface TherapyTypeMeta {
  type: TherapyType
  /** Langform für Tabelle/Legende. */
  label: string
  /** Kurzform für enge Diagramm-Achsen. */
  short: string
}

/**
 * Zentrale Liste der Therapiearten inkl. Beschriftung. Einzige Quelle für
 * Tabelle, Statistik und Berechnungen — eine spätere Umbenennung/Erweiterung
 * passiert nur hier.
 *
 * Wichtig: `type` ist eine **interne, dauerhaft stabile ID**, kein Anzeigetext.
 * Sie steckt in den deterministischen Record-IDs
 * (`patientId__date__therapyType`), in den SQLite-Spalten und in bereits beim
 * Kunden liegenden JSON-Backups. Umbenannt wird deshalb ausschließlich `label`
 * bzw. `short` — die Werte selbst bleiben, wie sie sind.
 */
export const THERAPY_TYPES: readonly TherapyTypeMeta[] = [
  { type: 'beatmung', label: 'Beatmung', short: 'Beatmung' },
  { type: 'crrt', label: 'Nierenersatzverfahren', short: 'Nierenersatz' },
  { type: 'ila_ecmo', label: 'iLA/ECMO', short: 'iLA/ECMO' },
]

/** Therapieart, die als (invasive) Beatmung für die „Beatmungstage" zählt. */
export const VENTILATION_TYPE: TherapyType = 'beatmung'

/** Liefert das Label zu einer Therapieart (Fallback: der Enum-Wert selbst). */
export function therapyLabel(type: TherapyType): string {
  return THERAPY_TYPES.find((t) => t.type === type)?.label ?? type
}
