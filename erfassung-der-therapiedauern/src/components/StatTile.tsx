interface StatTileProps {
  label: string
  value: string | number
  /** Optionaler Zusatz unter dem Wert (z. B. Zeitraum). */
  hint?: string
  /** Hebt den Wert in der Markenfarbe hervor (für die Kennzahl im Fokus). */
  accent?: boolean
}

/** Kennzahlenkachel im Corporate Design (Dashboard und Statistik). */
function StatTile({ label, value, hint, accent }: StatTileProps) {
  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <div
        className={[
          'text-3xl font-semibold tabular-nums',
          accent ? 'text-primary' : 'text-ink',
        ].join(' ')}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-ink-muted">{label}</div>
      {hint && <div className="mt-0.5 text-[11px] text-ink-muted">{hint}</div>}
    </div>
  )
}

export default StatTile
