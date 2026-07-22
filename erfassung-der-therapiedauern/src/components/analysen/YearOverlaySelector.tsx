interface YearOverlaySelectorProps {
  /** Kandidatenjahre (bereits ohne das gewählte Hauptjahr), absteigend. */
  years: number[]
  /** Aktuell aktive Vergleichsjahre. */
  selected: number[]
  onToggle: (year: number) => void
}

/**
 * Toggle-Chip-Reihe zur Auswahl der Vergleichsjahre in den
 * Jahresvergleichs-Charts (Mehrfachauswahl, seitenweit geteilt).
 */
function YearOverlaySelector({ years, selected, onToggle }: YearOverlaySelectorProps) {
  if (years.length === 0) return null
  return (
    <div
      className="flex flex-wrap items-center gap-2 text-sm text-ink-muted"
      role="group"
      aria-label="Vergleichsjahre"
    >
      <span>Vergleichsjahre</span>
      {years.map((year) => {
        const active = selected.includes(year)
        return (
          <button
            key={year}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(year)}
            className={[
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              active
                ? 'border-primary/40 bg-brand-light text-brand-dark'
                : 'border-line text-ink-muted hover:text-ink',
            ].join(' ')}
          >
            {year}
          </button>
        )
      })}
    </div>
  )
}

export default YearOverlaySelector
