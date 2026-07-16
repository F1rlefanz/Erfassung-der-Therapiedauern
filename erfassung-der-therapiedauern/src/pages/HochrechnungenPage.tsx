import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
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
import { availableYears, buildMonthlyComparison, buildYearProjection, FORECAST_SUFFIX } from '../lib/statistics'
import { formatDateDE, todayISO } from '../lib/date'
import StatTile from '../components/StatTile'
import ProjectionToggle from '../components/statistik/ProjectionToggle'
import YearSelector from '../components/statistik/YearSelector'
import DetailTable from '../components/statistik/DetailTable'

function HochrechnungenPage() {
  const records = useTherapyStore((s) => s.therapyRecords)
  const patients = useTherapyStore((s) => s.patients)
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
  const overlayYears = years.filter((y) => y !== selectedYear)

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

  const weights = useMemo(
    () => computeSeasonalWeights(monthlyHistory, currentYear),
    [monthlyHistory, currentYear],
  )
  const yearEnd = buildYearProjection(records, selectedYear, isCurrentYear, today, model, weights.weights).yearEnd
  const monthlyData = useMemo(
    () => buildMonthlyComparison(records, selectedYear, years, currentYear, today, model, weights.weights),
    [records, selectedYear, years, currentYear, today, model, weights.weights],
  )

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
          <h1 className="text-2xl font-semibold text-ink">Hochrechnungen</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Monatswerte, Jahresvergleich & Prognosen · Stand {formatDateDE(today)}
          </p>
          {/* Nur im Druck sichtbar — nennt das Berichtsjahr, da der Selector nicht druckt. */}
          <p className="print-only mt-1 text-sm font-medium text-ink">Berichtsjahr {selectedYear}</p>
        </div>
        <div className="no-print">
          <YearSelector years={years} value={selectedYear} onChange={setSelectedYear} />
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatTile label={`Patienten (${selectedYear})`} value={patientsInYear} />
        <StatTile label={`Beatmungstage ${selectedYear}`} value={totalVentilationDays(yearRecords)} accent />
        <StatTile label={`Therapiestunden ${selectedYear}`} value={`${totalTherapyHours(yearRecords)} h`} />
      </section>

      {/* Beatmungstage je Monat — Jahresvergleich (nicht kumuliert) */}
      <section className="no-print rounded-md border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">
              Beatmungstage je Monat — Jahresvergleich
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Absolute Monatswerte {selectedYear}
              {overlayYears.length > 0 && ` im Vergleich mit ${overlayYears.join(', ')}`}
              {isCurrentYear && ' und Prognose für die Restmonate'}
            </p>
          </div>
          {isCurrentYear && <ProjectionToggle value={model} onChange={setModel} infoText={infoText} />}
        </div>

        {isCurrentYear && (
          <p className="mt-3 text-sm text-ink-muted">
            Jahresend-Prognose:{' '}
            <span className="font-semibold text-primary">{Math.round(yearEnd)} Beatmungstage</span>
          </p>
        )}

        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyData} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
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
              <Tooltip cursor={{ fill: 'var(--ui-primary)', fillOpacity: 0.06 }} content={<MonthlyTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--ui-ink-muted)' }} />

              {/* Vorjahre: dezente Linien im Hintergrund */}
              {overlayYears.map((year, i) => (
                <Line
                  key={year}
                  name={String(year)}
                  dataKey={String(year)}
                  stroke="var(--ui-ink-muted)"
                  strokeWidth={1.5}
                  strokeOpacity={0.7 - i * 0.2}
                  strokeDasharray={i === 0 ? undefined : '4 3'}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}

              {/* Gewähltes Jahr: prägnante Balken (Ist) */}
              <Bar
                name={`${selectedYear} (Ist)`}
                dataKey={String(selectedYear)}
                fill="var(--ui-primary)"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
              />

              {/* Prognose für Restmonate: gestrichelte Linie in der Hauptfarbe */}
              {isCurrentYear && (
                <Line
                  name="Prognose"
                  dataKey={`${selectedYear}${FORECAST_SUFFIX}`}
                  stroke="var(--ui-primary)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={{ r: 2, fill: 'var(--ui-primary)' }}
                  isAnimationActive={false}
                  connectNulls
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Verteilung der Therapiearten (gewähltes Jahr) */}
      <section className="no-print rounded-md border border-line bg-surface p-5">
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

      {/* Detailauswertung je Patient + Exporte (druckbar) */}
      <DetailTable patients={patients} records={yearRecords} year={selectedYear} />
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

interface MonthlyTooltipEntry {
  name: string
  value: number | null
  color: string
}
function MonthlyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: MonthlyTooltipEntry[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const visible = payload.filter((p) => p.value !== null && p.value !== undefined)
  if (!visible.length) return null
  return (
    <div className="rounded-sm border border-line bg-surface px-3 py-2 text-xs shadow">
      <div className="font-medium text-ink">{label}</div>
      {visible.map((p) => (
        <div key={p.name} className="mt-0.5 flex items-center gap-1.5 text-ink-muted">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  )
}

export default HochrechnungenPage
