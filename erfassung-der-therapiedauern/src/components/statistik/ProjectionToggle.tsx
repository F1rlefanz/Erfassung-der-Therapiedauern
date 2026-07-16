import { useState } from 'react'
import type { ProjectionModel } from '../../lib/projections/types'

interface ProjectionToggleProps {
  value: ProjectionModel
  onChange: (model: ProjectionModel) => void
  /** Erläuterungstext für den Info-Tooltip (Datenbasis der Prognose). */
  infoText: string
}

const OPTIONS: { model: ProjectionModel; label: string }[] = [
  { model: 'linear', label: 'Linear' },
  { model: 'seasonal', label: 'Saisonal (Empfohlen)' },
]

/**
 * Umschalter zwischen linearer und saisonaler Prognose, mit dezentem
 * Info-Tooltip zur Datenbasis. Segmented Control im Corporate Design.
 */
function ProjectionToggle({ value, onChange, infoText }: ProjectionToggleProps) {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <div className="flex items-center gap-2">
      <div
        role="radiogroup"
        aria-label="Prognose-Modell"
        className="inline-flex rounded-sm border border-line bg-bg p-0.5"
      >
        {OPTIONS.map((opt) => {
          const active = opt.model === value
          return (
            <button
              key={opt.model}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.model)}
              className={[
                'rounded-[6px] px-3 py-1 text-sm font-medium transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                active ? 'bg-primary text-on-primary' : 'text-ink-muted hover:text-ink',
              ].join(' ')}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      <div className="relative">
        <button
          type="button"
          aria-label="Info zur Prognose"
          title={infoText}
          onMouseEnter={() => setShowInfo(true)}
          onMouseLeave={() => setShowInfo(false)}
          onFocus={() => setShowInfo(true)}
          onBlur={() => setShowInfo(false)}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-line text-xs text-ink-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          i
        </button>
        {showInfo && (
          <div
            role="tooltip"
            className="absolute right-0 z-10 mt-2 w-64 rounded-sm border border-line bg-surface p-3 text-xs text-ink-muted shadow"
          >
            {infoText}
          </div>
        )}
      </div>
    </div>
  )
}

export default ProjectionToggle
