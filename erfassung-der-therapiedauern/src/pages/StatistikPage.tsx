import PlaceholderView from '../components/layout/PlaceholderView'

function StatistikPage() {
  return (
    <PlaceholderView
      title="Statistik"
      description="Auswertungen & Graphen zu Therapiedauern"
      planned={
        <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-ink-muted">
          <li>Therapiestunden je Patient und Zeitraum</li>
          <li>Verteilung nach Therapieart (Beatmung / CRRT / ILA / ECMO)</li>
          <li>Verlauf über die Tage</li>
        </ul>
      }
    />
  )
}

export default StatistikPage
