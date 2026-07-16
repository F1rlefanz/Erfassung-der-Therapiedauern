import TherapyTable from './components/therapies/TherapyTable'

function App() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Erfassung der Therapiedauern</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Beatmung · CRRT · ILA / ECMO — stundengenaue Erfassung pro Patient und Tag
        </p>
      </header>
      <main>
        <TherapyTable />
      </main>
    </div>
  )
}

export default App
