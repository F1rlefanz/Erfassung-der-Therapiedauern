/**
 * Eine einzelne Stundenzelle im 24-Stunden-Raster einer TherapyRecord.
 *
 * Schichtwechsel werden optisch durch einen dickeren linken Rand markiert:
 * Frühschicht (6:00), Spätschicht (13:00) und Nachtschicht (21:00). So lässt
 * sich das Raster ohne zusätzliche Beschriftung in die drei Schichten lesen.
 */

/** Stunden, an denen eine neue Schicht beginnt (Früh / Spät / Nacht). */
const SHIFT_START_HOURS = new Set([6, 13, 21])

interface HourCellProps {
  /** Stunde 0–23, die diese Zelle repräsentiert. */
  hourIndex: number
  /** Ob in dieser Stunde die Therapie aktiv ist. */
  isActive: boolean
  /** Klick-Handler zum Umschalten dieser Stunde. */
  onClick: () => void
}

function HourCell({ hourIndex, isActive, onClick }: HourCellProps) {
  const isShiftStart = SHIFT_START_HOURS.has(hourIndex)

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      title={`${String(hourIndex).padStart(2, '0')}:00`}
      className={[
        'h-6 w-6 border border-slate-300 transition-colors',
        'hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
        isActive ? 'bg-sky-500 hover:bg-sky-600' : 'bg-white',
        isShiftStart ? 'border-l-2 border-l-slate-800' : '',
      ].join(' ')}
    />
  )
}

export default HourCell
