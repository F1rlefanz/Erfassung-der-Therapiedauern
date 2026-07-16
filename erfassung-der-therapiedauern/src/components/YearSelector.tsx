interface YearSelectorProps {
  years: number[]
  value: number
  onChange: (year: number) => void
}

/**
 * Dezentes Jahr-Dropdown für die Statistik. Bewusst ein natives <select> —
 * barrierefrei, tastaturbedienbar und ohne Layout-Risiko.
 */
function YearSelector({ years, value, onChange }: YearSelectorProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-muted">
      Jahr
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-sm border border-line bg-surface px-2 py-1 text-sm font-medium text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </label>
  )
}

export default YearSelector
