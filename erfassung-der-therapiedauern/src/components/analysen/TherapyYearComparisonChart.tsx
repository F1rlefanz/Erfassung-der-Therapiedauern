import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ProjectionModel } from '../../lib/projections/types'
import { MIN_MONTHS_FOR_PROJECTION } from '../../lib/projections/projections'
import { FORECAST_SUFFIX, type MonthlyComparisonPoint, type YearProjection } from '../../lib/statistics'
import { overlayYearColor } from '../../lib/chartColors'
import ProjectionToggle from './ProjectionToggle'

interface TherapyYearComparisonChartProps {
  title: string
  yAxisLabel: string
  selectedYear: number
  overlayYears: number[]
  monthlyData: MonthlyComparisonPoint[]
  /** Ob für diese Therapieart im gewählten Jahr überhaupt Daten vorliegen. */
  hasData: boolean
  /** Hinweistext, wenn keine Daten vorliegen (statt Chart). */
  emptyHint: string
  isCurrentYear: boolean
  projection: YearProjection
  model: ProjectionModel
  onModelChange: (model: ProjectionModel) => void
  infoText: string
}

/**
 * Jahresvergleichs-Chart einer Therapieart (Monatswerte + optionale
 * Jahresend-Prognose). Parametrisierte Komponente — wird für jede Therapieart
 * (Beatmung, CRRT, ILA/ECMO) mit eigenen Daten wiederverwendet.
 */
function TherapyYearComparisonChart({
  title,
  yAxisLabel,
  selectedYear,
  overlayYears,
  monthlyData,
  hasData,
  emptyHint,
  isCurrentYear,
  projection,
  model,
  onModelChange,
  infoText,
}: TherapyYearComparisonChartProps) {
  return (
    <section className="rounded-md border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {hasData && (
            <p className="mt-1 text-sm text-ink-muted">
              Absolute Monatswerte {selectedYear}
              {overlayYears.length > 0 && ` im Vergleich mit ${overlayYears.join(', ')}`}
              {projection.isProjected && ' und Prognose für die Restmonate'}
            </p>
          )}
        </div>
        {hasData && isCurrentYear && projection.isProjected && (
          <ProjectionToggle value={model} onChange={onModelChange} infoText={infoText} />
        )}
      </div>

      {!hasData ? (
        <p className="mt-4 rounded-md border border-dashed border-line p-6 text-center text-sm text-ink-muted">
          {emptyHint}
        </p>
      ) : (
        <>
          {projection.isProjected && (
            <p className="mt-3 text-sm text-ink-muted">
              Jahresend-Prognose:{' '}
              <span className="font-semibold text-primary">
                {Math.round(projection.yearEnd)} {yAxisLabel}
              </span>
              <span
                className="ml-2 text-xs"
                title="Verlässlichkeitshinweis, kein statistisches Konfidenzintervall. Steigt mit der Zahl der vorliegenden Monate; das saisonale Modell wiegt höher als die lineare Hochrechnung."
              >
                Konfidenz {Math.round(projection.confidence * 100)} %
              </span>
            </p>
          )}

          {projection.insufficientData && (
            <p className="mt-3 rounded-sm border border-line bg-bg px-3 py-2 text-sm text-ink-muted">
              Noch keine Jahresprognose — dafür braucht es mindestens{' '}
              {MIN_MONTHS_FOR_PROJECTION} Monate Datenbasis. Angezeigt werden die bisherigen
              Ist-Werte.
            </p>
          )}

          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyData} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
                <CartesianGrid stroke="var(--ui-line)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'var(--ui-ink-muted)', fontSize: 12 }}
                  axisLine={{ stroke: 'var(--ui-line)' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  width={52}
                  tick={{ fill: 'var(--ui-ink-muted)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: yAxisLabel,
                    angle: -90,
                    position: 'insideLeft',
                    style: { fill: 'var(--ui-ink-muted)', fontSize: 11, textAnchor: 'middle' },
                  }}
                />
                <Tooltip cursor={{ fill: 'var(--ui-primary)', fillOpacity: 0.06 }} content={<MonthlyTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--ui-ink-muted)' }} />

                {/* Vergleichsjahre: eigene Farbe + Strichmuster je Jahr. */}
                {overlayYears.map((year, i) => {
                  const color = overlayYearColor(i)
                  return (
                    <Line
                      key={year}
                      name={String(year)}
                      dataKey={String(year)}
                      stroke={color.stroke}
                      strokeWidth={1.75}
                      strokeDasharray={color.dash}
                      dot={false}
                      isAnimationActive={false}
                      connectNulls
                    />
                  )
                })}

                {/* Gewähltes Jahr: prägnante Balken (Ist) */}
                <Bar
                  name={`${selectedYear} (Ist)`}
                  dataKey={String(selectedYear)}
                  fill="var(--ui-primary)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                  isAnimationActive={false}
                />

                {/* Prognose für Restmonate: gestrichelte Linie in der Hauptfarbe.
                    Nur, wenn tatsächlich hochgerechnet wird (genug Datenbasis UND
                    bereits Ist-Werte) — sonst weder Linie noch Legende. */}
                {projection.isProjected && (
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
        </>
      )}
    </section>
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

export default TherapyYearComparisonChart
