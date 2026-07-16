import { useTherapyStore } from '../../store/therapyStore'
import type { SyncStatus } from '../../lib/syncClient'

const LABELS: Record<SyncStatus, string> = {
  connecting: 'Verbinde…',
  online: 'Server verbunden',
  offline: 'Offline (nur lokal)',
}

const DOT: Record<SyncStatus, string> = {
  connecting: 'bg-amber-400',
  online: 'bg-emerald-500',
  offline: 'bg-slate-400',
}

/** Kleiner Statusindikator für die Verbindung zum lokalen Sync-Server. */
function SyncStatusBadge() {
  const status = useTherapyStore((s) => s.syncStatus)
  return (
    <div className="flex items-center gap-2 text-xs text-ink-muted" title={LABELS[status]}>
      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT[status]}`} aria-hidden="true" />
      <span className="truncate">{LABELS[status]}</span>
    </div>
  )
}

export default SyncStatusBadge
