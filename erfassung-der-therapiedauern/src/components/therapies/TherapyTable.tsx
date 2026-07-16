/**
 * Rahmenkomponente für die Therapie-Erfassungstabelle.
 *
 * Rendert später pro Patient eine Zeile mit 24 {@link HourCell}s je Therapieart.
 * Aktuell nur ein leeres Gerüst — die Daten-Anbindung (Patienten,
 * TherapyRecords) folgt in einem späteren Action Cycle.
 */

function TherapyTable() {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-sm text-slate-500">
        Noch keine Patienten erfasst.
      </p>
    </div>
  )
}

export default TherapyTable
