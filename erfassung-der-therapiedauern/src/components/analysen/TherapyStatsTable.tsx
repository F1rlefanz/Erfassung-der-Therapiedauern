import { useMemo } from 'react'
import type { TherapyRecord, TherapyType } from '../../types'
import { MONTH_SHORT } from '../../lib/statistics'
import {
  averagePerMonth,
  buildTherapyYear,
  sumTherapyYear,
} from '../../lib/therapyMonthlyStats'

const int = (n: number) => String(n)
const dec = (n: number) => n.toFixed(1)

interface TherapyStatsTableProps {
  records: TherapyRecord[]
  therapyType: TherapyType
  label: string
  year: number
  /** Verstrichene Monate im laufenden Jahr; 0 = abgeschlossenes Jahr. */
  elapsedMonths: number
}

/**
 * Monatsstatistik einer Therapieart (Nachbau der Legacy-Tabelle).
 *
 * Zwei Besonderheiten, die aus der Legacy-Anwendung übernommen und hier bewusst
 * sichtbar gemacht werden:
 * - „Tage/Fall" rechnet in der Gesamtzeile mit den **neuen** Fällen, in der
 *   Jahreszeile darunter mit **allen** (neu + fortgeführt).
 * - Der Monatsdurchschnitt teilt durch 12; im laufenden Jahr steht darunter
 *   zusätzlich der Schnitt über die verstrichenen Monate.
 */
function TherapyStatsTable({
  records,
  therapyType,
  label,
  year,
  elapsedMonths,
}: TherapyStatsTableProps) {
  const rows = useMemo(
    () => buildTherapyYear(records, therapyType, year),
    [records, therapyType, year],
  )
  const totals = useMemo(() => sumTherapyYear(rows), [rows])

  const avg12 = averagePerMonth(totals, 12)
  const isRunningYear = elapsedMonths > 0 && elapsedMonths < 12
  const avgElapsed = averagePerMonth(totals, elapsedMonths)

  return (
    <section className="print-avoid-break rounded-md border border-line bg-surface p-5">
      <h3 className="text-base font-semibold text-ink">{label}</h3>
      <p className="mt-1 text-sm text-ink-muted">Monatsstatistik {year}</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-muted">
              <th className="py-2 pr-3 font-medium">Monat</th>
              <th className="py-2 pr-3 text-right font-medium" title="Summe der erfassten Stunden">
                Stunden
              </th>
              <th
                className="py-2 pr-3 text-right font-medium"
                title="Tage mit mindestens einer erfassten Stunde"
              >
                Beg. Tage
              </th>
              <th
                className="py-2 pr-3 text-right font-medium"
                title="Ganze 24-Stunden-Tage: Stunden ÷ 24, abgerundet"
              >
                Ganze Tage
              </th>
              <th
                className="py-2 pr-3 text-right font-medium"
                title="Im Monat NEU begonnene Fälle (distinkte Fallnummern)"
              >
                Neue Fälle
              </th>
              <th
                className="py-2 pr-3 text-right font-medium"
                title="Fälle, die bereits im Vormonat mit dieser Therapie erfasst waren"
              >
                Fortgef.
              </th>
              <th
                className="py-2 text-right font-medium"
                title="Begonnene Tage ÷ neue Fälle"
              >
                Tage/Fall
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="border-b border-line/60 transition-colors hover:bg-bg">
                <td className="py-1.5 pr-3 text-ink">{MONTH_SHORT[r.month - 1]}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-ink">{int(r.hours)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-ink">{int(r.startedDays)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-ink">{int(r.completeDays)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-ink">{int(r.newCases)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-ink-muted">
                  {int(r.continuedCases)}
                </td>
                <td className="py-1.5 text-right tabular-nums text-ink-muted">{dec(r.daysPerCase)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line font-semibold text-ink">
              <td className="py-2 pr-3">Gesamt</td>
              <td className="py-2 pr-3 text-right tabular-nums">{int(totals.hours)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{int(totals.startedDays)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{int(totals.completeDays)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{int(totals.newCases)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{int(totals.continuedCases)}</td>
              <td
                className="py-2 text-right tabular-nums"
                title="Begonnene Tage ÷ NEUE Fälle"
              >
                {dec(totals.daysPerCase)}
              </td>
            </tr>

            <tr className="text-ink-muted">
              <td className="py-1.5 pr-3" title="Legacy-Rechnung: immer ÷ 12, auch mitten im Jahr">
                Ø pro Monat (÷ 12)
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{dec(avg12.hours)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{dec(avg12.startedDays)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{dec(avg12.completeDays)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{dec(avg12.newCases)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{dec(avg12.continuedCases)}</td>
              <td
                className="py-1.5 text-right tabular-nums"
                title="Begonnene Tage ÷ ALLE Fälle (neu + fortgeführt) — rechnet bewusst anders als die Gesamtzeile"
              >
                {dec(totals.daysPerCaseAllCases)}
              </td>
            </tr>

            {isRunningYear && (
              <tr className="text-ink-muted">
                <td
                  className="py-1.5 pr-3"
                  title={`Schnitt über die ${elapsedMonths} bisher verstrichenen Monate — im laufenden Jahr aussagekräftiger als ÷ 12`}
                >
                  Ø pro Monat (÷ {elapsedMonths})
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{dec(avgElapsed.hours)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{dec(avgElapsed.startedDays)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{dec(avgElapsed.completeDays)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{dec(avgElapsed.newCases)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {dec(avgElapsed.continuedCases)}
                </td>
                <td className="py-1.5 text-right tabular-nums">—</td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </section>
  )
}

export default TherapyStatsTable
