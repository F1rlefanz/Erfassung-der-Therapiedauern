import { useEffect, useState } from 'react'
import { SERVER_URL } from '../../lib/syncClient'

const CONFIRM_WORD = 'RESET'

interface StatusMessage {
  kind: 'success' | 'error'
  text: string
}

/**
 * Demo-Reset: leert Server-DB und alle verbundenen Clients gleichzeitig
 * (Broadcast via Socket.io, siehe syncClient/therapyStore `onDemoReset`).
 * Rendert nichts, solange der Server nicht mit DEMO_MODE läuft — auf einer
 * produktiven Installation (Windows-Dienst) existiert dieser Abschnitt daher
 * gar nicht sichtbar.
 */
function DemoReset() {
  const [enabled, setEnabled] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isResetting, setIsResetting] = useState(false)
  const [status, setStatus] = useState<StatusMessage | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${SERVER_URL}/demo-mode`)
      .then((res) => (res.ok ? res.json() : { enabled: false }))
      .then((data) => {
        if (!cancelled) setEnabled(Boolean(data.enabled))
      })
      .catch(() => {
        if (!cancelled) setEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!enabled) return null

  async function handleReset() {
    setIsResetting(true)
    setStatus(null)
    try {
      const res = await fetch(`${SERVER_URL}/demo-reset`, { method: 'POST' })
      if (!res.ok) throw new Error(String(res.status))
      setConfirmText('')
      setStatus({ kind: 'success', text: 'Demo-Reset ausgeführt — alle verbundenen Clients wurden geleert.' })
    } catch {
      setStatus({ kind: 'error', text: 'Demo-Reset fehlgeschlagen (Server nicht erreichbar?).' })
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <section className="rounded-md border border-error/40 bg-error/5 p-5">
      <h2 className="text-base font-semibold text-error">Demo-Reset</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Löscht ALLE Patienten, Records, Schweregrad-Kennzahlen und laufenden Therapien — auf dem
        Server und auf jedem gerade verbundenen Gerät. Nur zum Vorführen/Testen, nicht rückgängig
        zu machen (Server-Backups liegen unter <code className="rounded bg-bg px-1">server/data/backups</code>).
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Zum Bestätigen „{CONFIRM_WORD}" eingeben
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_WORD}
            className="w-40 rounded-sm border border-line bg-bg px-2 py-1 text-ink"
          />
        </label>
        <button
          type="button"
          disabled={confirmText !== CONFIRM_WORD || isResetting}
          onClick={handleReset}
          className="rounded-sm bg-error px-3 py-1.5 text-sm font-medium text-white transition-[filter] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isResetting ? 'Leere…' : 'Alles löschen'}
        </button>
      </div>

      {status && (
        <p
          className={['mt-3 text-sm', status.kind === 'success' ? 'text-emerald-600' : 'text-error'].join(' ')}
          role="status"
        >
          {status.text}
        </p>
      )}
    </section>
  )
}

export default DemoReset
