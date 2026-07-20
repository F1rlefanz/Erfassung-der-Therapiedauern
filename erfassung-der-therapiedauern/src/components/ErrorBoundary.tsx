import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Fängt Render-Fehler ab, damit ein Fehler in einer Komponente nicht die ganze
 * Seite weiß werden lässt. Zeigt stattdessen eine bedienbare Fehlermeldung mit
 * „Neu laden". Bereits erfasste Daten liegen offline-first in IndexedDB — ein
 * Neuladen stellt die App wieder her.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[app] Unerwarteter Fehler:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-svh items-center justify-center bg-bg p-6">
        <div className="max-w-md rounded-md border border-error/40 bg-surface p-6 text-center">
          <h1 className="text-lg font-semibold text-ink">Es ist ein Fehler aufgetreten</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Die Anwendung konnte nicht korrekt angezeigt werden. Deine erfassten Daten sind lokal
            gespeichert und gehen nicht verloren. Bitte lade die Seite neu.
          </p>
          <p className="mt-2 break-words text-xs text-ink-muted/80">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-[filter] hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Seite neu laden
          </button>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
