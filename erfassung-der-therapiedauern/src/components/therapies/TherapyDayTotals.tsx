import type { TherapyType } from '../../types'
import { useTherapyStore } from '../../store/therapyStore'
import { THERAPY_TYPES } from '../../lib/therapyTypes'
import { therapyHours } from '../../lib/therapyCalculator'

/**
 * Summenzeile unter der Erfassungstabelle: Gesamtzeit je Therapieart über ALLE
 * Patienten am gewählten Tag, plus ein Tagesgesamt. Nicht interaktiv, optisch
 * abgesetzt (dezenter Hintergrund, `font-bold`).
 */
function TherapyDayTotals() {
  const records = useTherapyStore((s) => s.therapyRecords)
  const selectedDate = useTherapyStore((s) => s.selectedDate)

  const totals: Record<TherapyType, number> = { beatmung: 0, crrt: 0, ila_ecmo: 0 }
  for (const record of records) {
    if (record.date !== selectedDate) continue
    totals[record.therapyType] += therapyHours(record)
  }
  const grandTotal = totals.beatmung + totals.crrt + totals.ila_ecmo

  return (
    <div className="mt-5 border-t border-line pt-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Gesamtzeit aller Patienten (Tag)
      </h3>
      <div className="flex flex-wrap gap-2">
        {THERAPY_TYPES.map((meta) => (
          <div
            key={meta.type}
            className="flex items-center gap-2 rounded-sm border border-line bg-bg px-3 py-1.5 text-sm"
          >
            <span className="text-ink-muted">{meta.label}</span>
            <span className="font-bold tabular-nums text-ink">{totals[meta.type]} h</span>
          </div>
        ))}
        <div className="flex items-center gap-2 rounded-sm border border-line bg-brand-light px-3 py-1.5 text-sm">
          <span className="text-brand-dark">Gesamt</span>
          <span className="font-bold tabular-nums text-brand-dark">{grandTotal} h</span>
        </div>
      </div>
    </div>
  )
}

export default TherapyDayTotals
