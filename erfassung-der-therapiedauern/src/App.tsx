import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import DashboardPage from './pages/DashboardPage'
import ErfassungPage from './pages/ErfassungPage'
import StatistikPage from './pages/StatistikPage'
import SettingsPage from './pages/SettingsPage'
import { useTherapyStore } from './store/therapyStore'

// Hochrechnungen lädt recharts nach — nur beim Aufruf (Code-Splitting), damit
// der Initial-Load schlank bleibt.
const HochrechnungenPage = lazy(() => import('./pages/HochrechnungenPage'))

function App() {
  // Verbindung zum lokalen On-Premise-Server aufbauen (Socket.io) und beim
  // Unmount wieder trennen. Ohne laufenden Server bleibt die App voll
  // funktionsfähig (offline-first) und synchronisiert beim Reconnect.
  useEffect(() => useTherapyStore.getState().startSync(), [])

  return (
    <div className="flex min-h-svh flex-col bg-bg sm:flex-row">
      <Sidebar />
      <main className="flex flex-1 flex-col px-5 py-6 sm:px-8">
        <div className="mx-auto w-full max-w-5xl flex-1">
          <Suspense
            fallback={<p className="text-sm text-ink-muted">Wird geladen…</p>}
          >
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/erfassung" element={<ErfassungPage />} />
              <Route path="/statistik" element={<StatistikPage />} />
              <Route path="/hochrechnungen" element={<HochrechnungenPage />} />
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
