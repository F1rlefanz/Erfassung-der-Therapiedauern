import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTherapyStore } from '../store/therapyStore'
import { useEffectiveRecords } from '../store/useEffectiveRecords'
import { THERAPY_TYPES, VENTILATION_TYPE } from '../lib/therapyTypes'
import {
  hasDataForType,
  therapyTypeDistribution,
  totalTherapyHours,
  totalVentilationDays,
} from '../lib/therapyCalculator'
import { computeSeasonalWeights } from '../lib/projections/seasonalWeights'
import type { ProjectionModel, SeasonalWeights } from '../lib/projections/types'
import TherapyStatsTable from '../components/analysen/TherapyStatsTable'
import { availableYears, buildMonthlyComparison, buildYearProjection } from '../lib/statistics'
import { formatDateDE, todayISO } from '../lib/date'
import StatTile from '../components/StatTile'
import YearSelector from '../components/YearSelector'
import YearOverlaySelector from '../components/analysen/YearOverlaySelector'
import TherapyYearComparisonChart from '../components/analysen/TherapyYearComparisonChart'
import type { TherapyType } from '../types'

/** Erläuterungstext zur Prognose-Datenbasis, je Therapieart und Modell. */
function buildInfoText(model: ProjectionModel, weights: SeasonalWeights, therapyType: TherapyType): string {
  if (model === 'linear') {
    return 'Lineare Hochrechnung auf Basis des bisherigen Tagesdurchschnitts — ohne Saisonalität, nur als Vergleich.'
  }
  if (weights.source === 'historical') {
    return `Basiert auf der historischen Monatsverteilung von ${weights.yearsUsed} Vorjahr${weights.yearsUsed === 1 ? '' : 'en'}.`
  }
  return therapyType === VENTILATION_TYPE
    ? 'Klinischer Standard-Fallback (Winter hoch, Sommer niedrig) — noch keine Vorjahresdaten vorhanden.'
    : 'Gleichverteilter Fallback über alle Monate — noch keine Vorjahresdaten vorhanden.'
}

function AnalysenPage() {
  const records = useEffectiveRecords()
  const monthlyHistory = useTherapyStore((s) => s.monthlyHistory)

  const today = todayISO()
  const currentYear = Number(today.slice(0, 4))

  const [model, setModel] = useState<ProjectionModel>('seasonal')
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [deselectedOverlayYears, setDeselectedOverlayYears] = useState<Set<number>>(new Set())

  const years = useMemo(
    () => availableYears(records, monthlyHistory, currentYear),
    [records, monthlyHistory, currentYear],
  )
  const isCurrentYear = selectedYear === currentYear

  const overlayYearCandidates = useMemo(
    () => years.filter((y) => y !== selectedYear),
    [years, selectedYear],
  )
  const overlayYears = useMemo(
    () => overlayYearCandidates.filter((y) => !deselectedOverlayYears.has(y)),
    [overlayYearCandidates, deselectedOverlayYears],
  )

  function toggleOverlayYear(year: number) {
    setDeselectedOverlayYears((prev) => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })
  }

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
  const hasDistributionData = THERAPY_TYPES.some((meta) => hasDataForType(yearRecords, meta.type))

  // Je Therapieart: Saison-Gewichte, Jahresend-Prognose und Monatsvergleich.
  // Alle drei Therapiearten bekommen dieselbe Prognose-Infrastruktur (Nutzer-
  // entscheidung: volle Parität statt nur Beatmung).
  const perTypeData = useMemo(
    () =>
      THERAPY_TYPES.map((meta) => {
        const weights = computeSeasonalWeights(monthlyHistory, currentYear, meta.type)
        const projection = buildYearProjection(
          records,
          selectedYear,
          isCurrentYear,
          today,
          model,
          weights.weights,
          meta.type,
        )
        const monthlyData = buildMonthlyComparison(
          records,
          selectedYear,
          years,
          currentYear,
          today,
          model,
          weights.weights,
          meta.type,
        )
        return {
          meta,
          weights,
          projection,
          monthlyData,
          hasData: hasDataForType(yearRecords, meta.type),
        }
      }),
    [records, monthlyHistory, currentYear, selectedYear, isCurrentYear, today, model, years, yearRecords],
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Analysen &amp; Graphen</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Monatswerte, Jahresvergleich & Prognosen · Stand {formatDateDE(today)}
          </p>
        </div>
        <YearSelector years={years} value={selectedYear} onChange={setSelectedYear} />
      </header>

      <YearOverlaySelector
        years={overlayYearCandidates}
        selected={overlayYears}
        onToggle={toggleOverlayYear}
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <StatTile label={`Patienten (${selectedYear})`} value={patientsInYear} />
        <StatTile label={`Beatmungstage ${selectedYear}`} value={totalVentilationDays(yearRecords)} accent />
        <StatTile label={`Therapiestunden ${selectedYear}`} value={`${totalTherapyHours(yearRecords)} h`} />
      </section>

      {/* Jahresvergleichs-Charts je Therapieart (Beatmung, CRRT, ILA/ECMO) */}
      {perTypeData.map(({ meta, weights, projection, monthlyData, hasData }) => (
        <TherapyYearComparisonChart
          key={meta.type}
          title={`${meta.label} je Monat — Jahresvergleich`}
          yAxisLabel={`${meta.short}-Tage`}
          selectedYear={selectedYear}
          overlayYears={overlayYears}
          monthlyData={monthlyData}
          hasData={hasData}
          emptyHint={`Keine ${meta.label}-Daten für ${selectedYear}.`}
          isCurrentYear={isCurrentYear}
          projection={projection}
          model={model}
          onModelChange={setModel}
          infoText={buildInfoText(model, weights, meta.type)}
        />
      ))}

      {/* Verteilung der Therapiearten (gewähltes Jahr) */}
      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">Verteilung der Therapiearten</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Aktive Tage (mit mindestens einer Stunde) je Therapieart · {selectedYear}
        </p>

        {hasDistributionData ? (
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData} margin={{ top: 16, right: 8, bottom: 0, left: 4 }}>
                <CartesianGrid stroke="var(--ui-line)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
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
                    value: 'Aktive Tage',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fill: 'var(--ui-ink-muted)', fontSize: 11, textAnchor: 'middle' },
                  }}
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

      {/* Monatsstatistik je Therapieart (Nachbau der Legacy-Tabellen) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-ink">Monatsstatistik je Therapieart</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Stunden, Tage und Fallzahlen je Monat · {selectedYear}
          </p>
        </div>
        {THERAPY_TYPES.map((meta) => (
          <TherapyStatsTable
            key={meta.type}
            records={yearRecords}
            therapyType={meta.type}
            label={meta.label}
            year={selectedYear}
            elapsedMonths={isCurrentYear ? Number(today.slice(5, 7)) : 0}
          />
        ))}
        <p className="text-xs text-ink-muted">
          Hinweis: „Tage/Fall" rechnet in der Gesamtzeile mit den <em>neuen</em> Fällen, in der
          Zeile „Ø pro Monat (÷ 12)" dagegen mit <em>allen</em> Fällen (neu + fortgeführt) — diese
          Unterscheidung stammt aus der Vorgänger-Anwendung und ist bewusst beibehalten.
        </p>
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

export default AnalysenPage
