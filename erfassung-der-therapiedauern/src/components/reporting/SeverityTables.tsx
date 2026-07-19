import { useMemo } from 'react'
import { useTherapyStore } from '../../store/therapyStore'
import { MONTH_SHORT } from '../../lib/statistics'
import {
  avgVentDuration,
  buildIcuRow,
  buildImcRow,
  tissPerCase,
  ventPercentage,
  type IcuRow,
  type ImcRow,
} from '../../lib/severity/severityStats'
import { severityId, type SeverityUnit } from '../../lib/severity/types'
import { ICU_COLUMNS, IMC_COLUMNS, type SeverityColumn } from '../../lib/severity/severityRules'
import SeverityInput from './SeverityInput'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

/** Ganzzahl anzeigen; Kommazahl mit einer Nachkommastelle. */
const int = (n: number) => String(n)
const dec = (n: number) => n.toFixed(1)

/**
 * Tabellen-Header-Zelle mit fachlichem Tooltip (`title` → Maus-Over) und einer
 * dezenten „✎"-Markierung für die manuell zu erfassenden Spalten. Text und Regel
 * stammen aus {@link ICU_COLUMNS} (eine einzige Quelle).
 */
function SeverityTh({ col, last }: { col: SeverityColumn; last: boolean }) {
  const isLabel = col.kind === 'label'
  return (
    <th
      title={col.rule}
      className={[
        'py-2 font-medium',
        last ? '' : 'pr-3',
        isLabel ? '' : 'text-right',
      ].join(' ')}
    >
      <span className="inline-flex items-center gap-1">
        {col.header}
        {col.kind === 'manual' && (
          <span aria-hidden className="text-[10px] leading-none text-primary/70" title="Manuell zu erfassen">
            ✎
          </span>
        )}
      </span>
    </th>
  )
}

/**
 * Aufklappbare Legende mit allen Berechnungsregeln — dauerhaft nachlesbar
 * (besser als reine Tooltips: auch per Tastatur/Touch, druckbar). Manuelle und
 * berechnete Spalten sind farblich unterschieden.
 */
function SeverityLegend() {
  return (
    <details className="group rounded-md border border-line bg-surface text-sm">
      <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 font-medium text-ink marker:content-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <span aria-hidden className="text-ink-muted transition-transform group-open:rotate-90">▸</span>
        Berechnung &amp; Regeln der Schweregradstatistik
      </summary>
      <div className="border-t border-line px-4 py-3">
        <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <span aria-hidden className="text-primary/70">✎</span> manuell zu erfassen
          </span>
          <span className="inline-flex items-center gap-1">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-primary/60" /> automatisch berechnet
          </span>
        </p>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {ICU_COLUMNS.filter((c) => c.kind !== 'label').map((c) => (
            <div key={c.key} className="flex gap-2">
              <span aria-hidden className="mt-0.5 shrink-0">
                {c.kind === 'manual' ? (
                  <span className="text-primary/70">✎</span>
                ) : (
                  <span className="inline-block h-2 w-2 translate-y-1 rounded-full bg-primary/60" />
                )}
              </span>
              <div>
                <dt className="font-medium text-ink">{c.title}</dt>
                <dd className="text-ink-muted">{c.rule}</dd>
              </div>
            </div>
          ))}
        </dl>
        <p className="mt-3 border-t border-line pt-3 text-xs text-ink-muted">
          Die IMC-Tabelle (Operative IMC) führt nur die manuellen Kennzahlen (Fälle, TISS-28) und den
          daraus berechneten TISS-28-Wert pro Fall — sie hat keine eigenen Beatmungs-/CRRT-/ECMO-Daten.
          Manuelle Eingaben werden automatisch mit dem lokalen Server synchronisiert.
        </p>
      </div>
    </details>
  )
}

/**
 * ICU- und IMC-Schweregradtabellen für ein Jahr. Berechnete Spalten kommen aus
 * den TherapyRecords, die manuellen Felder (Fälle / TISS-28) aus dem Store
 * (optimistic + debounced Sync).
 */
function SeverityTables({ year }: { year: number }) {
  const records = useTherapyStore((s) => s.therapyRecords)
  const severityStats = useTherapyStore((s) => s.severityStats)
  const setSeverityInput = useTherapyStore((s) => s.setSeverityInput)

  const manual = useMemo(() => {
    const map = new Map<string, { cases: number; tissPoints: number }>()
    for (const s of severityStats) map.set(s.id, { cases: s.cases, tissPoints: s.tissPoints })
    return (month: number, unit: SeverityUnit) =>
      map.get(severityId(year, month, unit)) ?? { cases: 0, tissPoints: 0 }
  }, [severityStats, year])

  const icuRows = useMemo(
    () => MONTHS.map((m) => buildIcuRow(records, year, m, manual(m, 'ICU').cases, manual(m, 'ICU').tissPoints)),
    [records, year, manual],
  )
  const imcRows = useMemo(
    () => MONTHS.map((m) => buildImcRow(m, manual(m, 'IMC').cases, manual(m, 'IMC').tissPoints)),
    [manual],
  )

  return (
    <div className="space-y-6">
      <IcuTable
        rows={icuRows}
        year={year}
        onInput={(month, field, value) => setSeverityInput(year, month, 'ICU', field, value)}
      />
      <ImcTable
        rows={imcRows}
        year={year}
        onInput={(month, field, value) => setSeverityInput(year, month, 'IMC', field, value)}
      />
      <SeverityLegend />
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
      continuedVentPatients: a.continuedVentPatients + r.continuedVentPatients,
      crrtDays: a.crrtDays + r.crrtDays,
      ecmoDays: a.ecmoDays + r.ecmoDays,
      tissPoints: a.tissPoints + r.tissPoints,
    }),
    { cases: 0, startedVentDays: 0, completeVentDays: 0, ventHours: 0, ventPatients: 0, continuedVentPatients: 0, crrtDays: 0, ecmoDays: 0, tissPoints: 0 },
  )

  return (
    <section className="print-avoid-break rounded-md border border-line bg-surface p-5">
      <h2 className="text-base font-semibold text-ink">ICU — Intensivstation 10</h2>
      <p className="mt-1 text-sm text-ink-muted">Beatmung, CRRT & ECMO je Monat ({year})</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-muted">
              {ICU_COLUMNS.map((c, i) => (
                <SeverityTh key={c.key} col={c} last={i === ICU_COLUMNS.length - 1} />
              ))}
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
                <td className="py-1.5 pr-3 text-right tabular-nums text-ink-muted">{int(r.continuedVentPatients)}</td>
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
              <td className="py-2 pr-3 text-right tabular-nums">{int(t.continuedVentPatients)}</td>
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
    <section className="print-avoid-break rounded-md border border-line bg-surface p-5">
      <h2 className="text-base font-semibold text-ink">IMC — Operative IMC</h2>
      <p className="mt-1 text-sm text-ink-muted">Manuelle Fälle & TISS-28 je Monat ({year})</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full max-w-xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-muted">
              {IMC_COLUMNS.map((c, i) => (
                <SeverityTh key={c.key} col={c} last={i === IMC_COLUMNS.length - 1} />
              ))}
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

export default SeverityTables
