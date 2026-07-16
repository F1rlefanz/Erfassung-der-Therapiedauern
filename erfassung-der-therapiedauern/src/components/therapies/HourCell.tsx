import type { PointerEvent as ReactPointerEvent, KeyboardEvent } from 'react'

/**
 * Eine einzelne Stundenzelle im 24-Stunden-Raster einer TherapyRecord.
 *
 * Interaktion: Die Zelle ist Teil der „Malen"-Geste. `pointerdown` startet das
 * Malen (Füllen/Löschen je nach Startzelle), `pointerenter` malt beim Ziehen
 * weiter. Das Beenden übernimmt ein globaler `pointerup`-Listener in der
 * TherapyTable. Tastatur (Space/Enter) toggelt die einzelne Stunde.
 *
 * Schichtwechsel werden optisch durch einen dickeren linken Rand markiert:
 * Frühschicht (6:00), Spätschicht (13:00) und Nachtschicht (21:00).
 */

/** Stunden, an denen eine neue Schicht beginnt (Früh / Spät / Nacht). */
const SHIFT_START_HOURS = new Set([6, 13, 21])

interface HourCellProps {
  /** Stunde 0–23, die diese Zelle repräsentiert. */
  hourIndex: number
  /** Ob in dieser Stunde die Therapie aktiv ist. */
  isActive: boolean
  /** Malen beginnen (pointerdown auf dieser Zelle). */
  onPaintStart: () => void
  /** Beim Ziehen über diese Zelle malen (pointerenter). */
  onPaintEnter: () => void
  /** Einzelne Stunde per Tastatur umschalten. */
  onToggle: () => void
}

function HourCell({ hourIndex, isActive, onPaintStart, onPaintEnter, onToggle }: HourCellProps) {
  const isShiftStart = SHIFT_START_HOURS.has(hourIndex)

  function handlePointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    e.preventDefault() // verhindert Textauswahl/Fokus-Flackern während des Wischens
    // Implizites Pointer-Capture (v.a. Touch) lösen, damit pointerenter auch
    // auf den Nachbarzellen feuert und das Ziehen funktioniert.
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    onPaintStart()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      onToggle()
    }
  }

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerEnter={onPaintEnter}
      onKeyDown={handleKeyDown}
      aria-pressed={isActive}
      title={`${String(hourIndex).padStart(2, '0')}:00`}
      className={[
        'h-7 w-7 shrink-0 touch-none select-none border border-line transition-colors',
        'hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
        isActive ? 'bg-primary' : 'bg-surface',
        isShiftStart ? 'border-l-2 border-l-shift' : '',
      ].join(' ')}
    />
  )
}

export default HourCell
