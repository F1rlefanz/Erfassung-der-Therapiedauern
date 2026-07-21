import { useMemo, useState } from 'react'
import { useTherapyStore } from '../store/therapyStore'
import { useEffectiveRecords } from '../store/useEffectiveRecords'
import { availableYears } from '../lib/statistics'
import { formatDateDE, todayISO } from '../lib/date'
import YearSelector from '../components/YearSelector'
import SeverityTables from '../components/reporting/SeverityTables'
import DetailTable from '../components/reporting/DetailTable'

type ReportingTab = 'schweregrad' | 'mdk'

const TABS: { id: ReportingTab; label: string }[] = [
  { id: 'schweregrad', label: 'Schweregradstatistiken' },
  { id: 'mdk', label: 'Export' },
]

/**
 * Reporting & Controlling — bündelt alle Tabellen. Das Jahr-Dropdown filtert die
 * ganze Seite; eine Tab-Navigation trennt Schweregradstatistik und MDK-Export.
 * Beim Drucken wird nur der aktive Tab gerendert (die Tab-Leiste ist `no-print`).
 */
function ReportingPage() {
  const records = useEffectiveRecords()
  const patients = useTherapyStore((s) => s.patients)
  const monthlyHistory = useTherapyStore((s) => s.monthlyHistory)

  const today = todayISO()
  const currentYear = Number(today.slice(0, 4))
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [tab, setTab] = useState<ReportingTab>('schweregrad')

  const years = useMemo(
    () => availableYears(records, monthlyHistory, currentYear),
    [records, monthlyHistory, currentYear],
  )
  const yearRecords = useMemo(
    () => records.filter((r) => r.date.startsWith(`${selectedYear}-`)),
    [records, selectedYear],
  )

  const activeLabel = TABS.find((t) => t.id === tab)?.label ?? ''

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Reporting &amp; Controlling</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Schweregradstatistik & MDK-Export · Stand {formatDateDE(today)}
          </p>
          {/* Nur im Druck sichtbar — nennt Berichtsjahr + aktiven Tab. */}
          <p className="print-only mt-1 text-sm font-medium text-ink">
            {activeLabel} · Berichtsjahr {selectedYear}
          </p>
        </div>
        <div className="no-print">
          <YearSelector years={years} value={selectedYear} onChange={setSelectedYear} />
        </div>
      </header>

      {/* Tab-Navigation (Flex + Border-Bottom, im Druck ausgeblendet) */}
      <div className="no-print flex gap-1 border-b border-line" role="tablist" aria-label="Reporting-Bereiche">
        {TABS.map((t) => {
          const active = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={[
                '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                active
                  ? 'border-primary text-ink'
                  : 'border-transparent text-ink-muted hover:text-ink',
              ].join(' ')}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Nur der aktive Tab wird gerendert → beim Drucken erscheint auch nur dieser. */}
      {tab === 'schweregrad' ? (
        <SeverityTables year={selectedYear} />
      ) : (
        <DetailTable patients={patients} records={yearRecords} year={selectedYear} />
      )}
    </div>
  )
}

export default ReportingPage
