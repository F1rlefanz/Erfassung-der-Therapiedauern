import { useState } from 'react'
import type { Patient } from '../../types'
import { useTherapyStore } from '../../store/therapyStore'
import { therapyHours } from '../../lib/therapyCalculator'

/**
 * Kopfzeile einer Patienten-Sektion mit explizitem Bearbeiten-Modus.
 *
 * Bewusst KEIN stilles Speichern bei jedem Tastendruck: Stammdaten (Name,
 * Fallnummer) sind auswertungsrelevant, eine unbemerkte Änderung wäre schlimmer
 * als ein Klick mehr. Speichern und Abbrechen sind daher ausdrücklich; Escape
 * verwirft, Enter speichert.
 */
function PatientHeader({ patient }: { patient: Patient }) {
  const updatePatient = useTherapyStore((s) => s.updatePatient)
  const deletePatient = useTherapyStore((s) => s.deletePatient)
  const records = useTherapyStore((s) => s.therapyRecords)

  const [isEditing, setIsEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [name, setName] = useState(patient.name)
  const [caseNumber, setCaseNumber] = useState(patient.caseNumber)
  const [error, setError] = useState<string | null>(null)

  // Umfang der Löschung konkret beziffern — der Nutzer soll nicht raten müssen,
  // was verloren geht. „Tage" = distinkte Kalendertage mit erfasster Zeit (nicht
  // die Zahl der Records: an einem Tag können mehrere Therapiearten laufen).
  const own = records.filter((r) => r.patientId === patient.id)
  const affectedDays = new Set(own.filter((r) => r.hours.some(Boolean)).map((r) => r.date)).size
  const affectedHours = own.reduce((sum, r) => sum + therapyHours(r), 0)

  function startEdit() {
    setName(patient.name)
    setCaseNumber(patient.caseNumber)
    setError(null)
    setIsEditing(true)
  }

  function cancelEdit() {
    setIsEditing(false)
    setError(null)
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    const result = updatePatient(patient.id, name, caseNumber)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setIsEditing(false)
    setError(null)
  }

  if (confirmDelete) {
    return (
      <div
        className="rounded-sm border border-error/40 bg-error/5 p-3"
        role="alertdialog"
        aria-label={`Patient ${patient.name} löschen`}
      >
        <p className="text-sm font-medium text-ink">
          {patient.name} (Fall {patient.caseNumber}) wirklich löschen?
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          {affectedHours === 0
            ? 'Es sind keine Therapiezeiten erfasst.'
            : `Dabei werden ${affectedHours} erfasste Stunde${affectedHours === 1 ? '' : 'n'} an ${affectedDays} Tag${affectedDays === 1 ? '' : 'en'} mitgelöscht. Das lässt sich nicht rückgängig machen.`}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => deletePatient(patient.id)}
            className="rounded-sm bg-error px-3 py-1.5 text-sm font-medium text-white transition-[filter] hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-error"
          >
            Endgültig löschen
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => setConfirmDelete(false)}
            className="rounded-sm border border-line px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Abbrechen
          </button>
        </div>
      </div>
    )
  }

  if (!isEditing) {
    return (
      <header className="flex items-baseline gap-2">
        <h3 className="text-base font-semibold text-ink">{patient.name}</h3>
        <span className="text-xs text-ink-muted">Fall {patient.caseNumber}</span>
        <button
          type="button"
          onClick={startEdit}
          title="Patientendaten bearbeiten"
          aria-label={`Patientendaten von ${patient.name} bearbeiten`}
          className="rounded-xs px-1 text-xs text-ink-muted transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          ✎
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          title="Patient löschen"
          aria-label={`Patient ${patient.name} löschen`}
          className="rounded-xs px-1 text-xs text-ink-muted transition-colors hover:text-error focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          ✕
        </button>
      </header>
    )
  }

  return (
    <form onSubmit={save} className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Fallnummer
          <input
            value={caseNumber}
            onChange={(e) => setCaseNumber(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && cancelEdit()}
            className="w-32 rounded-sm border border-line bg-bg px-2 py-1 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && cancelEdit()}
            className="w-52 rounded-sm border border-line bg-bg px-2 py-1 text-sm text-ink"
          />
        </label>
        <button
          type="submit"
          className="rounded-sm bg-primary px-3 py-1.5 text-sm font-medium text-on-primary transition-[filter] hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Speichern
        </button>
        <button
          type="button"
          onClick={cancelEdit}
          className="rounded-sm border border-line px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Abbrechen
        </button>
      </div>
      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

export default PatientHeader
