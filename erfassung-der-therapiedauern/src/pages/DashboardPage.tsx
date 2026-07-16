import { Link } from 'react-router-dom'
import { NAV_ITEMS } from '../components/layout/navItems'
import { useTherapyStore } from '../store/therapyStore'
import { formatDateDE, formatDateTimeDE, todayISO } from '../lib/date'

/** Schnellzugriff-Ziele: alle Navigationseinträge außer dem Dashboard selbst. */
const QUICK_LINKS = NAV_ITEMS.filter((item) => item.to !== '/')

function DashboardPage() {
  const patients = useTherapyStore((s) => s.patients)
  const therapyRecords = useTherapyStore((s) => s.therapyRecords)

  const today = todayISO()
  const todaysRecords = therapyRecords.filter(
    (r) => r.date === today && r.hours.some(Boolean),
  )
  const therapiesToday = todaysRecords.length
  const hoursToday = todaysRecords.reduce(
    (sum, r) => sum + r.hours.filter(Boolean).length,
    0,
  )
  const patientsToday = new Set(todaysRecords.map((r) => r.patientId)).size
  const lastUpdate = therapyRecords.reduce<string | null>(
    (latest, r) => (!latest || r.lastUpdatedAt > latest ? r.lastUpdatedAt : latest),
    null,
  )

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Willkommen</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Therapie-Tracking — heute ist der {formatDateDE(today)}
        </p>
      </header>

      {/* Schnellzugriff */}
      <section aria-labelledby="quick-heading" className="space-y-3">
        <h2 id="quick-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Schnellzugriff
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="group flex items-start gap-3 rounded-md border border-line bg-surface p-4 transition-colors hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="mt-0.5 text-ink-muted transition-colors group-hover:text-primary">
                {item.icon}
              </span>
              <span>
                <span className="block font-medium text-ink">{item.label}</span>
                <span className="mt-0.5 block text-sm text-ink-muted">{item.description}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Aktuelle Übersicht — live aus dem Store */}
      <section aria-labelledby="overview-heading" className="space-y-3">
        <h2 id="overview-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Aktuelle Übersicht
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Erfasste Therapien heute" value={therapiesToday} accent />
          <StatTile label="Therapiestunden heute" value={`${hoursToday} h`} />
          <StatTile label="Patienten mit Erfassung heute" value={patientsToday} />
          <StatTile label="Patienten gesamt" value={patients.length} />
        </div>
        <p className="text-xs text-ink-muted">
          Letzte Aktualisierung: {lastUpdate ? formatDateTimeDE(lastUpdate) : '–'}
        </p>
      </section>
    </div>
  )
}

interface StatTileProps {
  label: string
  value: string | number
  /** Hebt den Wert in der Markenfarbe hervor (für die Kennzahl im Fokus). */
  accent?: boolean
}

function StatTile({ label, value, accent }: StatTileProps) {
  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <div
        className={[
          'text-3xl font-semibold tabular-nums',
          accent ? 'text-primary' : 'text-ink',
        ].join(' ')}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-ink-muted">{label}</div>
    </div>
  )
}

export default DashboardPage
