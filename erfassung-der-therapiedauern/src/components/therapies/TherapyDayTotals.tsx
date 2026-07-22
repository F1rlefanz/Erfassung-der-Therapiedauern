import type { TherapyType } from '../../types'
import { useTherapyStore } from '../../store/therapyStore'
import { useEffectiveRecords } from '../../store/useEffectiveRecords'
import { THERAPY_TYPES } from '../../lib/therapyTypes'
import { therapyHours } from '../../lib/therapyCalculator'

/**
 * Summenzeile unter der Erfassungstabelle: je Therapieart die Fallzahl und die
 * Gesamtzeit über ALLE Patienten am gewählten Tag, plus ein Tagesgesamt.
 *
 * Fallzahl = Anzahl Patienten mit mindestens einer erfassten Stunde (Legacy:
 * „Fallzahl: N Patienten"). Da im neuen Modell jeder Patient ohnehin Zeilen für
 * alle Therapiearten hat, ist „Zeile vorhanden" kein sinnvolles Kriterium mehr —
 * gezählt wird, wer an diesem Tag tatsächlich behandelt wurde.
 */
function TherapyDayTotals() {
  const records = useEffectiveRecords()
  const selectedDate = useTherapyStore((s) => s.selectedDate)
  const patients = useTherapyStore((s) => s.patients)

  if (patients.length === 0) return null

  const hours: Record<TherapyType, number> = { beatmung: 0, crrt: 0, ila_ecmo: 0 }
  const patientsByType: Record<TherapyType, Set<string>> = {
    beatmung: new Set(),
    crrt: new Set(),
    ila_ecmo: new Set(),
  }
  const patientsTotal = new Set<string>()

  for (const record of records) {
    if (record.date !== selectedDate) continue
    const h = therapyHours(record)
    if (h === 0) continue
    hours[record.therapyType] += h
    patientsByType[record.therapyType].add(record.patientId)
    patientsTotal.add(record.patientId)
  }

  const grandTotal = hours.beatmung + hours.crrt + hours.ila_ecmo

  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Fallzahl &amp; Gesamtzeit aller Patienten (Tag)
      </h3>
      <div className="flex flex-wrap gap-2">
        {THERAPY_TYPES.map((meta) => (
          <TotalsTile
            key={meta.type}
            label={meta.label}
            cases={patientsByType[meta.type].size}
            hours={hours[meta.type]}
          />
        ))}
        <TotalsTile label="Gesamt" cases={patientsTotal.size} hours={grandTotal} highlight />
      </div>
    </div>
  )
}

interface TotalsTileProps {
  label: string
  cases: number
  hours: number
  highlight?: boolean
}

/** Eine Kachel: Therapieart + Fallzahl + Stunden. */
function TotalsTile({ label, cases, hours, highlight = false }: TotalsTileProps) {
  return (
    <div
      className={[
        'flex items-center gap-2 rounded-sm border border-line px-3 py-1.5 text-sm',
        highlight ? 'bg-brand-light' : 'bg-bg',
      ].join(' ')}
    >
      <span className={highlight ? 'text-brand-dark' : 'text-ink-muted'}>{label}</span>
      <span
        className={['font-bold tabular-nums', highlight ? 'text-brand-dark' : 'text-ink'].join(' ')}
        title={`${cases} Patient${cases === 1 ? '' : 'en'} mit erfasster Zeit`}
      >
        {cases} {cases === 1 ? 'Fall' : 'Fälle'}
      </span>
      <span aria-hidden className={highlight ? 'text-brand-dark/40' : 'text-line'}>
        ·
      </span>
      <span
        className={['font-bold tabular-nums', highlight ? 'text-brand-dark' : 'text-ink'].join(' ')}
        title="Summe der erfassten Stunden"
      >
        {hours} h
      </span>
    </div>
  )
}

export default TherapyDayTotals
