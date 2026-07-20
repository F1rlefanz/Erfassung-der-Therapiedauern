import { useRef, useState } from 'react'
import { useTherapyStore, type BackupSnapshot } from '../../store/therapyStore'
import { todayISO } from '../../lib/date'

type ImportMode = 'merge' | 'replace'

interface StatusMessage {
  kind: 'success' | 'error'
  text: string
}

/** Löst einen Datei-Download im Browser aus. */
function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Prüft grob, ob ein geparstes Objekt einem BackupSnapshot entspricht. */
function isBackupSnapshot(value: unknown): value is BackupSnapshot {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return Array.isArray(v.patients) && Array.isArray(v.therapyRecords)
}

/**
 * Backup & Restore: exportiert den gesamten Zustand-Store als .json-Datei und
 * importiert ihn wieder (ersetzen oder zusammenführen). Dient als manuelle
 * Datensicherung für den On-Premise-Betrieb.
 */
function BackupRestore() {
  const patientCount = useTherapyStore((s) => s.patients.length)
  const recordCount = useTherapyStore((s) => s.therapyRecords.length)

  const [mode, setMode] = useState<ImportMode>('merge')
  const [status, setStatus] = useState<StatusMessage | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleExport() {
    const snapshot = useTherapyStore.getState().exportSnapshot()
    downloadJson(`therapiedauern-backup-${todayISO()}.json`, snapshot)
    setStatus({
      kind: 'success',
      text: `Backup exportiert (${snapshot.patients.length} Patienten, ${snapshot.therapyRecords.length} Records, ${snapshot.severityStats?.length ?? 0} Schweregrad-Einträge).`,
    })
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // erlaubt erneutes Wählen derselben Datei
    if (!file) return

    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!isBackupSnapshot(parsed)) {
        setStatus({ kind: 'error', text: 'Ungültige Backup-Datei (Struktur passt nicht).' })
        return
      }
      useTherapyStore.getState().importSnapshot(parsed, mode)
      setStatus({
        kind: 'success',
        text:
          mode === 'replace'
            ? 'Backup importiert — bestehender Bestand ersetzt.'
            : 'Backup importiert — mit bestehendem Bestand zusammengeführt.',
      })
    } catch {
      setStatus({ kind: 'error', text: 'Datei konnte nicht gelesen/geparst werden.' })
    }
  }

  return (
    <section className="rounded-md border border-line bg-surface p-5">
      <h2 className="text-base font-semibold text-ink">Backup &amp; Restore</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Manuelle Datensicherung. Aktuell erfasst: {patientCount} Patienten, {recordCount} Records.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleExport}
          className="rounded-sm bg-primary px-3 py-1.5 text-sm font-medium text-on-primary transition-[filter] hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Datenbank exportieren
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-sm border border-line px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Datenbank importieren
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileSelected}
          className="hidden"
        />

        <fieldset className="flex items-center gap-3 text-sm text-ink-muted">
          <legend className="sr-only">Import-Modus</legend>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="import-mode"
              checked={mode === 'merge'}
              onChange={() => setMode('merge')}
            />
            Zusammenführen
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="import-mode"
              checked={mode === 'replace'}
              onChange={() => setMode('replace')}
            />
            Ersetzen
          </label>
        </fieldset>
      </div>

      {status && (
        <p
          className={[
            'mt-3 text-sm',
            status.kind === 'success' ? 'text-emerald-600' : 'text-error',
          ].join(' ')}
          role="status"
        >
          {status.text}
        </p>
      )}
    </section>
  )
}

export default BackupRestore
