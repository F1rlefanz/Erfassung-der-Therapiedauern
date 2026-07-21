import { useTherapyStore } from '../store/therapyStore'
import { useEffectiveRecords } from '../store/useEffectiveRecords'
import { formatDateDE, formatDateTimeDE, todayISO } from '../lib/date'
import StatTile from '../components/StatTile'

function DashboardPage() {
  const patients = useTherapyStore((s) => s.patients)
  // Effektive Records (inkl. laufender Therapien bis „jetzt"), damit die
  // „heute"-Kacheln mit Erfassung und Analysen übereinstimmen.
  const therapyRecords = useEffectiveRecords()

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

export default DashboardPage
