interface SeverityInputProps {
  value: number
  onChange: (value: number) => void
  ariaLabel: string
}

/** Editierbares Zahlenfeld für manuelle Schweregrad-Eingaben (Fälle / TISS-28). */
function SeverityInput({ value, onChange, ariaLabel }: SeverityInputProps) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      value={value === 0 ? '' : value}
      placeholder="0"
      aria-label={ariaLabel}
      onChange={(e) => {
        const raw = Math.floor(Number(e.target.value))
        onChange(Number.isFinite(raw) && raw > 0 ? raw : 0)
      }}
      className="w-16 rounded-sm border border-line bg-bg px-1.5 py-0.5 text-right tabular-nums text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    />
  )
}

export default SeverityInput
