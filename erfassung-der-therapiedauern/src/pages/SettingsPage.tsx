import PlaceholderView from '../components/layout/PlaceholderView'

function SettingsPage() {
  return (
    <PlaceholderView
      title="Einstellungen"
      description="App-Konfiguration und Datenverwaltung"
      planned={
        <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-ink-muted">
          <li>Therapiearten verwalten</li>
          <li>Daten exportieren / importieren</li>
          <li>Anbindung an serverseitige Persistenz (BaaS)</li>
        </ul>
      }
    />
  )
}

export default SettingsPage
