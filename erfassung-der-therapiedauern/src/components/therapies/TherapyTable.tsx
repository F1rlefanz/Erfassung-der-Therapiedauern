import { useEffect, useState } from 'react'
import type { TherapyType } from '../../types'
import { HOURS_PER_DAY, useTherapyStore } from '../../store/therapyStore'
import TherapyRow from './TherapyRow'

/** Anzeige-Reihenfolge und Beschriftung der Therapiearten. */
const THERAPY_META: ReadonlyArray<{ type: TherapyType; label: string }> = [
  { type: 'beatmung', label: 'Beatmung' },
  { type: 'crrt', label: 'CRRT' },
  { type: 'ila_ecmo', label: 'ILA / ECMO' },
]

/** Stunden, an denen eine neue Schicht beginnt (Früh / Spät / Nacht). */
const SHIFT_START_HOURS = new Set([6, 13, 21])

/**
 * Erfassungstabelle: pro Patient je eine Zeile pro Therapieart mit dem
 * 24-Stunden-Raster. Bindet Datumswahl, Patient-Anlage und die „Malen"-Geste
 * an den globalen Store.
 */
function TherapyTable() {
  const selectedDate = useTherapyStore((s) => s.selectedDate)
  const setSelectedDate = useTherapyStore((s) => s.setSelectedDate)
  const patients = useTherapyStore((s) => s.patients)
  const addPatient = useTherapyStore((s) => s.addPatient)
  const endPaint = useTherapyStore((s) => s.endPaint)

  const [name, setName] = useState('')
  const [caseNumber, setCaseNumber] = useState('')

  // Malen endet, sobald der Zeiger irgendwo losgelassen wird — auch außerhalb
  // des Rasters. Darum global auf window lauschen.
  useEffect(() => {
    window.addEventListener('pointerup', endPaint)
    window.addEventListener('pointercancel', endPaint)
    return () => {
      window.removeEventListener('pointerup', endPaint)
      window.removeEventListener('pointercancel', endPaint)
    }
  }, [endPaint])

  function handleAddPatient(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !caseNumber.trim()) return
    addPatient(name, caseNumber)
    setName('')
    setCaseNumber('')
  }

  return (
    <div className="space-y-6">
      {/* Kopfzeile: Datumswahl + Patient hinzufügen */}
      <div className="flex flex-wrap items-end gap-4 rounded-md border border-line bg-surface p-4">
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Datum
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-sm border border-line bg-bg px-2 py-1 text-ink"
          />
        </label>

        <form onSubmit={handleAddPatient} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            Fallnummer
            <input
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
              placeholder="z. B. 100234"
              className="w-32 rounded-sm border border-line bg-bg px-2 py-1 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-muted">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nachname, Vorname"
              className="w-52 rounded-sm border border-line bg-bg px-2 py-1 text-ink"
            />
          </label>
          <button
            type="submit"
            className="rounded-sm bg-primary px-3 py-1.5 text-sm font-medium text-on-primary transition-[filter] hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Patient hinzufügen
          </button>
        </form>
      </div>

      {patients.length === 0 ? (
        <div className="rounded-md border border-line bg-surface p-8 text-center text-sm text-ink-muted">
          Noch keine Patienten erfasst. Lege oben einen Patienten an, um Therapiestunden zu erfassen.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-line bg-surface p-4">
          <HourRuler />
          <div className="mt-2 space-y-5">
            {patients.map((patient) => (
              <section key={patient.id} className="space-y-1.5">
                <header className="flex items-baseline gap-2">
                  <h3 className="text-base font-semibold text-ink">{patient.name}</h3>
                  <span className="text-xs text-ink-muted">Fall {patient.caseNumber}</span>
                </header>
                {THERAPY_META.map((meta) => (
                  <TherapyRow
                    key={meta.type}
                    patientId={patient.id}
                    therapyType={meta.type}
                    label={meta.label}
                  />
                ))}
              </section>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-ink-muted">
        Tipp: Mit gedrückter Maustaste über die Zellen wischen, um mehrere Stunden in einem Zug zu
        markieren oder zu löschen.
      </p>
    </div>
  )
}

/**
 * Stundenlineal (0–23) über den Therapie-Zeilen, ausgerichtet an den Zellen.
 * Die Schichtgrenzen (6/13/21 Uhr) tragen denselben dickeren linken Rand wie
 * die Zellen darunter.
 */
function HourRuler() {
  return (
    <div className="flex items-end gap-3">
      <div className="w-28 shrink-0" />
      <div className="flex">
        {Array.from({ length: HOURS_PER_DAY }, (_, hourIndex) => (
          <div
            key={hourIndex}
            className={[
              'w-7 shrink-0 text-center text-[10px] tabular-nums text-ink-muted',
              SHIFT_START_HOURS.has(hourIndex) ? 'border-l-2 border-l-shift' : '',
            ].join(' ')}
          >
            {hourIndex}
          </div>
        ))}
      </div>
    </div>
  )
}

export default TherapyTable
