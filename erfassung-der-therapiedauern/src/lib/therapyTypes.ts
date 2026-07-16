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
 */
export const THERAPY_TYPES: readonly TherapyTypeMeta[] = [
  { type: 'beatmung', label: 'Beatmung', short: 'Beatmung' },
  { type: 'crrt', label: 'CRRT', short: 'CRRT' },
  { type: 'ila_ecmo', label: 'ILA / ECMO', short: 'ILA/ECMO' },
]

/** Therapieart, die als (invasive) Beatmung für die „Beatmungstage" zählt. */
export const VENTILATION_TYPE: TherapyType = 'beatmung'

/** Liefert das Label zu einer Therapieart (Fallback: der Enum-Wert selbst). */
export function therapyLabel(type: TherapyType): string {
  return THERAPY_TYPES.find((t) => t.type === type)?.label ?? type
}
