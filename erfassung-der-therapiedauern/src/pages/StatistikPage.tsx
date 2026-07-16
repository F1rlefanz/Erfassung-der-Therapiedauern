import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTherapyStore } from '../store/therapyStore'
import { THERAPY_TYPES } from '../lib/therapyTypes'
import {
  therapyTypeDistribution,
  totalTherapyHours,
  totalVentilationDays,
  ventilationDaysInMonth,
} from '../lib/therapyCalculator'
import { formatDateDE, todayISO } from '../lib/date'
import StatTile from '../components/StatTile'

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

function StatistikPage() {
  const patients = useTherapyStore((s) => s.patients)
  const records = useTherapyStore((s) => s.therapyRecords)

  const today = todayISO()
  const [year, month] = today.split('-').map(Number)

  const distribution = therapyTypeDistribution(records)
  const chartData = distribution.map((d) => {
    const meta = THERAPY_TYPES.find((t) => t.type === d.type)
    return { name: meta?.short ?? d.label, label: d.label, days: d.days, hours: d.hours }
  })
  const hasData = records.some((r) => r.hours.some(Boolean))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Statistik</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Auswertung der erfassten Therapiedauern · Stand {formatDateDE(today)}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Patienten gesamt" value={patients.length} />
        <StatTile label="Beatmungstage gesamt" value={totalVentilationDays(records)} accent />
        <StatTile
          label="Beatmungstage im Monat"
          value={ventilationDaysInMonth(records, year, month)}
          hint={`${MONTH_NAMES[month - 1]} ${year}`}
        />
        <StatTile label="Therapiestunden gesamt" value={`${totalTherapyHours(records)} h`} />
      </section>

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">Verteilung der Therapiearten</h2>
        <p className="mt-1 text-sm text-ink-muted">Aktive Tage (mit mindestens einer Stunde) je Therapieart</p>

        {hasData ? (
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 16, right: 8, bottom: 0, left: -16 }}>
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
                  <LabelList
                    dataKey="days"
                    position="top"
                    fill="var(--ui-ink)"
                    fontSize={12}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-4 rounded-md border border-dashed border-line p-6 text-center text-sm text-ink-muted">
            Noch keine Therapiedaten erfasst.
          </p>
        )}
      </section>
    </div>
  )
}

interface TooltipEntry {
  payload: { label: string; days: number; hours: number }
}

/** Kompakter, CD-konformer Tooltip: aktive Tage + Therapiestunden je Art. */
function DistributionTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
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

export default StatistikPage
