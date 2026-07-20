import { buildPatientYearRows, sumPatientYearRows, type PatientYearRow } from '../../lib/exports/reportRows'
import { buildEpisodeRows } from '../../lib/exports/episodeRows'
import { downloadCsv, downloadEpisodeCsv } from '../../lib/exports/csvExport'
import { useTherapyStore } from '../../store/therapyStore'
import type { Patient, TherapyRecord } from '../../types'

interface DetailTableProps {
  patients: Patient[]
  records: TherapyRecord[]
  year: number
}

const svg = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/**
 * Tabellarische Detailauswertung je Patient für ein Jahr (Controlling/MDK) mit
 * CSV- und Druck-/PDF-Export. Die Action-Buttons sind beim Drucken ausgeblendet
 * (`no-print`) und deaktiviert, wenn keine Daten vorliegen.
 */
function DetailTable({ patients, records, year }: DetailTableProps) {
  const nowStamp = useTherapyStore((s) => s.nowStamp)
  const rows = buildPatientYearRows(patients, records, year)
  const totals = sumPatientYearRows(rows)
  const hasData = rows.length > 0

  return (
    <section className="print-avoid-break rounded-md border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Detailauswertung {year}</h2>
          <p className="mt-1 text-sm text-ink-muted">Aggregierte Kennzahlen je Patient</p>
        </div>

        <div className="no-print flex gap-2">
          <button
            type="button"
            disabled={!hasData}
            onClick={() => downloadCsv(rows, year)}
            className="inline-flex items-center gap-2 rounded-sm border border-line px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg {...svg} aria-hidden="true">
              <path d="M12 3v12" />
              <path d="m7 12 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            CSV (aggregiert)
          </button>

          <button
            type="button"
            disabled={!hasData}
            onClick={() => downloadEpisodeCsv(buildEpisodeRows(patients, records, nowStamp), year)}
            title="Einzelne Therapie-Läufe mit Von/Bis (eine Zeile je zusammenhängender Episode)"
            className="inline-flex items-center gap-2 rounded-sm border border-line px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg {...svg} aria-hidden="true">
              <path d="M12 3v12" />
              <path d="m7 12 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            CSV Rohdaten (Von/Bis)
          </button>

          <button
            type="button"
            disabled={!hasData}
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-3 py-1.5 text-sm font-medium text-on-primary transition-[filter] hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg {...svg} aria-hidden="true">
              <path d="M6 9V3h12v6" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
              <path d="M6 14h12v7H6z" />
            </svg>
            Drucken / PDF
          </button>
        </div>
      </div>

      {hasData ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-line text-left text-ink-muted">
                <th className="py-2 pr-3 font-medium">Patient</th>
                <th className="py-2 pr-3 font-medium">Fallnummer</th>
                <th className="py-2 pr-3 text-right font-medium">Beatmungstage</th>
                <th className="py-2 pr-3 text-right font-medium">Therapiestunden</th>
                <th className="py-2 pr-3 text-right font-medium">davon CRRT (h)</th>
                <th className="py-2 text-right font-medium">davon iLA/ECMO (h)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: PatientYearRow) => (
                <tr key={row.patientId} className="border-b border-line/60 transition-colors hover:bg-bg">
                  <td className="py-2 pr-3 text-ink">{row.name}</td>
                  <td className="py-2 pr-3 text-ink-muted">{row.caseNumber}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-ink">{row.ventilationDays}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-ink">{row.totalHours}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-ink-muted">{row.crrtHours}</td>
                  <td className="py-2 text-right tabular-nums text-ink-muted">{row.ilaEcmoHours}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line font-semibold text-ink">
                <td className="py-2 pr-3">Summe</td>
                <td className="py-2 pr-3" />
                <td className="py-2 pr-3 text-right tabular-nums">{totals.ventilationDays}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{totals.totalHours}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{totals.crrtHours}</td>
                <td className="py-2 text-right tabular-nums">{totals.ilaEcmoHours}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-line p-6 text-center text-sm text-ink-muted">
          Keine Patientendaten für {year}.
        </p>
      )}
    </section>
  )
}

export default DetailTable
