import { useMemo, useState } from 'react'
import { useTherapyStore } from '../store/therapyStore'
import { availableYears, MONTH_SHORT } from '../lib/statistics'
import { buildIcuRow, buildImcRow, type IcuRow, type ImcRow } from '../lib/severity/severityStats'
import { severityId, type SeverityUnit } from '../lib/severity/types'
import { tissPerCase, ventPercentage, avgVentDuration } from '../lib/severity/severityStats'
import { formatDateDE, todayISO } from '../lib/date'
import YearSelector from '../components/statistik/YearSelector'
import SeverityInput from '../components/statistik/SeverityInput'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

/** Ganzzahl anzeigen; Kommazahl mit einer Nachkommastelle. */
const int = (n: number) => String(n)
const dec = (n: number) => n.toFixed(1)

function StatistikPage() {
  const records = useTherapyStore((s) => s.therapyRecords)
  const severityStats = useTherapyStore((s) => s.severityStats)
  const monthlyHistory = useTherapyStore((s) => s.monthlyHistory)
  const setSeverityInput = useTherapyStore((s) => s.setSeverityInput)

  const today = todayISO()
  const currentYear = Number(today.slice(0, 4))
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const years = useMemo(
    () => availableYears(records, monthlyHistory, currentYear),
    [records, monthlyHistory, currentYear],
  )

  // Nachschlage-Map für manuelle Werte (Fälle / TISS) je (Monat, Station).
  const manual = useMemo(() => {
    const map = new Map<string, { cases: number; tissPoints: number }>()
    for (const s of severityStats) map.set(s.id, { cases: s.cases, tissPoints: s.tissPoints })
    return (month: number, unit: SeverityUnit) =>
      map.get(severityId(selectedYear, month, unit)) ?? { cases: 0, tissPoints: 0 }
  }, [severityStats, selectedYear])

  const icuRows = useMemo(
    () => MONTHS.map((m) => buildIcuRow(records, selectedYear, m, manual(m, 'ICU').cases, manual(m, 'ICU').tissPoints)),
    [records, selectedYear, manual],
  )
  const imcRows = useMemo(
    () => MONTHS.map((m) => buildImcRow(m, manual(m, 'IMC').cases, manual(m, 'IMC').tissPoints)),
    [manual],
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Schweregradstatistik</h1>
          <p className="mt-1 text-sm text-ink-muted">
            ICU (Intensivstation 10) & Operative IMC · Stand {formatDateDE(today)}
          </p>
        </div>
        <YearSelector years={years} value={selectedYear} onChange={setSelectedYear} />
      </header>

      <IcuTable
        rows={icuRows}
        year={selectedYear}
        onInput={(month, field, value) => setSeverityInput(selectedYear, month, 'ICU', field, value)}
      />

      <ImcTable
        rows={imcRows}
        year={selectedYear}
        onInput={(month, field, value) => setSeverityInput(selectedYear, month, 'IMC', field, value)}
      />

      <p className="text-xs text-ink-muted">
        Fälle und TISS-28-Punkte werden manuell erfasst und automatisch mit dem lokalen Server
        synchronisiert. Alle übrigen Spalten werden aus den erfassten Therapiedaten berechnet.
      </p>
    </div>
  )
}

// ---- ICU-Tabelle ------------------------------------------------------------

interface IcuTableProps {
  rows: IcuRow[]
  year: number
  onInput: (month: number, field: 'cases' | 'tissPoints', value: number) => void
}

