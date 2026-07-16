import TherapyTable from './components/therapies/TherapyTable'

function App() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">
          Erfassung der Therapiedauern
        </h1>
      </header>
      <main>
        <TherapyTable />
      </main>
    </div>
  )
}

export default App
