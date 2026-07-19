import type { TherapyType } from '../../types'
import { getHours, getOpenTherapy, HOURS_PER_DAY, useTherapyStore } from '../../store/therapyStore'
import { episodeDays, LONG_TERM_DAYS, openEpisodeLevel, REVIEW_DAYS } from '../../lib/episodes/episodes'
import type { OpenTherapy } from '../../lib/episodes/types'
import HourCell from './HourCell'

interface TherapyRowProps {
  patientId: string
  therapyType: TherapyType
  label: string
}

/**
 * Eine Therapie-Zeile: Label + 24 {@link HourCell}s für (Patient, Therapieart)
 * am gewählten Datum, plus die „Läuft"-Steuerung (Start merken / beenden) mit
 * dezenter Langzeit-Warnung. Abonniert gezielt nur das eigene Stunden-Array,
 * damit beim Malen ausschließlich die betroffene Zeile neu rendert.
 */
function TherapyRow({ patientId, therapyType, label }: TherapyRowProps) {
  const hours = useTherapyStore((s) => getHours(s, patientId, therapyType))
  const open = useTherapyStore((s) => getOpenTherapy(s, patientId, therapyType))
  const nowStamp = useTherapyStore((s) => s.nowStamp)
  const startPaint = useTherapyStore((s) => s.startPaint)
  const paintOver = useTherapyStore((s) => s.paintOver)
  const toggleHour = useTherapyStore((s) => s.toggleHour)
  const startTherapyNow = useTherapyStore((s) => s.startTherapyNow)
  const endTherapy = useTherapyStore((s) => s.endTherapy)
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

  function handleEnd() {
    const ok = window.confirm(
      `„${label}" beenden?\n\nDie bis jetzt gelaufenen Stunden werden fest übernommen. ` +
        'Falls du den Moment verpasst hast, korrigiere das Ende anschließend durch Entmarkieren ' +
        'der zu viel erfassten Stunden.',
    )
    if (ok) endTherapy(patientId, therapyType)
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

      {/* Läuft-Steuerung: Start merken bzw. laufende Therapie beenden. */}
      <div className="flex w-28 shrink-0 items-center gap-1.5">
        {open ? (
          <>
            <button
              type="button"
              onClick={handleEnd}
              title={`${label} beenden`}
              className="rounded-xs border border-line px-1.5 py-0.5 text-xs font-medium text-ink transition-colors hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              ■ Beenden
            </button>
            <RunningBadge open={open} nowStamp={nowStamp} />
          </>
        ) : (
          <button
            type="button"
            onClick={() => startTherapyNow(patientId, therapyType)}
            title={`${label} als laufend markieren (füllt automatisch bis jetzt)`}
            className="rounded-xs border border-line px-1.5 py-0.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            ▶ Läuft
          </button>
        )}
      </div>

      {/* Löschen: Tag zurücksetzen bzw. Therapie ganz entfernen. */}
      <div className="flex w-14 shrink-0 gap-1">
        <button
          type="button"
          onClick={() => clearTherapyDay(patientId, therapyType)}
          disabled={activeCount === 0 || !!open}
          title={
            open
              ? 'Erst beenden, dann Stunden korrigieren'
              : `${label}: Stunden dieses Tages löschen`
          }
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

/**
 * Lauf-Anzeige mit dezenter, mit der Dauer intensiver werdender Warnung. Bis 14
 * Tage ein ruhiger Punkt; ab 14 Tagen (Langzeitbeatmung) und ab 28 Tagen (Ende
 * vergessen?) ein ⓘ mit erklärendem Maus-Over — nichts, das weggeklickt werden
 * muss.
 */
function RunningBadge({ open, nowStamp }: { open: OpenTherapy; nowStamp: string }) {
  const episode = { ...open, endAt: null as string | null }
  const days = episodeDays(episode, nowStamp)
  const level = openEpisodeLevel(episode, nowStamp)

  const dayLabel = `läuft seit ${days} Tag${days === 1 ? '' : 'en'}`
  if (level === 'none') {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-primary"
        title={`Läuft — ${dayLabel}. Füllt automatisch bis zur aktuellen Stunde.`}
      >
        <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
      </span>
    )
  }

  const isReview = level === 'review'
  const tip = isReview
    ? `${dayLabel}. Bitte prüfen, ob das Ende vergessen wurde (≥ ${REVIEW_DAYS} Tage).`
    : `${dayLabel}. Langzeitbeatmung (≥ ${LONG_TERM_DAYS} Tage).`

  return (
    <span
      className={[
        'inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold',
        isReview ? 'bg-error text-white' : 'bg-brand-light text-brand-dark',
      ].join(' ')}
      title={tip}
      aria-label={tip}
    >
      i
    </span>
  )
}

export default TherapyRow
