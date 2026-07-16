import { useState } from 'react'
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
import type { TherapyRecord } from '../types'
import { THERAPY_TYPES } from '../lib/therapyTypes'
import {
  isVentilationDay,
  therapyTypeDistribution,
  totalTherapyHours,
  totalVentilationDays,
  ventilationDaysInMonth,
} from '../lib/therapyCalculator'
import { daysInMonth, projectYearEnd } from '../lib/projections/projections'
import { computeSeasonalWeights } from '../lib/projections/seasonalWeights'
import type { ProjectionModel } from '../lib/projections/types'
import { formatDateDE, todayISO } from '../lib/date'
import StatTile from '../components/StatTile'
import ProjectionToggle from '../components/statistik/ProjectionToggle'

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
]

function StatistikPage() {
  const patients = useTherapyStore((s) => s.patients)
  const records = useTherapyStore((s) => s.therapyRecords)
  const monthlyHistory = useTherapyStore((s) => s.monthlyHistory)

  const [model, setModel] = useState<ProjectionModel>('seasonal')

  const today = todayISO()
  const [year, month] = today.split('-').map(Number)

  const distribution = therapyTypeDistribution(records)
  const distributionData = distribution.map((d) => {
    const meta = THERAPY_TYPES.find((t) => t.type === d.type)
    return { name: meta?.short ?? d.label, label: d.label, days: d.days, hours: d.hours }
  })
  const hasDistributionData = records.some((r) => r.hours.some(Boolean))

  // ---- Prognose (Beatmungstage aktuelles Jahr) ----
  const weights = computeSeasonalWeights(monthlyHistory, year)
  const projection = buildProjection(records, year, month, today, model, weights.weights)
  const infoText =
    model === 'linear'
      ? 'Lineare Hochrechnung auf Basis des bisherigen Tagesdurchschnitts — ohne Saisonalität, nur als Vergleich.'
      : weights.source === 'historical'
        ? `Basiert auf der historischen Monatsverteilung von ${weights.yearsUsed} Vorjahr${weights.yearsUsed === 1 ? '' : 'en'}.`
        : 'Klinischer Standard-Fallback (Winter hoch, Sommer niedrig) — noch keine Vorjahresdaten vorhanden.'

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

      {/* Jahresend-Prognose */}
      <section className="rounded-md border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Beatmungstage — Jahresend-Prognose</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Kumulierter Verlauf {year}: Ist und Hochrechnung zum Jahresende
            </p>
          </div>
          <ProjectionToggle value={model} onChange={setModel} infoText={infoText} />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-md">
          <StatTile label={`Beatmungstage ${year} (bisher)`} value={projection.ytd} />
          <StatTile label="Prognose Jahresende" value={Math.round(projection.yearEnd)} accent />
        </div>

        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={projection.chart} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
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
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--ui-ink-muted)' }} />
              <Line
                name="Ist (kumuliert)"
                dataKey="ist"
                stroke="var(--ui-primary)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
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
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Verteilung der Therapiearten */}
      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">Verteilung der Therapiearten</h2>
        <p className="mt-1 text-sm text-ink-muted">Aktive Tage (mit mindestens einer Stunde) je Therapieart</p>

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
            Noch keine Therapiedaten erfasst.
          </p>
        )}
      </section>
    </div>
  )
}

/**
 * Baut Kennzahlen und Chart-Daten für die Jahresend-Prognose der Beatmungstage.
 * `ist` = kumulierter Verlauf bis zum aktuellen Monat, `prognose` = gestrichelte
 * Fortführung vom aktuellen Stand bis zur Jahresend-Prognose, verteilt nach den
 * Monatsgewichten des gewählten Modells.
 */
function buildProjection(
  records: TherapyRecord[],
  year: number,
  currentMonth: number,
  today: string,
  model: ProjectionModel,
  weights: number[],
) {
  const perMonth = Array<number>(13).fill(0)
  for (const r of records) {
    if (!r.date.startsWith(`${year}-`) || r.date > today) continue
    if (!isVentilationDay(r)) continue
    perMonth[Number(r.date.slice(5, 7))] += 1
  }
  const cumulative = Array<number>(13).fill(0)
  for (let m = 1; m <= 12; m++) cumulative[m] = cumulative[m - 1] + perMonth[m]
  const ytd = cumulative[currentMonth]
  const yearEnd = projectYearEnd(ytd, today, model, weights)

  const monthWeight = (m: number) => (model === 'seasonal' ? weights[m - 1] : daysInMonth(year, m))
  let remainingSum = 0
  for (let m = currentMonth + 1; m <= 12; m++) remainingSum += monthWeight(m)

  const chart = []
  for (let m = 1; m <= 12; m++) {
    let prognose: number | null = null
    if (m === currentMonth) {
      prognose = ytd
    } else if (m > currentMonth) {
      let accum = 0
      for (let k = currentMonth + 1; k <= m; k++) accum += monthWeight(k)
      prognose = remainingSum > 0 ? ytd + (yearEnd - ytd) * (accum / remainingSum) : yearEnd
    }
    chart.push({
      month: MONTH_SHORT[m - 1],
      ist: m <= currentMonth ? cumulative[m] : null,
      prognose: prognose === null ? null : Math.round(prognose * 10) / 10,
    })
  }
  return { ytd, yearEnd, chart }
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
  color: string
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
