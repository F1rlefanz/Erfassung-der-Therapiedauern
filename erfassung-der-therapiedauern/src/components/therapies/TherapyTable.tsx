import { useEffect, useState } from 'react'
import { HOURS_PER_DAY, useTherapyStore } from '../../store/therapyStore'
import { THERAPY_TYPES } from '../../lib/therapyTypes'
import { formatDateDE } from '../../lib/date'
import TherapyRow from './TherapyRow'
import TherapyDayTotals from './TherapyDayTotals'
import PatientHeader from './PatientHeader'

/** Stunden, an denen eine neue Schicht beginnt (Früh / Spät / Nacht). */
const SHIFT_START_HOURS = new Set([6, 13, 21])

/** Schichtbänder für den Header (Nachtschicht umschließt Mitternacht). */
const SHIFTS = [
  { label: 'Nacht', startHour: 0, hours: 6 },
  { label: 'Früh', startHour: 6, hours: 7 },
  { label: 'Spät', startHour: 13, hours: 8 },
  { label: 'Nacht', startHour: 21, hours: 3 },
]

/**
 * Erfassungstabelle: pro Patient je eine Zeile pro Therapieart mit dem
 * 24-Stunden-Raster. Bindet Datumswahl, Patient-Anlage, „Vortag fortführen"
 * und die „Malen"-Geste an den globalen Store.
 */
function TherapyTable() {
  const selectedDate = useTherapyStore((s) => s.selectedDate)
  const setSelectedDate = useTherapyStore((s) => s.setSelectedDate)
  // Entlassene Patienten (active: false) verschwinden aus der Tagesansicht,
  // bleiben aber im Store und damit in Statistik/Reporting erhalten.
  const patients = useTherapyStore((s) => s.patients).filter((p) => p.active !== false)
  const addPatient = useTherapyStore((s) => s.addPatient)
  const endPaint = useTherapyStore((s) => s.endPaint)

  const [name, setName] = useState('')
  const [caseNumber, setCaseNumber] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

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
    const result = addPatient(name, caseNumber)
    if (!result.ok) {
      setAddError(result.error)
      return
    }
    setAddError(null)
    setName('')
    setCaseNumber('')
  }

  return (
    <div className="space-y-6">
      {/* Kopfzeile: Datumswahl + Übernahme + Patient hinzufügen */}
      <div className="flex flex-wrap items-end gap-4 rounded-md border border-line bg-surface p-4">
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Datum
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-sm border border-line bg-bg px-2 py-1 text-ink"
            />
            {/* Das Anzeigeformat von input[type=date] folgt der Browser-/OS-Locale
                und lässt sich nicht per lang-Attribut erzwingen — deshalb hier
                zusätzlich fest auf dd.mm.jjjj formatiert. */}
            <span className="tabular-nums text-ink">{formatDateDE(selectedDate)}</span>
          </div>
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

      {addError && (
        <p
          className="rounded-sm border border-error/40 bg-error/5 px-3 py-2 text-sm text-error"
          role="alert"
        >
          {addError}
        </p>
      )}

      <TherapyDayTotals />

      {patients.length === 0 ? (
        <div className="rounded-md border border-line bg-surface p-8 text-center text-sm text-ink-muted">
          Noch keine Patienten erfasst. Lege oben einen Patienten an, um Therapiestunden zu erfassen.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-line bg-surface p-4">
          <ShiftHeader />
          <HourRuler />
          <div className="mt-2 space-y-5">
            {patients.map((patient) => (
              // w-max wie in TherapyRow: Die Patienten-Kopfzeile klebt per
              // `sticky left-0` — ihr umgebender Block muss dafür die volle
              // gescrollte Breite haben, sonst wandert sie beim Scrollen nach
              // rechts mit aus dem Bild (Name/Fallnummer nicht mehr sichtbar).
              <section key={patient.id} className="w-max space-y-1.5">
                <PatientHeader patient={patient} />
                {THERAPY_TYPES.map((meta) => (
                  <TherapyRow
                    key={meta.type}
                    patientId={patient.id}
                    therapyType={meta.type}
                    label={meta.label}
                    shortLabel={meta.short}
                  />
                ))}
              </section>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-ink-muted">
        Tipp: Mit gedrückter Maustaste über die Zellen wischen, um mehrere Stunden in einem Zug zu
        markieren oder zu löschen. „Läuft" merkt sich den Start einer Therapie und füllt automatisch
        bis zur aktuellen Stunde weiter — auch über Mitternacht und nach einem Neustart.
      </p>
    </div>
  )
}

/**
 * Dezenter Schicht-Header über dem Stundenlineal: kennzeichnet Früh- (ab 6),
 * Spät- (ab 13) und Nachtschicht (ab 21) als beschriftete Bänder, ausgerichtet
 * an den Zellen.
 */
function ShiftHeader() {
  return (
    <div className="flex items-stretch gap-3">
      <div className="w-28 shrink-0" />
      <div className="flex">
        {SHIFTS.map((shift, i) => (
          <div
            key={i}
            style={{ width: `calc(var(--cell-size) * ${shift.hours})` }}
            className={[
              'text-center text-2xs uppercase tracking-wide text-ink-muted',
              SHIFT_START_HOURS.has(shift.startHour) ? 'border-l-2 border-l-shift' : '',
            ].join(' ')}
          >
            {shift.label}
          </div>
        ))}
      </div>
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
    <div className="mt-0.5 flex items-end gap-3">
      <div className="w-28 shrink-0" />
      <div className="flex">
        {Array.from({ length: HOURS_PER_DAY }, (_, hourIndex) => (
          <div
            key={hourIndex}
            style={{ width: 'var(--cell-size)' }}
            className={[
              'shrink-0 text-center text-3xs tabular-nums text-ink-muted',
              SHIFT_START_HOURS.has(hourIndex) ? 'border-l-2 border-l-shift' : '',
            ].join(' ')}
          >
            {hourIndex}
          </div>
        ))}
      </div>
      <div className="w-12 shrink-0 text-center text-3xs uppercase tracking-wide text-ink-muted">
        Gesamt
      </div>
    </div>
  )
}

export default TherapyTable
