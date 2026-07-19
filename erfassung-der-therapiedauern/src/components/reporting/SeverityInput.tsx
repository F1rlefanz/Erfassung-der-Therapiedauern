interface SeverityInputProps {
  value: number
  onChange: (value: number) => void
  ariaLabel: string
}

/**
 * Editierbares Zahlenfeld für manuelle Schweregrad-Eingaben (Fälle / TISS-28).
 * Trägt links ein dezentes „✎", damit die Zelle auch leer als *Eingabefeld*
 * erkennbar ist (und nicht wie ein leerer/„kaputter" Wert wirkt). Die manuellen
 * Spalten sind die einzigen editierbaren Felder der Tabelle.
 */
function SeverityInput({ value, onChange, ariaLabel }: SeverityInputProps) {
  return (
    <span className="relative inline-flex items-center">
      <span
        aria-hidden
        className="pointer-events-none absolute left-1.5 text-[10px] leading-none text-primary/70"
      >
        ✎
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value === 0 ? '' : value}
        placeholder="0"
        aria-label={ariaLabel}
        title="Manuell erfassen"
        onChange={(e) => {
          const raw = Math.floor(Number(e.target.value))
          onChange(Number.isFinite(raw) && raw > 0 ? raw : 0)
        }}
        className="w-[4.25rem] rounded-sm border border-primary/40 bg-bg py-0.5 pl-5 pr-1.5 text-right tabular-nums text-ink placeholder:text-ink-muted/50 focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary"
      />
    </span>
  )
}

export default SeverityInput