function IcuTable({ rows, year, onInput }: IcuTableProps) {
  const t = rows.reduce(
    (a, r) => ({
      cases: a.cases + r.cases,
      startedVentDays: a.startedVentDays + r.startedVentDays,
      completeVentDays: a.completeVentDays + r.completeVentDays,
      ventHours: a.ventHours + r.ventHours,
      ventPatients: a.ventPatients + r.ventPatients,
      crrtDays: a.crrtDays + r.crrtDays,
      ecmoDays: a.ecmoDays + r.ecmoDays,
      tissPoints: a.tissPoints + r.tissPoints,
    }),
    { cases: 0, startedVentDays: 0, completeVentDays: 0, ventHours: 0, ventPatients: 0, crrtDays: 0, ecmoDays: 0, tissPoints: 0 },
  )

  return (
    <section className="rounded-md border border-line bg-surface p-5">
      <h2 className="text-base font-semibold text-ink">ICU — Intensivstation 10</h2>
      <p className="mt-1 text-sm text-ink-muted">Beatmung, CRRT & ECMO je Monat ({year})</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-muted">
              <th className="py-2 pr-3 font-medium">Monat</th>
              <th className="py-2 pr-3 text-right font-medium">Fälle</th>
              <th className="py-2 pr-3 text-right font-medium">Beg. Beatm.tage</th>
              <th className="py-2 pr-3 text-right font-medium">Ganze Beatm.tage</th>
              <th className="py-2 pr-3 text-right font-medium">Beatm.std total</th>
              <th className="py-2 pr-3 text-right font-medium">Beatm.pat.</th>
              <th className="py-2 pr-3 text-right font-medium">Anteil %</th>
              <th className="py-2 pr-3 text-right font-medium">Ø Beatm.dauer</th>
              <th className="py-2 pr-3 text-right font-medium">Hämofilt.tage</th>
              <th className="py-2 pr-3 text-right font-medium">ECMO-Tage</th>
              <th className="py-2 pr-3 text-right font-medium">TISS-28</th>
              <th className="py-2 text-right font-medium">TISS/Fall</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="border-b border-line/60 transition-colors hover:bg-bg">
                <td className="py-1.5 pr-3 text-ink">{MONTH_SHORT[r.month - 1]}</td>
                <td className="py-1.5 pr-3 text-right">
                  <SeverityInput value={r.cases} ariaLabel={`ICU Fälle ${MONTH_SHORT[r.month - 1]}`} onChange={(v) => onInput(r.month, 'cases', v)} />
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-ink">{int(r.startedVentDays)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-ink">{int(r.completeVentDays)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-ink">{int(r.ventHours)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-ink">{int(r.ventPatients)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-ink-muted">{dec(r.ventPercentage)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-ink-muted">{dec(r.avgVentDuration)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-ink">{int(r.crrtDays)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-ink">{int(r.ecmoDays)}</td>
                <td className="py-1.5 pr-3 text-right">
                  <SeverityInput value={r.tissPoints} ariaLabel={`ICU TISS-28 ${MONTH_SHORT[r.month - 1]}`} onChange={(v) => onInput(r.month, 'tissPoints', v)} />
                </td>
                <td className="py-1.5 text-right tabular-nums text-ink-muted">{dec(r.tissPerCase)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line font-semibold text-ink">
              <td className="py-2 pr-3">Summe</td>
              <td className="py-2 pr-3 text-right tabular-nums">{int(t.cases)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{int(t.startedVentDays)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{int(t.completeVentDays)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{int(t.ventHours)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{int(t.ventPatients)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{dec(ventPercentage(t.ventPatients, t.cases))}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{dec(avgVentDuration(t.startedVentDays, t.ventPatients))}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{int(t.crrtDays)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{int(t.ecmoDays)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{int(t.tissPoints)}</td>
              <td className="py-2 text-right tabular-nums">{dec(tissPerCase(t.tissPoints, t.cases))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

// ---- IMC-Tabelle ------------------------------------------------------------

interface ImcTableProps {
  rows: ImcRow[]
  year: number
  onInput: (month: number, field: 'cases' | 'tissPoints', value: number) => void
}

function ImcTable({ rows, year, onInput }: ImcTableProps) {
  const totalCases = rows.reduce((a, r) => a + r.cases, 0)
  const totalTiss = rows.reduce((a, r) => a + r.tissPoints, 0)

  return (
    <section className="rounded-md border border-line bg-surface p-5">
      <h2 className="text-base font-semibold text-ink">IMC — Operative IMC</h2>
      <p className="mt-1 text-sm text-ink-muted">Manuelle Fälle & TISS-28 je Monat ({year})</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full max-w-xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-muted">
              <th className="py-2 pr-3 font-medium">Monat</th>
              <th className="py-2 pr-3 text-right font-medium">Fälle</th>
              <th className="py-2 pr-3 text-right font-medium">TISS-28</th>
              <th className="py-2 text-right font-medium">TISS/Fall</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="border-b border-line/60 transition-colors hover:bg-bg">
                <td className="py-1.5 pr-3 text-ink">{MONTH_SHORT[r.month - 1]}</td>
                <td className="py-1.5 pr-3 text-right">
                  <SeverityInput value={r.cases} ariaLabel={`IMC Fälle ${MONTH_SHORT[r.month - 1]}`} onChange={(v) => onInput(r.month, 'cases', v)} />
                </td>
                <td className="py-1.5 pr-3 text-right">
                  <SeverityInput value={r.tissPoints} ariaLabel={`IMC TISS-28 ${MONTH_SHORT[r.month - 1]}`} onChange={(v) => onInput(r.month, 'tissPoints', v)} />
                </td>
                <td className="py-1.5 text-right tabular-nums text-ink-muted">{dec(r.tissPerCase)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line font-semibold text-ink">
              <td className="py-2 pr-3">Summe</td>
              <td className="py-2 pr-3 text-right tabular-nums">{int(totalCases)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{int(totalTiss)}</td>
              <td className="py-2 text-right tabular-nums">{dec(tissPerCase(totalTiss, totalCases))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

export default StatistikPage
