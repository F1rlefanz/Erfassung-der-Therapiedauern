// Zentrales Datenmodell für "Erfassung der Therapiedauern".
// Bewusst konfliktfrei modelliert: eine TherapyRecord pro (Patient, Datum,
// Therapieart); die 24 Stunden eines Tages liegen als boolean-Array vor.

/** Erfasste Therapiearten. */
export type TherapyType = 'beatmung' | 'crrt' | 'ila_ecmo'

/** Ein Patient bzw. Behandlungsfall. */
export interface Patient {
  id: string
  /** Fallnummer (fachlicher Schlüssel im Klinik-Kontext). */
  caseNumber: string
  name: string
  /**
   * Zeitpunkt der letzten Änderung (ISO-8601). Grundlage des Sync-Merge: ein
   * älteres Echo darf einen neueren Stand nicht überschreiben.
   */
  lastUpdatedAt: string
}

/**
 * Erfassung einer Therapieart für einen Patienten an einem Tag.
 * `hours` hat immer die Länge 24 (Index = Stunde 0–23, true = Therapie aktiv).
 */
export interface TherapyRecord {
  id: string
  patientId: string
  /** Datum im Format YYYY-MM-DD. */
  date: string
  therapyType: TherapyType
  /** Boolean-Array der Länge 24 (Stunde 0–23). */
  hours: boolean[]
  /** Zeitpunkt der letzten Änderung als ISO-8601-String. */
  lastUpdatedAt: string
}
