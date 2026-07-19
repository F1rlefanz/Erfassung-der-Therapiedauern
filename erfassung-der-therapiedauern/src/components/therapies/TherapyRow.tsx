import type { TherapyType } from '../../types'
import { getHours, HOURS_PER_DAY, useTherapyStore } from '../../store/therapyStore'
import HourCell from './HourCell'

interface TherapyRowProps {
  patientId: string
  therapyType: TherapyType
  label: string
}

/**
 * Eine Therapie-Zeile: Label + 24 {@link HourCell}s für (Patient, Therapieart)
 * am aktuell gewählten Datum. Abonniert gezielt nur das eigene Stunden-Array,
 * damit beim Malen ausschließlich die betroffene Zeile neu rendert.
 */
function TherapyRow({ patientId, therapyType, label }: TherapyRowProps) {
  const hours = useTherapyStore((s) => getHours(s, patientId, therapyType))
  const startPaint = useTherapyStore((s) => s.startPaint)
  const paintOver = useTherapyStore((s) => s.paintOver)
  const toggleHour = useTherapyStore((s) => s.toggleHour)
  const clearTherapyDay = useTherapyStore((s) => s.clearTherapyDay)
  const removeTherapyForPatient = useTherapyStore((s) => s.removeTherapyForPatient)
  const totalRecords = useTherapyStore(
    (s) =>
      s.therapyRecords.filter((r) => r.patientId === patientId && r.therapyType === therapyType)
        .length,
  )

  const activeCount = hours.reduce((sum, h) => (h ? sum + 1 : sum), 0)

  function handleRemoveAll() {
    const ok = window.confirm(
      `„${label}" für diesen Patienten an ALLEN ${totalRecords} erfassten Tagen löschen?\n\n` +
        'Das ist für den Fall gedacht, dass die Therapie versehentlich erfasst wurde und ' +
        'nie stattgefunden hat. Es lässt sich nicht rückgängig machen.',
    )
    if (ok) removeTherapyForPatient(patientId, therapyType)
  }

  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 pr-1">
        <span className="text-sm font-medium text-ink">{label}</span>
      </div>
      <div className="flex" role="group" aria-label={`${label}: Stunden 0 bis 23`}>
        {Array.from({ length: HOURS_PER_DAY }, (_, hourIndex) => (
          <HourCell
            key={hourIndex}
            hourIndex={hourIndex}
            isActive={hours[hourIndex]}
            onPaintStart={() => startPaint(patientId, therapyType, hourIndex)}
            onPaintEnter={() => paintOver(patientId, therapyType, hourIndex)}
            onToggle={() => toggleHour(patientId, therapyType, hourIndex)}
          />
        ))}
      </div>
      {/* Gesamtzeit dieser Zeile — nicht interaktiv, optisch abgesetzt. */}
      <div
        className="flex h-7 w-12 shrink-0 items-center justify-center rounded-sm border border-line bg-bg text-sm font-bold tabular-nums text-ink"
        title="Gesamtzeit (Stunden)"
      >
        {activeCount}
      </div>

      {/* Löschen: Tag zurücksetzen bzw. Therapie ganz entfernen. */}
      <div className="flex w-14 shrink-0 gap-1">
        <button
          type="button"
          onClick={() => clearTherapyDay(patientId, therapyType)}
          disabled={activeCount === 0}
          title={`${label}: Stunden dieses Tages löschen`}
          aria-label={`${label}: Stunden dieses Tages löschen`}
          className="rounded-xs px-1 text-xs text-ink-muted transition-colors hover:text-error disabled:invisible focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          ⌫
        </button>
        <button
          type="button"
          onClick={handleRemoveAll}
          disabled={totalRecords === 0}
          title={`${label}: an allen Tagen löschen (nie stattgefunden)`}
          aria-label={`${label}: an allen Tagen löschen`}
          className="rounded-xs px-1 text-xs text-ink-muted transition-colors hover:text-error disabled:invisible focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default TherapyRow
