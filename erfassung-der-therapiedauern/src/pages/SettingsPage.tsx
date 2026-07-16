import BackupRestore from '../components/settings/BackupRestore'
import SyncStatusBadge from '../components/layout/SyncStatusBadge'

function SettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Einstellungen</h1>
        <p className="mt-1 text-sm text-ink-muted">Datensicherung und Synchronisation</p>
      </header>

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">Synchronisation</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Die App speichert alle Daten lokal (IndexedDB) und funktioniert vollständig offline.
          Läuft der lokale On-Premise-Server (<code className="rounded bg-bg px-1">npm run start:server</code>),
          werden Änderungen automatisch mit anderen Geräten im Intranet synchronisiert.
        </p>
        <div className="mt-3">
          <SyncStatusBadge />
        </div>
      </section>

      <BackupRestore />
    </div>
  )
}

export default SettingsPage
