import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTherapyStore } from '../store/therapyStore'
import { THERAPY_TYPES } from '../lib/therapyTypes'
import { therapyTypeDistribution, totalTherapyHours, totalVentilationDays } from '../lib/therapyCalculator'
import { computeSeasonalWeights } from '../lib/projections/seasonalWeights'
import type { ProjectionModel } from '../lib/projections/types'
import { availableYears, buildYearProjection } from '../lib/statistics'
import { formatDateDE, todayISO } from '../lib/date'
import StatTile from '../components/StatTile'
import ProjectionToggle from '../components/statistik/ProjectionToggle'
import YearSelector from '../components/statistik/YearSelector'

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
]

function StatistikPage() {
  const records = useTherapyStore((s) => s.therapyRecords)
  const monthlyHistory = useTherapyStore((s) => s.monthlyHistory)

  const today = todayISO()
  const currentYear = Number(today.slice(0, 4))

  const [model, setModel] = useState<ProjectionModel>('seasonal')
  const [selectedYear, setSelectedYear] = useState(currentYear)

  const years = useMemo(
    () => availableYears(records, monthlyHistory, currentYear),
    [records, monthlyHistory, currentYear],
  )
  const isCurrentYear = selectedYear === currentYear

  // Alle Berechnungen filtern auf das gewählte Jahr (rein clientseitig).
  const yearRecords = useMemo(
    () => records.filter((r) => r.date.startsWith(`${selectedYear}-`)),
    [records, selectedYear],
  )
  const patientsInYear = new Set(yearRecords.map((r) => r.patientId)).size

  const distribution = therapyTypeDistribution(yearRecords)
  const distributionData = distribution.map((d) => {
    const meta = THERAPY_TYPES.find((t) => t.type === d.type)
    return { name: meta?.short ?? d.label, label: d.label, days: d.days, hours: d.hours }
  })
  const hasDistributionData = yearRecords.some((r) => r.hours.some(Boolean))

  const weights = computeSeasonalWeights(monthlyHistory, currentYear)
  const projection = buildYearProjection(records, selectedYear, isCurrentYear, today, model, weights.weights)
  const chartData = projection.chart.map((p) => ({ month: MONTH_SHORT[p.month - 1], ist: p.ist, prognose: p.prognose }))

  const infoText =
    model === 'linear'
      ? 'Lineare Hochrechnung auf Basis des bisherigen Tagesdurchschnitts — ohne Saisonalität, nur als Vergleich.'
      : weights.source === 'historical'
        ? `Basiert auf der historischen Monatsverteilung von ${weights.yearsUsed} Vorjahr${weights.yearsUsed === 1 ? '' : 'en'}.`
        : 'Klinischer Standard-Fallback (Winter hoch, Sommer niedrig) — noch keine Vorjahresdaten vorhanden.'

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Statistik</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Auswertung der erfassten Therapiedauern · Stand {formatDateDE(today)}
          </p>
        </div>
        <YearSelector years={years} value={selectedYear} onChange={setSelectedYear} />
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatTile label={`Patienten (${selectedYear})`} value={patientsInYear} />
        <StatTile label={`Beatmungstage ${selectedYear}`} value={totalVentilationDays(yearRecords)} accent />
        <StatTile label={`Therapiestunden ${selectedYear}`} value={`${totalTherapyHours(yearRecords)} h`} />
      </section>

      {/* Beatmungstage-Verlauf: laufendes Jahr = Prognose, Vorjahr = final */}
      <section className="rounded-md border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">
              Beatmungstage — {isCurrentYear ? 'Jahresend-Prognose' : `Jahresverlauf ${selectedYear}`}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {isCurrentYear
                ? `Kumulierter Verlauf ${selectedYear}: Ist und Hochrechnung zum Jahresende`
                : `Finaler kumulierter Verlauf ${selectedYear} (abgeschlossenes Jahr)`}
            </p>
          </div>
          {isCurrentYear && <ProjectionToggle value={model} onChange={setModel} infoText={infoText} />}
        </div>

        {isCurrentYear && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-md">
            <StatTile label={`Beatmungstage ${selectedYear} (bisher)`} value={projection.ytd} />
            <StatTile label="Prognose Jahresende" value={Math.round(projection.yearEnd)} accent />
          </div>
        )}

        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="var(--ui-line)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: 'var(--ui-ink-muted)', fontSize: 12 }}
                axisLine={{ stroke: 'var(--ui-line)' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: 'var(--ui-ink-muted)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ProjectionTooltip />} />
              {isCurrentYear && <Legend wrapperStyle={{ fontSize: 12, color: 'var(--ui-ink-muted)' }} />}
              <Line
                name={isCurrentYear ? 'Ist (kumuliert)' : `Beatmungstage ${selectedYear}`}
                dataKey="ist"
                stroke="var(--ui-primary)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
              {isCurrentYear && (
                <Line
                  name="Prognose"
                  dataKey="prognose"
                  stroke="var(--ui-primary)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Verteilung der Therapiearten (gewähltes Jahr) */}
      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">Verteilung der Therapiearten</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Aktive Tage (mit mindestens einer Stunde) je Therapieart · {selectedYear}
        </p>

        {hasDistributionData ? (
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData} margin={{ top: 16, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="var(--ui-line)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'var(--ui-ink-muted)', fontSize: 12 }}
                  axisLine={{ stroke: 'var(--ui-line)' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: 'var(--ui-ink-muted)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'var(--ui-primary)', fillOpacity: 0.08 }}
                  content={<DistributionTooltip />}
                />
                <Bar
                  dataKey="days"
                  fill="var(--ui-primary)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={72}
                  isAnimationActive={false}
                >
                  <LabelList dataKey="days" position="top" fill="var(--ui-ink)" fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-4 rounded-md border border-dashed border-line p-6 text-center text-sm text-ink-muted">
            Keine Therapiedaten für {selectedYear}.
          </p>
        )}
      </section>
    </div>
  )
}

interface DistTooltip {
  payload: { label: string; days: number; hours: number }
}
function DistributionTooltip({ active, payload }: { active?: boolean; payload?: DistTooltip[] }) {
  if (!active || !payload?.length) return null
  const { label, days, hours } = payload[0].payload
  return (
    <div className="rounded-sm border border-line bg-surface px-3 py-2 text-xs shadow">
      <div className="font-medium text-ink">{label}</div>
      <div className="mt-0.5 text-ink-muted">
        {days} aktive Tage · {hours} h
      </div>
    </div>
  )
}

interface ProjTooltip {
  name: string
  value: number | null
}
function ProjectionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: ProjTooltip[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const visible = payload.filter((p) => p.value !== null && p.value !== undefined)
  if (!visible.length) return null
  return (
    <div className="rounded-sm border border-line bg-surface px-3 py-2 text-xs shadow">
      <div className="font-medium text-ink">{label}</div>
      {visible.map((p) => (
        <div key={p.name} className="mt-0.5 text-ink-muted">
          {p.name}: {p.value} Beatmungstage
        </div>
      ))}
    </div>
  )
}

export default StatistikPage
