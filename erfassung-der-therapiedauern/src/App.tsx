import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import DashboardPage from './pages/DashboardPage'
import ErfassungPage from './pages/ErfassungPage'
import ReportingPage from './pages/ReportingPage'
import SettingsPage from './pages/SettingsPage'
import { nowHourStamp, useTherapyStore } from './store/therapyStore'

// Analysen lädt recharts nach — nur beim Aufruf (Code-Splitting), damit der
// Initial-Load schlank bleibt.
const AnalysenPage = lazy(() => import('./pages/AnalysenPage'))

function App() {
  const { pathname } = useLocation()
  // Reporting (große ICU-Tabelle) darf breiter sein als der Standard-Content —
  // alle anderen Seiten bleiben bei max-w-5xl (keine generelle Verbreiterung).
  const contentMaxWidth = pathname === '/reporting' ? 'max-w-7xl' : 'max-w-5xl'

  // Verbindung zum lokalen On-Premise-Server aufbauen (Socket.io) und beim
  // Unmount wieder trennen. Ohne laufenden Server bleibt die App voll
  // funktionsfähig (offline-first) und synchronisiert beim Reconnect.
  useEffect(() => useTherapyStore.getState().startSync(), [])

  // „Jetzt"-Stempel regelmäßig aktualisieren, damit laufende Therapien in Raster
  // und Statistik bis zur aktuellen Stunde mitwachsen. Einmal sofort setzen
  // (frischer Wert nach Rehydration), danach jede Minute.
  useEffect(() => {
    const tick = () => useTherapyStore.getState().setNow(nowHourStamp())
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex min-h-svh flex-col bg-bg sm:flex-row">
      <Sidebar />
      <main className="flex flex-1 flex-col px-5 py-6 sm:px-8">
        <div className={`mx-auto w-full ${contentMaxWidth} flex-1`}>
          <Suspense
            fallback={<p className="text-sm text-ink-muted">Wird geladen…</p>}
          >
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/erfassung" element={<ErfassungPage />} />
              <Route path="/reporting" element={<ReportingPage />} />
              <Route path="/analysen" element={<AnalysenPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
        <footer className="mx-auto mt-10 w-full max-w-5xl border-t border-line pt-4 text-xs text-ink-muted">
          © 2026 Erfassung der Therapiedauern · Christoph Fischer
        </footer>
      </main>
    </div>
  )
}

export default App
