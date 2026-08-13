import TherapyTable from '../components/therapies/TherapyTable'
import { THERAPY_TYPES } from '../lib/therapyTypes'

function ErfassungPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Erfassung</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {THERAPY_TYPES.map((meta) => meta.label).join(' · ')} — stundengenaue Erfassung pro
          Patient und Tag
        </p>
      </header>
      <TherapyTable />
    </div>
  )
}

export default ErfassungPage
