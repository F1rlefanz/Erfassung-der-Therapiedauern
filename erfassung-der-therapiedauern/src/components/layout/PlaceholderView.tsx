import type { ReactNode } from 'react'

interface PlaceholderViewProps {
  title: string
  description: string
  /** Optionale Auflistung geplanter Funktionen. */
  planned?: ReactNode
}

/**
 * Einheitliche Platzhalter-Seite für noch nicht implementierte Views
 * (Statistik, Einstellungen). Hält das Corporate Design konsistent, bis die
 * eigentlichen Inhalte folgen.
 */
function PlaceholderView({ title, description, planned }: PlaceholderViewProps) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      </header>

      <div className="rounded-md border border-dashed border-line bg-surface p-8">
        <p className="text-sm font-medium text-ink">In Vorbereitung</p>
        <p className="mt-1 text-sm text-ink-muted">
          Diese Ansicht wird in einem kommenden Action Cycle umgesetzt.
        </p>
        {planned}
      </div>
    </div>
  )
}

export default PlaceholderView
