/**
 * Fachliche Beschreibung der Schweregrad-Spalten — eine einzige Quelle für
 * Tabellen-Header (Tooltip + „manuell"-Markierung) und die Regel-Legende.
 * Wer eine Spalte umbenennt oder ihre Berechnung ändert, ändert nur hier.
 */

/**
 * `label`   – reine Beschriftungsspalte (Monat),
 * `manual`  – vom Nutzer je Monat einzutragen (Fälle / TISS-28),
 * `computed`– automatisch aus den erfassten Therapiedaten berechnet.
 */
export type SeverityColumnKind = 'label' | 'manual' | 'computed'

export interface SeverityColumn {
  /** Technischer Schlüssel (entspricht dem Feld in IcuRow/ImcRow). */
  key: string
  /** Kurzer Header-Text in der Tabelle. */
  header: string
  /** Ausführlichere Bezeichnung für die Legende. */
  title: string
  kind: SeverityColumnKind
  /** Regel/Formel in Worten — Tooltip am Header und Text in der Legende. */
  rule: string
}

/** Spalten der ICU-Tabelle (Intensivstation 10) in Anzeige-Reihenfolge. */
export const ICU_COLUMNS: readonly SeverityColumn[] = [
  { key: 'month', header: 'Monat', title: 'Monat', kind: 'label', rule: 'Kalendermonat des Berichtsjahres.' },
  {
    key: 'cases',
    header: 'Fälle',
    title: 'Fälle (Fallbuch)',
    kind: 'manual',
    rule: 'Manuell erfasst: Gesamtzahl der Fälle der Station im Monat laut Fallbuch. Basis für „Anteil %" und „TISS-28 pro Fall".',
  },
  {
    key: 'startedVentDays',
    header: 'Beg. Beatm.tage',
    title: 'Begonnene Beatmungstage',
    kind: 'computed',
    rule: 'Summe aller Tage mit mindestens einer markierten Beatmungsstunde. Jeder (Patient, Tag) zählt höchstens einen Tag.',
  },
  {
    key: 'completeVentDays',
    header: 'Ganze Beatm.tage',
    title: 'Ganze Beatmungstage',
    kind: 'computed',
    rule: 'Ganze 24-Stunden-Tage: Beatmungsstunden total ÷ 24, abgerundet (⌊Stunden ÷ 24⌋).',
  },
  {
    key: 'ventHours',
    header: 'Beatm.std total',
    title: 'Beatmungsstunden total',
    kind: 'computed',
    rule: 'Summe aller im Monat markierten Beatmungsstunden über alle Patienten.',
  },
  {
    key: 'ventPatients',
    header: 'Beatm.pat.',
    title: 'Beatmungspatienten (neue Fälle)',
    kind: 'computed',
    rule: 'Im Monat NEU begonnene Beatmungsfälle (distinkte Fallnummern). Patienten, die schon im Vormonat beatmet wurden, stehen stattdessen unter „Fortgeführt".',
  },
  {
    key: 'continuedVentPatients',
    header: 'Fortgef.',
    title: 'Fortgeführte Beatmungspatienten',
    kind: 'computed',
    rule: 'Patienten, die bereits im Vormonat beatmet wurden. Sie zählen NICHT als neuer Fall dieses Monats (eine Re-Intubation innerhalb desselben Falls ist kein neuer Fall); ihre Beatmungstage und -stunden zählen aber voll mit.',
  },
  {
    key: 'ventPercentage',
    header: 'Anteil %',
    title: 'Anteil Beatmungspatienten in %',
    kind: 'computed',
    rule: 'Beatmungspatienten ÷ Fälle × 100. Bleibt 0, solange keine Fallzahl erfasst ist.',
  },
  {
    key: 'avgVentDuration',
    header: 'Ø Beatm.dauer',
    title: 'Ø Beatmungsdauer in Tagen',
    kind: 'computed',
    rule: 'Begonnene Beatmungstage ÷ Beatmungspatienten — mittlere Beatmungsdauer je beatmetem Patienten (in Tagen).',
  },
  {
    key: 'crrtDays',
    header: 'Hämofilt.tage',
    title: 'Hämofiltrationstage',
    kind: 'computed',
    rule: 'Tage mit mindestens einer markierten CRRT-Stunde (Nierenersatzverfahren).',
  },
  {
    key: 'ecmoDays',
    header: 'ECMO-Tage',
    title: 'ECMO-Tage',
    kind: 'computed',
    rule: 'Tage mit mindestens einer markierten ILA/ECMO-Stunde (extrakorporale Lungenunterstützung).',
  },
  {
    key: 'tissPoints',
    header: 'TISS-28',
    title: 'TISS-28-Punkte',
    kind: 'manual',
    rule: 'Manuell erfasst: Summe der TISS-28-Punkte des Monats.',
  },
  {
    key: 'tissPerCase',
    header: 'TISS/Fall',
    title: 'TISS-28-Punkte pro Fall',
    kind: 'computed',
    rule: 'TISS-28-Punkte ÷ Fälle — durchschnittlicher Schweregrad je Fall.',
  },
]

/** Spalten der IMC-Tabelle (Operative IMC) — nur manuelle Kennzahlen. */
const byKey = (key: string): SeverityColumn => {
  const col = ICU_COLUMNS.find((c) => c.key === key)
  if (!col) throw new Error(`Unbekannte Schweregrad-Spalte: ${key}`)
  return col
}

export const IMC_COLUMNS: readonly SeverityColumn[] = [
  byKey('month'),
  byKey('cases'),
  byKey('tissPoints'),
  byKey('tissPerCase'),
]
